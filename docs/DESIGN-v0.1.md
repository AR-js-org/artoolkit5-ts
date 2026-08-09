# artoolkit5-ts — v0.1 Design

**Status:** Approved, pending implementation
**Date:** 2026-08-09
**Author:** Walter Perdan
**Branch:** `dev`

---

## 1. Understanding Summary

- **What:** A typed, data-oriented TypeScript library exposing ARToolKit5 marker tracking to the browser as pure functions operating on an `ARToolKitState` data object.
- **Why:** To replace the God-Object `ARController` design of ARToolKit.js with a composable, tree-shakeable, Worker-friendly API that bundlers can actually optimise.
- **Who for:** AR web developers, and specifically the AR.js-next ecosystem — `artoolkit5-ts` is positioned to replace `@ar-js-org/artoolkit5-js` as the detection engine inside `@ar-js-org/arjs-plugin-artoolkit`.
- **Constraints:** No DOM or renderer code in `src/`; `ARToolKitState` stays a single mutable data container with no methods; `processFrame` runs every animation frame and must not allocate; marker IDs are assigned by the C++ engine and never hardcoded.
- **Non-goals for v0.1:** NFT tracking, multi-marker sets, shipping our own Web Worker, renderer bindings, `imageBitmapToPixels`.

### Ecosystem position

```
AR.js-next                 ECS core, event bus, frame pump
  arjs-plugin-artoolkit      ECS plugin: Web Worker, ImageBitmap, marker events
    artoolkit5-ts            ← this library (replaces artoolkit5-js)
      artoolkit5-wasm        Emscripten / C++ bindings
        artoolkit5-constants generated C constants
```

---

## 2. Verified Facts

These were confirmed by inspection, not assumed. They override earlier design notes in `.agents/`.

| Fact | Evidence | Consequence |
|---|---|---|
| **NFT is impossible today** | No `setupAR2`, no NFT symbol of any kind in `artoolkit5.wasm` | The NFT design in the `.agents` log targets bindings that do not exist. Deferred to v0.2+, blocked upstream. |
| **Barcode is feasible** | `setPatternDetectionMode`, `setMatrixCodeType`, `getMatrixCodeType` present in the wasm binary; constants `AR_MATRIX_CODE_DETECTION: 2`, `BARCODE_MARKER: 1` | Barcode support needs no new C++ work. |
| **`getCameraMatrix` is unnecessary** | `getCameraLens` already exists | The issue draft at the end of the `.agents` log is **moot — do not file it**. |
| **Detector tuning is unexposed** | Binary exposes `setThreshold`, `setThresholdMode`, `setLabelingMode`, `setImageProcMode`, `setPattRatio`, `setDebugMode`, `setLogLevel`, `setProjectionNearPlane`, `setProjectionFarPlane`, `getProcessingImage` | Justifies a `configureDetector` API. |
| **`AR_MATRIX_CODE_*` constants are missing upstream** | `artoolkit5-constants@0.1.0` generates only modes `0`, `1`, `2` | Barcode cannot work from the constants package as published. Values hardcoded locally in v0.1; upstream issue filed. |
| **Combined detection modes are absent upstream** | ARToolKit5's C enum defines `..._COLOR_AND_MATRIX: 3` and `..._MONO_AND_MATRIX: 4`; neither is generated | Simultaneous pattern+barcode should work via raw ints, but is **unverified**. See Risk R2. |
| **`artoolkit5-wasm` does not resolve on npm** | `npm view` returns 404; local copy is `"private": true` at `0.1.1`, installed from a pinned git commit | Blocks npm publication of `artoolkit5-ts`, not GitHub publication. See Risk R1. |
| **`arjs-plugin-artoolkit` already exists** | `@ar-js-org/arjs-plugin-artoolkit@0.1.3`, TypeScript, depends on `@ar-js-org/artoolkit5-js@^0.3.2` | Already runs a Web Worker and consumes `ImageBitmap`. It is our target consumer, and it already owns the threading we therefore do not ship. |

---

## 3. Assumptions

1. **Performance:** 30 fps at 640×480 on a mid-range phone. `processFrame` allocates zero typed arrays after warm-up.
2. **Scale:** Browser library. No server, no telemetry, no persistence. Typical usage 1–8 registered markers.
3. **Security/privacy:** Camera access is the consumer's responsibility. The library's only network access is `fetch` for caller-supplied `.patt` / `camera_para.dat` URLs. No analytics.
4. **Browsers:** Evergreen Chrome, Firefox, Safari. ES2020, WASM required. No polyfills.
5. **Reliability:** Errors are thrown as typed `ARToolKitError`. The library never logs and never swallows failures.
6. **Testing:** Vitest with a mocked `core` for WASM-dependent paths. No browser E2E in v0.1; the examples are the manual smoke test.
7. **Licence:** MIT, matching `artoolkit5-wasm` and `AR.js-next`. The ARToolkit5 (WebARKitLib) LGPLv3 lineage is disclosed explicitly in the README.
8. **Teardown:** `disposeARToolKitState` calls embind's auto-generated `core.delete()`. To be verified at implementation time — no explicit destructor symbol exists in the binary.
9. **Ownership:** Walter Perdan as sole maintainer, under AR-js-org governance.

