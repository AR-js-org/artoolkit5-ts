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

import * as THREE from 'three';
import {
    createARToolKitState,
    getCameraProjectionMatrix,
    loadPatternMarker,
    processFrame,
    trackMarker,
    type ARToolKitState,
    type MarkerPose,
} from '../../src/index';

// Vite resolves this to a hashed asset URL at build time; the WASM loader
// cannot discover it on its own.
//@ts-ignore
import wasmUrl from '/node_modules/@ar-js-org/artoolkit5-wasm/dist/artoolkit5.wasm?url';

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;
const MARKER_WIDTH = 1.0;
const CAMERA_PARAM_URL = './data/camera_para.dat';
const MARKER_PATTERN_URL = './data/patt.hiro';

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

    renderContinuously(() => {
        const pixels = grabFrame();
        if (!pixels) return;

        const [marker] = processFrame(state, pixels);
        showMarker(scene.cube, marker);
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
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    cube: THREE.Mesh;
}

function createScene(stage: HTMLElement, state: ARToolKitState): Stage {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(FRAME_WIDTH, FRAME_HEIGHT);
    overlay(renderer.domElement, 1);
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // ARToolKit's projection matrix accounts for real lens distortion, which a
    // generic PerspectiveCamera cannot.
    const camera = new THREE.PerspectiveCamera(60, FRAME_WIDTH / FRAME_HEIGHT, 0.1, 10000);
    camera.projectionMatrix.fromArray(getCameraProjectionMatrix(state));
    camera.matrixAutoUpdate = false;
    scene.add(camera);

    const cube = createCube();
    scene.add(cube);

    return { renderer, scene, camera, cube };
}

function createCube(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.translate(0, 0, 0.5); // sit on the marker plane rather than through it

    const cube = new THREE.Mesh(
        geometry,
        new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.8 })
    );

    cube.matrixAutoUpdate = false;
    // Three.js culls against a frustum derived from the default camera matrix,
    // which does not match ARToolKit's — without this the cube can vanish.
    cube.frustumCulled = false;
    cube.visible = false;
    return cube;
}

function showMarker(cube: THREE.Mesh, marker: MarkerPose | undefined): void {
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
