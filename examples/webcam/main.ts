// examples/webcam/main.ts

// Import directly from the source code you are developing!
import * as THREE from 'three';
import { createARToolKitState, loadPatternMarker, trackMarker, processFrame } from './../../src/index';
//@ts-ignore
import wasmUrl from '/node_modules/@ar-js-org/artoolkit5-wasm/dist/artoolkit5.wasm?url';
import { getCameraProjectionMatrix } from '../../src/math';

const setMatrix = function (matrix: any, value: any) {
    const array: any = [];
    for (const key in value) {
        array[key] = value[key];
    }
    if (typeof matrix.elements.set === "function") {
        matrix.elements.set(array);
    } else {
        matrix.elements = [].slice.call(array);
    }
};

async function start() {
    // ... (webcam and video setup) ...

    try {
        // --- 1. DOM SETUP VIA #app ---
        const appDiv = document.getElementById('app');
        if (!appDiv) throw new Error("Div #app not found!");

        // Ensure the container acts as an "anchor" for absolute elements
        appDiv.style.position = 'relative';
        appDiv.style.width = '640px';
        appDiv.style.height = '480px';

        // Programmatically create the video and insert it into #app
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.zIndex = '0'; // Stays underneath
        appDiv.appendChild(video);

        // In-memory canvas to read pixels (not added to the DOM)
        const canvas_process = document.createElement("canvas");
        canvas_process.width = 640;
        canvas_process.height = 480;
        const context_process = canvas_process.getContext("2d", { willReadFrequently: true })!;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'environment' },
                audio: false
            });
            video.srcObject = stream;

            await new Promise<void>((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
        } catch (err) {
            console.error("Camera error: ", err);
            return;
        }
        console.log("WASM initialization via URL:", wasmUrl);

        // 2. Pass the wasmUrl as the fourth parameter
        const state = await createARToolKitState(
            640,
            480,
            './data/camera_para.dat', // Ensure this file is also reachable
            wasmUrl
        );

        const markerId = await loadPatternMarker(state, './data/patt.hiro'); // Load a sample marker
        const tracker = await trackMarker(state, markerId, 1.0); // Track the marker with ID 0 and width 1.0 units
        // --- THREE.JS SETUP ---
        // Set alpha to true to see the underlying HTML video
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(640, 480);
        // Position the 3D canvas exactly over the video
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '1';
        appDiv.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        // Create a manual projection matrix for testing
        // Set an approximate FOV (Field of View), the aspect ratio of the video and the near/far planes
        const fov = 60; // Degrees
        const aspect = 640 / 480;
        const near = 0.1;
        const far = 10000;

        // Replace THREE.Camera() with THREE.PerspectiveCamera()
        const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        // Apply the projection matrix calculated by ARToolKit
        const projMatrix = getCameraProjectionMatrix(state);
        console.log("Calculated projection:", projMatrix);
        setMatrix(camera.projectionMatrix, projMatrix);
        camera.matrixAutoUpdate = false;
        scene.add(camera);

        // Create a test cube (side 1.0 to match markerWidth)
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        // Translate the geometry so that the base rests on the marker (instead of cutting it in half)
        geometry.translate(0, 0, 0.5);
        const material = new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.8 });
        const cube = new THREE.Mesh(geometry, material);

        // Disable internal Three.js calculation, use ARToolKit data directly
        cube.matrixAutoUpdate = false;
        cube.visible = false;
        scene.add(cube);

        console.log("State initialized successfully!", state);
        // ... (rest of the rendering loop) ...

        // --- RENDERING LOOP ---
        function tick() {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                // I assume you already have the 2D context_process to extract the imageData
                context_process.drawImage(video, 0, 0, 640, 480);
                const imageData = context_process.getImageData(0, 0, 640, 480);

                const activeMarkers = processFrame(state, imageData.data);

                if (activeMarkers.length > 0) {
                    const marker = activeMarkers[0];

                    // Uncomment this line for debugging: if it prints nothing,
                    // the camera is not physically recognizing the marker!
                    // console.log("Marker found! Matrix:", marker.matrixGL);

                    // Apply the calculated pose to our 3D object
                    setMatrix(cube.matrix, marker.matrixGL);

                    cube.visible = true;
                } else {
                    // Hide the cube if the marker is lost
                    cube.visible = false;
                }

                // Draw the WebGL frame
                renderer.render(scene, camera);
            }
            requestAnimationFrame(tick);
        }
        tick();

    } catch (e) {
        console.error("Loading error:", e);
    }
}

start();