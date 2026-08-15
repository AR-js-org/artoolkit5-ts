# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<!-- promote:strip -->
Nothing has been published yet. Everything below ships in the first release.

The release workflow promotes this section automatically; this note is removed
when it does. Everything between the `promote:strip` markers is dropped, so put
anything here that should not survive into a released section.
<!-- /promote:strip -->

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
- Release workflow publishing to npm with provenance when a GitHub Release is
  published, re-running the checks first and refusing to publish when
  `package.json` disagrees with the release tag.
- `scripts/release-notes.mjs`, which groups Conventional Commits since the
  previous tag so release notes reflect what actually landed.
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

[Unreleased]: https://github.com/AR-js-org/artoolkit5-ts/commits/dev
