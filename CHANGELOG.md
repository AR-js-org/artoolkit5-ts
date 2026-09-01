# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `configureDetector(state, opts)` — detector tuning: `detectionMode`, `matrixCodeType`,
  `threshold`, `thresholdMode`, `labelingMode`, `imageProcMode`, `pattRatio`,
  `nearPlane`, `farPlane`. Applies only the keys present, so a later call can
  adjust a single setting mid-session.
- `@ar-js-org/artoolkit5-constants` as a direct dependency (`^0.3.0`). All ARToolKit5
  integers used internally come from it — `src/config.ts` is the only module in
  the codebase that imports one.

### Changed

- Depends on `@ar-js-org/artoolkit5-wasm@^0.2.0`, up from `^0.1.3`.

### Notes

`thresholdMode: 'auto-adaptive'` is not offered: the WebARKitLib build this
library ships compiles that mode's implementation out, and passing it would
silently degrade to `'manual'`.

## [0.1.0] - 2026-08-16

### Added

- `createARToolKitState` / `disposeARToolKitState` — lifecycle. Dispose calls
  the core's `teardown()` and then Embind's `delete()`; skipping the first leaks
  the ARToolKit handles the instance owns. Idempotent.
- `ARToolKitError`, thrown by every operation called on a disposed state, so a
  use-after-dispose names the misused function instead of crashing somewhere
  inside the WASM module.
- `loadPatternMarker` and `trackMarker` for registering markers.
- `processFrame`, returning `{ detected, lost }`.
- `getCameraProjectionMatrix`, `transMatToGLMat` and `arglCameraViewRHf`.
- Vitest suite covering the matrix maths, the visibility state machine and the
  dispose lifecycle, running without WASM or a browser against a mocked core.
- CI on Node 22 and 24: typecheck, test, build, and a packaging check.
- Release workflow, run manually with a version. It runs the checks, sets the
  version, promotes this changelog, derives notes from the commits, tags,
  creates the GitHub Release and publishes to npm with provenance. A `dry_run`
  input rehearses all of it without tagging or publishing.
- `scripts/release-notes.mjs`, which groups Conventional Commits since the
  previous tag so release notes reflect what actually landed, and
  `scripts/promote-changelog.mjs`, which promotes the Unreleased section.
- Webcam example: camera to Three.js cube overlay.
- This changelog.

### Changed

- `processFrame` returns `{ detected, lost }` rather than `MarkerPose[]`. The
  visibility transition was already computed internally and then discarded,
  forcing consumers to diff successive results to recover it.
- Named `@ar-js-org/artoolkit5-ts`, matching the rest of the organisation.
- Depends on `@ar-js-org/artoolkit5-wasm@^0.1.3` from npm rather than a pinned
  git commit. `three` moved to `devDependencies`; only the examples use it.

### Fixed

- `arglCameraViewRHf` allocated a `Float64Array` while every type declaration
  promised `Float32Array`. Consumers reading `matrixGL` would have received a
  different array type than the published types described, and the AR.js-next
  marker event contract specifies `Float32Array(16)`.
- `processFrame` allocated roughly three typed arrays per marker per frame. Both
  matrix helpers now write into caller-supplied buffers, with one module-scoped
  scratch array for the intermediate 4×4.
- Debug logging removed from `src/`, which dumped the entire WASM module to the
  console on every marker load and every `trackMarker` call.
- `favicon.svg` and orphaned `.d.ts.map` files no longer ship in the package.

### Notes

Pattern markers only. Barcode support is planned; NFT is out of scope for this
project. Worker compatibility is untested — nothing in `src/` touches the DOM,
which is necessary but not proof.

[Unreleased]: https://github.com/AR-js-org/artoolkit5-ts/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AR-js-org/artoolkit5-ts/releases/tag/v0.1.0
