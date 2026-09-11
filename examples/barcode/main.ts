/*
 *  main.ts
 *  artoolkit5-ts
 *
 *  This file is part of artoolkit5-ts - AR-js-org.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  artoolkit5-ts is distributed in the hope that it will be useful, but WITHOUT
 *  ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. See the MIT License
 *  for more details.
 *
 *  You should have received a copy of the MIT License along with artoolkit5-ts.
 *  If not, see <https://opensource.org/licenses/MIT>.
 *
 *  This library wraps a WebAssembly build of ARToolkit5 (WebARKitLib), which
 *  is licensed under the GNU Lesser General Public License v3.0.
 *
 *  Copyright (c) 2026 AR-js-org
 *
 *  Author(s): Walter Perdan @kalwalt https://github.com/kalwalt
 *
 */

/**
 * Barcode marker example: camera frames in, tracked barcode pose out, Three.js
 * cube on top. Deliberately structured the same as `examples/webcam` — the
 * only difference from a pattern marker is registration, not detection or
 * rendering, and keeping the two examples parallel makes that obvious.
 *
 * Unlike the webcam example, there is no `.patt` file to load: the ID is
 * `trackBarcodeMarker`'s own argument, encoded directly in the marker's
 * geometry rather than assigned by the engine.
 *
 * Also registers the webcam example's Hiro pattern marker and exposes a
 * detection-mode switcher, so `'mono+matrix'`/`'color+matrix'` — detecting
 * both marker families at once — can be verified against the real engine.
 * See docs/DESIGN-detector-and-barcode.md §9 and issue #33: the mocked test
 * suite can prove `configureDetector` calls the right setter, but not that
 * the engine then finds two different kinds of markers in one frame.
 */

import {
    BoxGeometry,
    type Camera,
    Mesh,
    MeshNormalMaterial,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
} from 'three';
import {
    configureDetector,
    createARToolKitState,
    disposeARToolKitState,
    getCameraProjectionMatrix,
    loadPatternMarker,
    processFrame,
    trackBarcodeMarker,
    trackMarker,
    type ARToolKitState,
    type DetectionMode,
    type MarkerPose,
} from '../../src/index';

// Vite resolves this to a hashed asset URL at build time; the WASM loader
// cannot discover it on its own.
//@ts-expect-error -- no ambient module declaration for `*?url` imports in this project
import wasmUrl from '/node_modules/@ar-js-org/artoolkit5-wasm/dist/artoolkit5.wasm?url';

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;
const MARKER_WIDTH = 1.0;
// Same calibration file as examples/webcam — nothing about the camera changes
// between marker families, only which marker is being detected.
const CAMERA_PARAM_URL = '../webcam/data/camera_para.dat';
// Reusing the webcam example's own pattern marker — this page needs both
// families registered to test combined-mode detection.
const MARKER_PATTERN_URL = '../webcam/data/patt.hiro';

// data/marker_05_3x3.jpg encodes ID 5 as a 3x3 matrix code. Print it or
// display it on a second screen, the same as the Hiro marker in the webcam
// example.
const BARCODE_ID = 5;

// All five modes, so a marker can be compared single-family against combined
// on one page. That contrast is the point of this example: it is what shows
// `'matrix'` ignoring a pattern marker, and the combined modes finding both.
const DETECTION_MODES: DetectionMode[] = [
    'matrix',
    'mono+matrix',
    'color+matrix',
    'mono',
    'color',
];

async function main(): Promise<void> {
    const stage = getStage();
    const video = await startCamera(stage);

    // Setup past this point is asynchronous and can fail while the camera is
    // already live — fetching the pattern file, or initialising the engine.
    // Release both rather than leaving the capture indicator on with nothing
    // using it.
    let state: ARToolKitState | undefined;
    try {
        const grabFrame = createFrameGrabber(video);

        state = await createARToolKitState(
            FRAME_WIDTH,
            FRAME_HEIGHT,
            CAMERA_PARAM_URL,
            wasmUrl
        );

        // Barcode markers are only detected once the engine is in a matrix-capable
        // mode. This is the one step a pattern-only consumer never needs.
        applyDetectionMode(state, 'matrix');

        // Both families are registered regardless of the active mode. That is
        // harmless under plain 'matrix': the template-matching pass that would
        // find the pattern marker simply never runs for that mode, so it sits
        // registered but unmatched until a combined mode is selected.
        const patternId = await loadPatternMarker(state, MARKER_PATTERN_URL);
        trackMarker(state, patternId, MARKER_WIDTH);
        trackBarcodeMarker(state, BARCODE_ID, MARKER_WIDTH);

        const scene = createScene(stage, state);
        const controlPanel = createControlPanel(state);
        const tracking = state;

        renderContinuously(() => {
            const pixels = grabFrame();
            if (!pixels) return;

            const { detected, lost } = processFrame(tracking, pixels);
            controlPanel.updateLog(detected);

            if (lost.length > 0) {
                console.log('marker lost:', lost.map((m) => `${m.type} id ${m.id}`).join(', '));
            }

            showMarker(scene.cube, detected[0]);
            scene.renderer.render(scene.scene, scene.camera);
        });
    } catch (error) {
        releaseCamera(video);
        if (state) disposeARToolKitState(state);
        throw error;
    }
}

