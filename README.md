# artoolkit5-ts 🎯

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg?logo=typescript&logoColor=white)](tsconfig.json)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-ARToolkit5-654FF0.svg?logo=webassembly&logoColor=white)](https://github.com/AR-js-org/artoolkit5-wasm)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#-roadmap)
[![AR.js-next](https://img.shields.io/badge/AR.js--next-engine%20layer-00B4D8.svg)](https://github.com/AR-js-org/AR.js-next)

TypeScript marker tracking for the browser, built on a WebAssembly build of ARToolkit5 (WebARKitLib).

A composable, tree-shakeable alternative to the monolithic `ARController` of ARToolKit.js: state is plain data, operations are functions, and nothing is hidden behind a class.

> ⚠️ **Status: alpha.** Pattern markers work end to end. The API is not yet stable and the package is not yet on npm. See [Roadmap](#-roadmap).

## 🧩 Where this fits

`artoolkit5-ts` is the detection engine layer of the AR.js-next ecosystem:

```
AR.js-next                ECS core, event bus, frame pump
  arjs-plugin-artoolkit     ECS plugin: Web Worker, ImageBitmap, marker events
    artoolkit5-ts           ← this library
      artoolkit5-wasm       Emscripten / C++ bindings
```

It is renderer-agnostic and DOM-free. It gives you marker poses as matrices; what you draw with them is your business — Three.js, Babylon.js, raw WebGL, or nothing at all.

## 📦 Installation

```bash
npm install github:AR-js-org/artoolkit5-ts
```

[`@ar-js-org/artoolkit5-wasm`](https://www.npmjs.com/package/@ar-js-org/artoolkit5-wasm) (`^0.1.3`) provides the WebAssembly engine. It installs automatically as a dependency, and is kept external rather than bundled so it is fetched once and cached.

`@ar-js-org/artoolkit5-ts` is not on npm yet — install it from GitHub until the first release.

`three` is only needed to run the examples, not the library.

## 🚀 Quick start

```typescript
import {
  createARToolKitState,
  loadPatternMarker,
  trackMarker,
  processFrame,
} from '@ar-js-org/artoolkit5-ts';

// 1. Initialise once — loads the WASM module and camera calibration
const state = await createARToolKitState(640, 480, './data/camera_para.dat');

// 2. Register the markers you care about.
//    The ID is assigned by the engine — never hardcode it.
const markerId = await loadPatternMarker(state, './data/patt.hiro');
trackMarker(state, markerId, 1.0);

// 3. Per frame: pass RGBA pixels in, get poses out
const { detected, lost } = processFrame(state, pixels);

for (const marker of detected) {
  // marker.matrixGL is a 4x4 column-major right-handed matrix,
  // ready to hand to WebGL or Three.js
  mesh.matrix.fromArray(marker.matrixGL);
}

// `lost` holds markers that were visible last frame and are not now —
// reported once, on the frame they disappear
for (const id of lost) {
  hideObjectFor(id);
}
```

A complete working example lives in [`examples/webcam`](examples/webcam) — webcam capture, marker tracking and a Three.js cube overlay:

```bash
npm run dev
```

You will need the [Hiro marker](https://commons.wikimedia.org/wiki/File:Hiro_marker_wikipedia.png) printed or on a second screen.

## 🧠 Why functions instead of a controller class

The original `ARController` was a God Object: it owned the WASM module, the canvas, the video element, marker state and the render loop. That made it impossible to tree-shake, awkward to run in a Worker, and hard to test without a browser.

Here, `ARToolKitState` is a plain data container with no methods, and every operation takes it as its first argument:

- **Tree-shakeable** — you bundle only the functions you import
- **Testable** — functions take input and return output; no mocking a class hierarchy
- **Worker-friendly** — no DOM anywhere in `src/`, so state can live off the main thread
- **Framework-agnostic** — nothing assumes React, Vue, or any renderer

The trade-off is deliberate: this library will not open your camera, create a canvas, or run a render loop for you. Those belong to your application.

## 📖 API

### `createARToolKitState(width, height, cameraUrl, wasmUrl?)`

Initialises the WASM module and camera parameters. Returns `Promise<ARToolKitState>`.

| Parameter | Type | Description |
|---|---|---|
| `width` | `number` | Frame width; must match the frames you pass to `processFrame` |
| `height` | `number` | Frame height |
| `cameraUrl` | `string` | URL of an ARToolKit `camera_para.dat` calibration file |
| `wasmUrl` | `string?` | Explicit URL for `artoolkit5.wasm`. Required when your bundler rewrites asset paths, as Vite does |

### `loadPatternMarker(state, markerUrl)`

Downloads a `.patt` file, writes it to the WASM virtual filesystem and registers it. Returns `Promise<number>` — the engine-assigned marker ID.

Loading a marker does not start tracking it; pass the ID to `trackMarker`.

### `trackMarker(state, pattId, markerWidth?)`

Registers a marker for tracking and allocates its reusable pose buffers.

`markerWidth` defaults to `1.0`. Whatever unit you choose here is the unit all returned translations are expressed in — use millimetres if you want millimetres.

### `processFrame(state, videoFrame)`

Detects registered markers in one frame. Returns a `FrameResult`:

```typescript
interface FrameResult {
  detected: MarkerPose[];  // visible in this frame
  lost: number[];          // IDs visible last frame, gone in this one
}
```

`lost` is reported **exactly once**, on the frame a marker disappears — it does not repeat while the marker stays absent. Tracking already computes this transition internally, so exposing it saves every consumer from diffing successive results to recover it.

`videoFrame` is a `Uint8ClampedArray` of RGBA pixels matching the width and height the state was created with — typically `ctx.getImageData(...).data`.

This runs on every animation frame and allocates no typed arrays: poses are written into buffers owned by the marker's tracking state, and **those buffers are reused next frame**. Copy the values if you need to retain them.

### `disposeARToolKitState(state)`

Releases the WASM resources the state holds. Call it when tracking stops — otherwise a page that starts and stops AR leaks the C++ instance and its heap allocations every time.

```typescript
const state = await createARToolKitState(640, 480, cameraUrl);
// … track markers …
disposeARToolKitState(state);
```

Safe to call more than once. Afterwards every other operation on that state throws `ARToolKitError` rather than reaching freed memory, so a use-after-dispose gives you a clear message instead of a crash inside the WASM module.

### `ARToolKitError`

Thrown for misuse of this API — currently, using a state after disposing it. Distinct from a plain `Error` so you can tell an API mistake apart from a failure inside the WASM module or your own code.

### `getCameraProjectionMatrix(state)`

Returns the projection matrix ARToolKit computed from your `camera_para.dat`, accounting for real lens distortion — which a generic perspective camera cannot.

### `transMatToGLMat(transMat, out?)` / `arglCameraViewRHf(glMatrix, out?, scale?)`

Matrix helpers, exported because they are occasionally useful directly. `processFrame` already applies both.

ARToolKit produces a 3×4 row-major pose; WebGL wants a 4×4 column-major matrix in a right-handed system. `transMatToGLMat` expands the matrix, `arglCameraViewRHf` negates the Y and Z axes. Without the second step, poses render behind the camera.

Both take an optional output buffer — supply one in hot paths to avoid allocating.

### Types

`ARToolKitState`, `MarkerPose`, `FrameResult`, `TrackedMarkerState`, plus `ARToolKitModule`, `ARToolKitCore` and `MarkerInfo` describing the WASM boundary.

```typescript
interface MarkerPose {
  id: number;
  matrix: Float64Array;    // 3x4, row-major, as ARToolKit produces it
  matrixGL: Float32Array;  // 4x4, column-major, right-handed, WebGL-ready
}
```

## 🖼️ Feeding frames from an ImageBitmap

`processFrame` takes raw pixels, so `src/` never touches a canvas API. If your frames arrive as `ImageBitmap` — as they do in AR.js-next — convert them yourself, reusing one canvas rather than creating one per frame:

```typescript
const canvas = new OffscreenCanvas(640, 480);
const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

function toPixels(bitmap: ImageBitmap): Uint8ClampedArray {
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
}
```

A shared helper for this is under consideration for a future release.

## ⚠️ Limitations

- **Pattern markers only.** Barcode/matrix markers are planned; NFT is out of scope for this project — see [Roadmap](#-roadmap).
- **No detector tuning yet.** Threshold, threshold mode, labelling mode and related settings are exposed by the engine but not yet surfaced here.
- **Worker support is untested.** Nothing in `src/` touches the DOM, which is necessary but not proof — WASM instantiation in worker scope has not been verified.

## 🗺️ Roadmap

Detailed design lives in [`docs/DESIGN-v0.1.md`](docs/DESIGN-v0.1.md); work is tracked in [issues](https://github.com/AR-js-org/artoolkit5-ts/issues).

**v0.1** — lifecycle (done), packaging (done), marker-lost reporting from `processFrame` (done), tests and CI.

**Later** — `configureDetector`, barcode markers, a verified Worker example, an `ImageBitmap` conversion helper, and multi-marker sets.

**Out of scope** — NFT tracking. This project and `artoolkit5-wasm` cover pattern and barcode markers; NFT belongs to other projects in the ecosystem.

## 🛠️ Development

```bash
npm run dev      # Vite dev server, opens the webcam example
npm run build    # library build (ES + UMD) plus type declarations
npm run preview  # preview the production build
```

Branch from `dev`; `main` holds release-ready code only. Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Contributor guidance is in [`AGENTS.md`](AGENTS.md).

## 📄 Licence

MIT — see [LICENSE](LICENSE).

This library wraps a WebAssembly build of **ARToolkit5 (WebARKitLib), which is licensed under the LGPL v3.0**. The MIT licence covers this TypeScript code, not the engine underneath: redistributing a build that includes the ARToolkit5 (WebARKitLib) WebAssembly binary carries that licence's obligations as well.