---

## 4. Design

### 4.1 Module layout

```
src/
  index.ts       public API re-exports
  domain.ts      types only
  errors.ts      NEW — ARToolKitError
  init.ts        createARToolKitState, disposeARToolKitState
  config.ts      NEW — configureDetector, mode tables
  markers.ts     loadPatternMarker, loadBarcodeMarker
  tracking.ts    trackMarker, processFrame
  math.ts        transMatToGLMat, arglCameraViewRHf, getCameraProjectionMatrix

examples/
  webcam/        existing Three.js example, cleaned up
  worker/        NEW — proves worker-compatibility
```

### 4.2 Types

```ts
export type MarkerType = 'pattern' | 'barcode';

export interface MarkerPose {
  id: number;
  type: MarkerType;
  matrix: Float64Array;    // 3x4, row-major, as ARToolKit produces it
  matrixGL: Float32Array;  // 4x4, column-major, right-handed, WebGL-ready
}

export interface FrameResult {
  detected: MarkerPose[];
  lost: number[];          // IDs visible last frame, absent this frame
}

export interface TrackedMarkerState {
  id: number;
  type: MarkerType;
  markerWidth: number;
  inPrevious: boolean;
  inCurrent: boolean;
  matrix: Float64Array;    // reused every frame
  matrixGL: Float32Array;  // reused every frame
}

export interface ARToolKitState {
  readonly mod: ARToolKitModule;
  readonly core: ARToolKitCore;
  readonly width: number;
  readonly height: number;
  markers: Record<number, TrackedMarkerState>;
  disposed: boolean;
}
```

`mod` and `core` get minimal hand-written interfaces covering the methods we call, replacing `any` and the `@ts-ignore` in `init.ts`.

### 4.3 Detector configuration

String-literal unions mapped to ints internally. No raw C constants in the public API.

```ts
export type DetectionMode =
  | 'color' | 'mono' | 'matrix' | 'color+matrix' | 'mono+matrix';

export type MatrixCodeType =
  | '3x3' | '3x3_parity65' | '3x3_hamming63'
  | '4x4' | '4x4_bch_13_9_3' | '4x4_bch_13_5_5';

export interface DetectorOptions {
  detectionMode?: DetectionMode;
  matrixCodeType?: MatrixCodeType;
  threshold?: number;                 // 0–255
  thresholdMode?: 'manual' | 'auto-median' | 'auto-otsu' | 'auto-adaptive';
  imageProcMode?: 'frame' | 'field';
  pattRatio?: number;
  nearPlane?: number;
  farPlane?: number;
}

export function configureDetector(state: ARToolKitState, opts: DetectorOptions): void;
```

Only the keys present are applied, so partial reconfiguration mid-session is safe.

### 4.4 Frame processing

`processFrame` returns `FrameResult`. The `lost` array is derived from the `inPrevious`/`inCurrent` transition the implementation already computes and currently discards — this is what lets `arjs-plugin-artoolkit` emit `markerLost` without duplicating state.

**Zero-allocation rule.** After warm-up no typed array is allocated:

- `tracked.matrix` and `tracked.matrixGL` are allocated once in `trackMarker` and reused.
- `transMatToGLMat` and `arglCameraViewRHf` write into caller-supplied output buffers.
- A module-scoped scratch `Float32Array(16)` holds the intermediate 4×4.

Only the small `detected` / `lost` arrays and the pose objects are fresh per frame; these are cheap and returning reused arrays would be a correctness footgun.

### 4.5 Lifecycle

```ts
export function disposeARToolKitState(state: ARToolKitState): void;
```

Calls `core.delete()`, sets `disposed = true`. Every public function guards on `state.disposed` and throws `ARToolKitError` if called afterwards, turning a WASM-level crash into a clear TypeScript error.

### 4.6 Worker compatibility

No worker ships in the library — `arjs-plugin-artoolkit` already owns its worker. Instead `examples/worker/` proves that `createARToolKitState`, `loadPatternMarker`, and `processFrame` all run inside a `Worker`, with the main thread doing only capture and rendering. If WASM instantiation fails there, that is a wasm-side fix, not an API change.

