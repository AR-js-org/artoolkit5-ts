// examples/webcam/main.ts
// Data-Oriented composable example: uses pure functions instead of a monolithic controller

import * as THREE from 'three';
import {
  createARToolKitState,
  loadPatternMarker,
  processFrame,
  trackMarker,
  getCameraProjectionMatrix,
  type MarkerPose,
} from '../../src/index';

//@ts-ignore
import wasmUrl from '/node_modules/@ar-js-org/artoolkit5-wasm/dist/artoolkit5.wasm?url';

// Helper to apply ARToolKit matrices to Three.js matrix objects
const setMatrix = (matrix: any, value: Float32Array | Float64Array): void => {
  const array = Array.from(value);
  if (typeof matrix.elements.set === 'function') {
    matrix.elements.set(array);
  } else {
    matrix.elements = array;
  }
};

async function start(): Promise<void> {
  try {
    // --- 1. DOM SETUP ---
    const appDiv = document.getElementById('app');
    if (!appDiv) {
      console.error('Div #app not found!');
      return;
    }

    appDiv.style.position = 'relative';
    appDiv.style.width = '640px';
    appDiv.style.height = '480px';

    // Create video element
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
    video.style.zIndex = '0';
    appDiv.appendChild(video);

    // Off-screen canvas for pixel extraction
    const canvasProcess = document.createElement('canvas');
    canvasProcess.width = 640;
    canvasProcess.height = 480;
    const ctxProcess = canvasProcess.getContext('2d', { willReadFrequently: true })!;

    // --- 2. CAMERA SETUP ---
    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' },
        audio: false,
      });

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });
    } catch (err) {
      console.error('Camera error:', err);
      return;
    }

    // --- 3. AR INITIALIZATION (Data-Oriented) ---
    console.log('WASM URL:', wasmUrl);

    // Create AR context (encapsulates WASM instance, camera params, marker tracking state)
    const state = await createARToolKitState(640, 480, './data/camera_para.dat', wasmUrl);

    // Load marker pattern and register for tracking
    const markerId = await loadPatternMarker(state, './data/patt.hiro');
    trackMarker(state, markerId, 1.0);

    // --- 4. THREE.JS SETUP ---
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(640, 480);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '1';
    appDiv.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Camera with ARToolKit projection matrix
    const camera = new THREE.PerspectiveCamera(60, 640 / 480, 0.1, 10000);
    const projMatrix = getCameraProjectionMatrix(state);
    setMatrix(camera.projectionMatrix, projMatrix);
    camera.matrixAutoUpdate = false;
    scene.add(camera);

    // Test cube overlay
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.translate(0, 0, 0.5);
    const material = new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.8 });
    const cube = new THREE.Mesh(geometry, material);
    cube.matrixAutoUpdate = false;
    cube.visible = false;
    scene.add(cube);

    console.log('AR context initialized:', state);

    // --- 5. RENDERING LOOP (Process frames and update scene) ---
    const tick = (): void => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Extract video pixels using off-screen canvas
        ctxProcess.drawImage(video, 0, 0, 640, 480);
        const imageData = ctxProcess.getImageData(0, 0, 640, 480);

        // Process frame: detect markers, extract poses (pure function)
        const markers: MarkerPose[] = processFrame(state, imageData.data);

        // Update 3D scene based on detected markers
        if (markers.length > 0) {
          const marker = markers[0];
          setMatrix(cube.matrix, marker.matrixGL);
          cube.visible = true;
        } else {
          cube.visible = false;
        }

        renderer.render(scene, camera);
      }
      requestAnimationFrame(tick);
    };

    tick();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

start().catch(console.error);