# artoolkit5-ts 🎯

[![npm](https://img.shields.io/npm/v/@ar-js-org/artoolkit5-ts.svg?logo=npm&logoColor=white)](https://www.npmjs.com/package/@ar-js-org/artoolkit5-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg?logo=typescript&logoColor=white)](tsconfig.json)
[![Tested with Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18.svg?logo=vitest&logoColor=white)](test)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-ARToolkit5-654FF0.svg?logo=webassembly&logoColor=white)](https://github.com/AR-js-org/artoolkit5-wasm)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#-roadmap)
[![AR.js-next](https://img.shields.io/badge/AR.js--next-engine%20layer-00B4D8.svg)](https://github.com/AR-js-org/AR.js-next)

TypeScript marker tracking for the browser, built on a WebAssembly build of ARToolkit5 (WebARKitLib).

**This is the replacement for [`artoolkit5-js`](https://github.com/AR-js-org/artoolkit5-js)**, which is a fork of [`andypotato/artoolkit5-js`](https://github.com/andypotato/artoolkit5-js) — itself an ES6 module port of artoolkit5.

`artoolkit5-ts` is a rewrite rather than another fork in that line. It is written in TypeScript against a maintained WebAssembly build, and it drops the monolithic `ARController` class those ports carried forward in favour of plain data and free functions. Nothing is hidden behind a class, so nothing has to be constructed before it can be used, tested, or tree-shaken.

> ⚠️ **Status: alpha.** Pattern markers work end to end, but the API is not stable yet — expect breaking changes before 1.0. See [Roadmap](#-roadmap).

## 🧩 Where this fits

`artoolkit5-ts` is the detection engine layer of the AR.js-next ecosystem:

```
AR.js-next                ECS core, event bus, frame pump
  arjs-plugin-artoolkit     ECS plugin: Web Worker, ImageBitmap, marker events
    artoolkit5-ts           ← this library
      artoolkit5-wasm       Emscripten / C++ bindings
        artoolkit5-constants  ARToolkit5 constants, extracted from the headers
```

It is renderer-agnostic and DOM-free. It gives you marker poses as matrices; what you draw with them is your business — Three.js, Babylon.js, raw WebGL, or nothing at all.

## 📦 Installation

```bash
npm install @ar-js-org/artoolkit5-ts
```

[`@ar-js-org/artoolkit5-wasm`](https://www.npmjs.com/package/@ar-js-org/artoolkit5-wasm) (`^0.1.3`) provides the WebAssembly engine. It installs automatically as a dependency, and is left external rather than bundled so the `.wasm` binary is fetched once and cached instead of being copied into every bundle that depends on it.

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

// 3. Per frame: pass RGBA pixels in, get poses out.
//    Draw your video to a canvas and read it back; the library never
//    touches the DOM, so obtaining the pixels is your side of the line.
const pixels = ctx.getImageData(0, 0, 640, 480).data;
const { detected, lost } = processFrame(state, pixels);

for (const marker of detected) {
  // marker.matrixGL is a 4x4 column-major right-handed matrix,
  // ready to hand to WebGL or Three.js.
  // With Three.js, set mesh.matrixAutoUpdate = false once beforehand,
  // or it recomputes the matrix from position/quaternion/scale and
  // discards the pose you just wrote.
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

The `ARController` that `artoolkit5-js` inherited from `jsartoolkit5` was a God Object: it owned the WASM module, the canvas, the video element, marker state and the render loop. That made it impossible to tree-shake, awkward to run in a Worker, and hard to test without a browser.

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

Returns the 4×4 projection matrix ARToolKit computed from your `camera_para.dat`, as a `Float64Array`. Use it in place of a generic perspective camera: it carries the measured focal length and principal point of the actual lens, so rendered geometry lines up with the video rather than merely sitting near it. (Radial distortion is not part of this matrix — no projection matrix can express it. ARToolKit corrects for it separately, when un-distorting detected marker corners.)

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
// The same dimensions the state was created with. Reading back any other
// size gives processFrame a buffer it will misinterpret.
const WIDTH = 640;
const HEIGHT = 480;

const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

function toPixels(bitmap: ImageBitmap): Uint8ClampedArray {
  ctx.drawImage(bitmap, 0, 0, WIDTH, HEIGHT);
  return ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
}
```

A helper that does this is on the roadmap; until then it is a few lines you own.

## ⚠️ Limitations

- **Pattern markers only.** Barcode/matrix markers are planned; NFT is out of scope for this project — see [Roadmap](#-roadmap).
- **No detector tuning yet.** Threshold, threshold mode, labelling mode and related settings are exposed by the engine but not yet surfaced here.
- **Worker support is untested.** Nothing in `src/` touches the DOM, which is necessary but not proof — WASM instantiation in worker scope has not been verified.

## 🗺️ Roadmap

Detailed design lives in [`docs/DESIGN-v0.1.md`](docs/DESIGN-v0.1.md); work is tracked in [issues](https://github.com/AR-js-org/artoolkit5-ts/issues).

**v0.1** (done) — lifecycle, packaging, marker-lost reporting from `processFrame`, a test suite and CI.

**Next** — `configureDetector` for threshold and labelling settings, barcode markers, a verified Worker example, an `ImageBitmap` conversion helper, and multi-marker sets.

**Out of scope** — NFT tracking. This project and `artoolkit5-wasm` cover pattern and barcode markers; NFT belongs to other projects in the ecosystem.

## 🛠️ Development

```bash
npm run dev        # Vite dev server, opens the webcam example
npm run build      # library build (ES + UMD) plus type declarations
npm run preview    # preview the production build
npm test           # run the test suite once
npm run test:watch # re-run tests on change
npm run typecheck  # tsc --noEmit
```

### Tests

[Vitest](https://vitest.dev) covers the matrix maths, the marker visibility state machine and the dispose lifecycle. The suite runs in well under a second because the WASM boundary is faked: `test/mock-core.ts` stands in for the Emscripten module and the bound C++ instance, so neither a browser nor a compiled binary is needed.

The suite aims at the code that fails *quietly* rather than at a line-count target — a transposed matrix still renders, just in the wrong place, and a marker-lost event that fires twice looks fine until something downstream double-handles it.

It is validated by mutation: deliberately breaking the collection order, the `Float32Array` return type, or the continuous-tracking condition each makes exactly one test fail. If you add tests, check they can actually fail.

### Contributing

Branch from `dev`; `main` holds release-ready code only. Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Fuller guidance is in [`AGENTS.md`](AGENTS.md).

### Releasing

Releases are cut by the **Release** workflow, run manually from the Actions tab. Its only required input is the version to publish, without a leading `v` — for example `0.1.0`.

Everything after that is automatic: it runs typecheck, tests and build, sets the version, promotes the changelog, derives release notes from the commits, commits, tags `vX.Y.Z`, creates the GitHub Release and publishes to npm with [provenance](https://docs.npmjs.com/generating-provenance-statements) — so the package carries a verifiable link back to the commit and workflow run that built it.

**Run it with `dry_run` first.** That performs every check and prints the notes and the tarball contents without tagging, committing or publishing. It is the only way to rehearse: npm never allows a published version to be replaced.

Before running for real, the workflow refuses to start unless:

- the version is valid semver, not already tagged, and not already on npm
- the branch is `main`
- the repository is public — npm will not generate provenance from a private repository

Preparing a release means writing the changelog. Add entries to `## [Unreleased]` as you go; the workflow renames that heading to the released version and opens a fresh one. Anything between `<!-- promote:strip -->` markers is dropped during promotion, so notes meant only for editors do not survive into a released section. `npm run release-notes` prints the Conventional Commits since the last tag if you want to see what has accumulated.

It is a single workflow rather than a "create release" and a "publish" pair because a Release created with the default `GITHUB_TOKEN` does not trigger other workflows — GitHub blocks that to prevent recursion, so the second one would silently never fire.

## 📄 Licence

MIT — see [LICENSE](LICENSE).

This library wraps a WebAssembly build of **ARToolkit5 (WebARKitLib), which is licensed under the LGPL v3.0**. The MIT licence covers this TypeScript code, not the engine underneath: redistributing a build that includes the ARToolkit5 (WebARKitLib) WebAssembly binary carries that licence's obligations as well.