### 4.7 Integration note for arjs-plugin-artoolkit

`artoolkit5-js` accepts image-like sources and performs canvas conversion internally. `artoolkit5-ts` deliberately does not — it takes RGBA bytes only and keeps `src/` free of any canvas API. On swapping engines, the plugin adds the `ImageBitmap` → pixels step (`OffscreenCanvas` + `drawImage` + `getImageData`, reusing one canvas) inside the worker it already runs. This is the sole integration cost, and it is deliberate: the plugin already owns the frame pump and the ImageBitmap, so it owns pixel extraction too. A shared `imageBitmapToPixels` helper is deferred to v0.2, to be decided from real integration experience.

---

## 5. Decision Log

| # | Decision | Alternatives considered | Rationale |
|---|---|---|---|
| D1 | Scope v0.1 as pattern + barcode | Pattern only; pattern + barcode + NFT | NFT is blocked at the wasm level (verified). Barcode needs no new C++ work, so it is nearly free scope with real user value. |
| D2 | Publish as `AR-js-org/artoolkit5-ts` | Personal repo then transfer; different name | Sits in the established `artoolkit5-*` family and reads correctly as the TypeScript successor to `artoolkit5-js`. |
| D3 | Free rein on API changes | Freeze current signatures | Nothing is published; breaking changes are free now and expensive later. |
| D4 | Typed string unions for detector modes | Fix `artoolkit5-constants` upstream first; raw int passthrough | Unblocks v0.1 without waiting on another repo's release, and keeps C constants out of a TypeScript API. String unions stay stable even if the underlying ints change, so a later switch to upstream constants is not a breaking change. |
| D5 | Design to the `arjs-plugin-artoolkit` contract | Standalone pure engine | Gives the library a real consumer and a migration story, and surfaced three API gaps (lost events, input type, worker safety) that internal cleanup alone would never have revealed. |
| D6 | Worker-compatible, not worker-shipping | Ship an optional worker entry point; defer workers entirely | The target consumer already owns a worker. Shipping ours would duplicate it and add versioned surface area for no gain. |
| D7 | `processFrame` returns `{ detected, lost }` | `MarkerPose[]` only; separate status helper | The transition data is already computed and discarded. Exposing it removes duplicated bookkeeping from every consumer. |
| D8 | Defer `imageBitmapToPixels` to v0.2 | Ship it as an opt-in export; accept `ImageBitmap` in `processFrame` | Keeps `src/` strictly free of canvas APIs and the v0.1 surface minimal. Revisit once real integration shows whether it earns its place. |
| D9 | MIT licence, LGPLv3 lineage disclosed | LGPL-3.0 | Matches `artoolkit5-wasm` and `AR.js-next`. The ARToolkit5 (WebARKitLib) heritage is disclosed rather than silently ignored. |
| D10 | Do not file the `getCameraMatrix` issue | File it as drafted in the `.agents` log | `getCameraLens` already provides this. The draft was written before that was known. |

---

## 6. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | `@ar-js-org/artoolkit5-wasm` does not resolve on npm | Blocks npm publication | v0.1 ships as a GitHub release; npm publication gated on the wasm package. Dependency spec moves from git URL to `^0.1.1` once it resolves. |
| R2 | Combined detection modes (`3`, `4`) unverified | `'color+matrix'` may not work | Test against the real engine. If it misbehaves, document as unsupported and users pick a single mode. String-union API absorbs this without a breaking change. |
| R3 | `AR_MATRIX_CODE_*` values hardcoded locally | Drift from upstream C headers | Upstream issue filed on `artoolkit5-constants`; a single internal table makes the later swap trivial. |
| R4 | Worker init unverified | `examples/worker/` may not work | The example is the proof. Failure indicates a wasm-side fix, not an API change. |
| R5 | `getCameraLens()` return shape unconfirmed | `getCameraProjectionMatrix` may be wrong | Every other core getter returns a heap pointer, but `math.ts` returns this value directly. Verify by runtime inspection before touching it. |
| R6 | `core.delete()` may not exist | `dispose` fails | Embind normally generates it. Verify at implementation; fall back to a no-op with a documented caveat. |

---

## 7. Roadmap beyond v0.1

- **v0.2:** `imageBitmapToPixels` (pending integration experience), multi-marker sets, `getProcessingImage` debug view.
- **v0.3+:** NFT tracking — blocked on `artoolkit5-wasm` exposing `setupAR2` and the KPM bindings.
- **Upstream:** `artoolkit5-constants` to generate `AR_MATRIX_CODE_*` and the combined detection modes.