/** Stops every track so the camera indicator goes out. */
function releaseCamera(video: HTMLVideoElement): void {
    const stream = video.srcObject;
    if (stream instanceof MediaStream) {
        for (const track of stream.getTracks()) {
            track.stop();
        }
    }
    video.srcObject = null;
}

/**
 * The single place `detectionMode` is applied, used both for the initial
 * mode and every subsequent change from the panel — so the default and the
 * switcher can never independently drift out of sync.
 */
function applyDetectionMode(state: ARToolKitState, mode: DetectionMode): void {
    configureDetector(state, { detectionMode: mode, matrixCodeType: '3x3' });
}

function getStage(): HTMLElement {
    const stage = document.getElementById('app');
    if (!stage) {
        throw new Error('Missing #app element');
    }

    stage.style.position = 'relative';
    stage.style.width = `${FRAME_WIDTH}px`;
    stage.style.height = `${FRAME_HEIGHT}px`;
    return stage;
}

async function startCamera(stage: HTMLElement): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    overlay(video, 0);
    video.style.objectFit = 'cover';
    stage.appendChild(video);

    video.srcObject = await navigator.mediaDevices.getUserMedia({
        video: { width: FRAME_WIDTH, height: FRAME_HEIGHT, facingMode: 'environment' },
        audio: false,
    });

    await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
            void video.play();
            resolve();
        };
    });

    return video;
}

/**
 * Returns a function yielding the current frame's pixels, or `null` while the
 * video has not buffered enough data. The canvas is created once and reused.
 */
function createFrameGrabber(video: HTMLVideoElement): () => Uint8ClampedArray | null {
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_WIDTH;
    canvas.height = FRAME_HEIGHT;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        throw new Error('Could not create a 2D context for frame extraction');
    }

    return () => {
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;
        context.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
        return context.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;
    };
}

interface Stage {
    renderer: WebGLRenderer;
    scene: Scene;
    camera: Camera;
    cube: Mesh;
}

function createScene(stage: HTMLElement, state: ARToolKitState): Stage {
    const renderer = new WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(FRAME_WIDTH, FRAME_HEIGHT);
    overlay(renderer.domElement, 1);
    stage.appendChild(renderer.domElement);

    const scene = new Scene();

    const camera = new PerspectiveCamera(60, FRAME_WIDTH / FRAME_HEIGHT, 0.1, 10000);
    camera.projectionMatrix.fromArray(getCameraProjectionMatrix(state));
    camera.matrixAutoUpdate = false;
    scene.add(camera);

    const cube = createCube();
    scene.add(cube);

    return { renderer, scene, camera, cube };
}

function createCube(): Mesh {
    const geometry = new BoxGeometry(1, 1, 1);
    geometry.translate(0, 0, 0.5); // sit on the marker plane rather than through it

    const cube = new Mesh(
        geometry,
        new MeshNormalMaterial({ transparent: true, opacity: 0.8 })
    );

    cube.matrixAutoUpdate = false;
    cube.frustumCulled = false;
    cube.visible = false;
    return cube;
}

function showMarker(cube: Mesh, marker: MarkerPose | undefined): void {
    cube.visible = marker !== undefined;
    if (!marker) return;

    cube.matrix.fromArray(marker.matrixGL);
    cube.matrixWorldNeedsUpdate = true;
}

/**
 * Detection-mode switcher and a per-frame detection log. The log, not a
 * second 3D object, is the verification signal here: reading two labelled
 * entries proves both marker families were found, with no risk of misreading
 * overlapping or mis-posed geometry. It runs in every mode, not just the
 * combined ones, so the same line visibly grows from one entry to two the
 * moment the mode changes.
 */
function createControlPanel(state: ARToolKitState): { updateLog: (detected: MarkerPose[]) => void } {
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.top = '12px';
    panel.style.right = '12px';
    panel.style.zIndex = '10';
    panel.style.padding = '10px 12px';
    panel.style.background = 'rgba(0, 0, 0, 0.6)';
    panel.style.color = '#fff';
    panel.style.font = '12px sans-serif';
    panel.style.borderRadius = '4px';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '8px';
    document.body.appendChild(panel);

    const modeSelect = document.createElement('select');
    for (const mode of DETECTION_MODES) {
        const option = document.createElement('option');
        option.value = mode;
        option.textContent = mode;
        modeSelect.appendChild(option);
    }
    modeSelect.value = 'matrix';
    modeSelect.onchange = () => {
        applyDetectionMode(state, modeSelect.value as DetectionMode);
    };

    const label = document.createElement('label');
    label.textContent = 'detection mode';
    label.appendChild(modeSelect);
    panel.appendChild(label);

    const log = document.createElement('div');
    panel.appendChild(log);

    return {
        updateLog: (detected) => {
            log.textContent = formatDetected(detected);
        },
    };
}

function formatDetected(detected: MarkerPose[]): string {
    if (detected.length === 0) return 'detected: none';
    return 'detected: ' + detected.map((marker) => `id ${marker.id} (${marker.type})`).join(', ');
}

function overlay(element: HTMLElement, zIndex: number): void {
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.zIndex = String(zIndex);
}

function renderContinuously(tick: () => void): void {
    const loop = () => {
        tick();
        requestAnimationFrame(loop);
    };
    loop();
}

main().catch((error) => {
    console.error('AR initialisation failed:', error);
});
