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
 * Webcam example: camera frames in, tracked marker pose out, Three.js cube on top.
 *
 * All DOM and rendering concerns live here. The library itself stays free of
 * both, which is why this file — not `src/` — owns the canvas and the scene.
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
    getCameraProjectionMatrix,
    loadPatternMarker,
    processFrame,
    trackMarker,
    type ARToolKitState,
    type MarkerPose,
    type ThresholdMode,
} from '../../src/index';

// Vite resolves this to a hashed asset URL at build time; the WASM loader
// cannot discover it on its own.
//@ts-expect-error -- no ambient module declaration for `*?url` imports in this project
import wasmUrl from '/node_modules/@ar-js-org/artoolkit5-wasm/dist/artoolkit5.wasm?url';

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;
const MARKER_WIDTH = 1.0;
const CAMERA_PARAM_URL = './data/camera_para.dat';
const MARKER_PATTERN_URL = './data/patt.hiro';

// ARToolKitCore's own C++ defaults (ARToolKitCore.cpp constructor).
const DEFAULT_THRESHOLD = 100;
const DEFAULT_NEAR_PLANE = 0.0001;
const DEFAULT_FAR_PLANE = 1000;

const THRESHOLD_MODES: ThresholdMode[] = ['manual', 'auto-median', 'auto-otsu', 'auto-bracketing'];

async function main(): Promise<void> {
    const stage = getStage();
    const video = await startCamera(stage);
    const grabFrame = createFrameGrabber(video);

    const state = await createARToolKitState(
        FRAME_WIDTH,
        FRAME_HEIGHT,
        CAMERA_PARAM_URL,
        wasmUrl
    );

    const markerId = await loadPatternMarker(state, MARKER_PATTERN_URL);
    trackMarker(state, markerId, MARKER_WIDTH);

    const scene = createScene(stage, state);
    createControlPanel(state, scene.camera);

    renderContinuously(() => {
        const pixels = grabFrame();
        if (!pixels) return;

        const { detected, lost } = processFrame(state, pixels);

        if (lost.length > 0) {
            console.log('marker lost:', lost.join(', '));
        }

        showMarker(scene.cube, detected[0]);
        scene.renderer.render(scene.scene, scene.camera);
    });
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

    // ARToolKit's projection matrix accounts for real lens distortion, which a
    // generic PerspectiveCamera cannot.
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
    // Three.js culls against a frustum derived from the default camera matrix,
    // which does not match ARToolKit's — without this the cube can vanish.
    cube.frustumCulled = false;
    cube.visible = false;
    return cube;
}

/**
 * Demonstrates `configureDetector` with two groups of controls, chosen
 * deliberately rather than exposing every option:
 *
 * - Threshold mode/value: the option most likely to matter in practice —
 *   detection reliability under real lighting lives or dies on this.
 * - Near/far plane: the one option whose correctness this repo's test suite
 *   cannot verify, since every test runs against a mocked core.
 *   `configureDetector` recomputes ARToolKit's cached projection matrix, but
 *   Three.js keeps its own copy — `camera.projectionMatrix` has to be
 *   re-read from `getCameraProjectionMatrix` afterwards, same as any real
 *   consumer would need to. Set a small `farPlane` and Apply: the cube
 *   should clip out of view, which is the real-engine proof no mocked test
 *   can give.
 *
 * detectionMode/matrixCodeType are omitted: nothing here can detect a
 * barcode marker until #9 lands. labelingMode and the remaining options are
 * omitted to keep this panel to what is worth demonstrating.
 */
function createControlPanel(state: ARToolKitState, camera: Camera): void {
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

    addThresholdControls(panel, state);
    addProjectionPlaneControls(panel, state, camera);
}

function addThresholdControls(panel: HTMLElement, state: ARToolKitState): void {
    const modeSelect = document.createElement('select');
    for (const mode of THRESHOLD_MODES) {
        const option = document.createElement('option');
        option.value = mode;
        option.textContent = mode;
        modeSelect.appendChild(option);
    }
    modeSelect.value = 'manual';
    modeSelect.onchange = () => {
        configureDetector(state, { thresholdMode: modeSelect.value as ThresholdMode });
    };

    const thresholdInput = document.createElement('input');
    thresholdInput.type = 'range';
    thresholdInput.min = '0';
    thresholdInput.max = '255';
    thresholdInput.value = String(DEFAULT_THRESHOLD);
    // Only visible in 'manual' mode — the value is still stored otherwise,
    // ARToolKit just does not consult it.
    thresholdInput.oninput = () => {
        configureDetector(state, { threshold: Number(thresholdInput.value) });
    };

    panel.appendChild(labelled('threshold mode', modeSelect));
    panel.appendChild(labelled('threshold (manual mode only)', thresholdInput));
}

function addProjectionPlaneControls(
    panel: HTMLElement,
    state: ARToolKitState,
    camera: Camera
): void {
    const nearInput = document.createElement('input');
    nearInput.type = 'number';
    nearInput.step = 'any';
    nearInput.value = String(DEFAULT_NEAR_PLANE);

    const farInput = document.createElement('input');
    farInput.type = 'number';
    farInput.step = 'any';
    farInput.value = String(DEFAULT_FAR_PLANE);

    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply near/far plane';
    applyButton.onclick = () => {
        configureDetector(state, {
            nearPlane: Number(nearInput.value),
            farPlane: Number(farInput.value),
        });

        // configureDetector already refreshed ARToolKit's cached matrix;
        // Three.js holds its own copy, so it needs re-reading too.
        camera.projectionMatrix.fromArray(getCameraProjectionMatrix(state));
    };

    panel.appendChild(labelled('near plane', nearInput));
    panel.appendChild(labelled('far plane', farInput));
    panel.appendChild(applyButton);
}

function labelled(text: string, control: HTMLElement): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '2px';
    wrapper.textContent = text;
    wrapper.appendChild(control);
    return wrapper;
}

function showMarker(cube: Mesh, marker: MarkerPose | undefined): void {
    cube.visible = marker !== undefined;
    if (!marker) return;

    cube.matrix.fromArray(marker.matrixGL);
    cube.matrixWorldNeedsUpdate = true;
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
