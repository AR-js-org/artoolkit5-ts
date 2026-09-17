# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Upgrading from 0.1.0

Three changes need action. Each is described in full further down; this is the
short list for anyone upgrading.

1. **`state.markers` is gone**, replaced by `state.patternMarkers` and
   `state.barcodeMarkers`. Read the one matching the family you registered.
2. **`FrameResult.lost` now holds objects, not numbers** — `LostMarker`
   (`{ id, type }`) rather than a bare ID. This is the one to look for: it does
   not throw, so `lost.forEach((id) => hide(id))` keeps running and silently
   stops matching anything. Use `lost.forEach(({ id }) => hide(id))`, and note
   that `id` alone is no longer unique across families.
3. **Several `configureDetector` option values were respelled** — see the table
   under Changed. TypeScript catches these; plain JavaScript gets a thrown
   `ARToolKitError` naming the option and listing the valid values.

### Added

- `configureDetector(state, opts)` — detector tuning: `detectionMode`, `matrixCodeType`,
  `threshold`, `thresholdMode`, `labelingMode`, `imageProcMode`, `patternRatio`,
  `nearPlane`, `farPlane`, and `minConfidence` (described below). Applies only the
  keys present, so a later call can adjust a single setting mid-session.
- `@ar-js-org/artoolkit5-constants` as a direct dependency (`^0.3.0`). All ARToolKit5
  integers used internally come from it — `src/config.ts` is the only module in
  the codebase that imports one.
- `trackBarcodeMarker(state, barcodeId, markerWidth?)` — registers a barcode
  (matrix code) marker. Unlike a pattern marker there is nothing to load first:
  the ID is encoded in the marker's geometry, not assigned by the engine.
- `MarkerType` (`'pattern' | 'barcode'`) on `MarkerPose`, and `LostMarker`
  (`{ id, type }`) as the element type of `FrameResult.lost`.
- **Independent ID spaces for the two marker families.** `ARToolKitState` now holds
  separate `patternMarkers` and `barcodeMarkers` registries instead of a single
  `markers` map, so a pattern marker and a barcode marker may both be registered
  as `7` and tracked simultaneously. Pattern IDs are engine-assigned from 0 while
  barcode IDs are chosen by whoever printed the marker, so collisions are ordinary
  rather than exceptional — `patt.hiro` is ID `0`. The engine reports each family
  through its own field (`idPatt` / `idMatrix`), and each is matched only against
  its own registry. This mirrors `artoolkit5-js`, which has kept the two separate
  all along. ([#36](https://github.com/AR-js-org/artoolkit5-ts/issues/36))
- **Combined pattern+barcode detection.** `'color_and_matrix'` and `'mono_and_matrix'` detect
  both marker families in a single frame, verified against a real camera rather than a
  mock. This required a fix in the WASM binding, which exposed only a field the engine
  leaves unassigned in those modes
  ([artoolkit5-wasm#23](https://github.com/AR-js-org/artoolkit5-wasm/issues/23)); see
  `docs/DESIGN-detector-and-barcode.md` §9 for the full analysis. `examples/barcode/`
  gained a detection-mode switcher and a per-frame detection log demonstrating it.
- **Match confidence, and a per-family `minConfidence` filter.** `MarkerPose` gains
  `confidence` (0–1, read from the matching family's own `cfPatt`/`cfMatrix`), and
  `configureDetector` gains `minConfidence: { pattern?, barcode? }`.

  Unlike every other detector option this one never reaches the engine: ARToolKit's
  confidence cutoff is a compile-time constant with no setter, so the threshold is
  applied by `processFrame` and can only ever be stricter than the built-in 0.5.

  The families take separate thresholds because their confidences are not comparable,
  and **both default to `0`** — nothing is filtered unless you ask for it. Measured on a
  real camera, the genuine and false ranges overlap for both families: a genuine pattern
  match scored `0.506` against a false one at `0.554`, and a genuine barcode scored
  `0.500` at an awkward angle while a phantom barcode reached `0.867`. The same barcode
  marker ranged `0.500`–`0.967` across viewing angles. Confidence is a continuous quality
  score for both families rather than a verdict, so no threshold avoids both missed
  markers and admitted phantoms; the README documents the measurements and the trade-off.
  ([#38](https://github.com/AR-js-org/artoolkit5-ts/issues/38))
- `examples/barcode/`, tracking a 3x3 matrix code marker. `examples/index.html`
  now links to both examples.

### Changed

- **`configureDetector`'s option values now use spellings also used by AR.js.** This is a
  deliberate public-vocabulary choice; the `artoolkit5-js` peer exposes raw numeric modes
  rather than these strings:

  | was | now |
  |---|---|
  | `'color+matrix'` | `'color_and_matrix'` |
  | `'mono+matrix'` | `'mono_and_matrix'` |
  | `'black-region'` / `'white-region'` | `'black_region'` / `'white_region'` |
  | `'auto-median'` / `'auto-otsu'` / `'auto-bracketing'` | `'auto_median'` / `'auto_otsu'` / `'auto_bracketing'` |
  | `'3x3_hamming63'`, `'4x4_bch_13_9_3'`, … | `'3x3_HAMMING63'`, `'4x4_BCH_13_9_3'`, … |
  | option `pattRatio` | option `patternRatio` |

  `'matrix'` keeps its name — AR.js exposes no equivalent. `thresholdMode` and
  `imageProcMode` have no AR.js counterpart at all, so their values simply follow
  the same snake_case convention for internal consistency.

  This deliberately inherits one wart from AR.js: snake_case for mode names but
  SCREAMING_SNAKE for matrix algorithm suffixes. Matching the ecosystem was judged
  worth more than tidiness in isolation. ([#34](https://github.com/AR-js-org/artoolkit5-ts/issues/34))

- **`FrameResult.lost` is now `LostMarker[]` rather than `number[]`.** It carries
  `type` alongside `id` because the two families have independent ID spaces, so an
  ID on its own can no longer say which marker disappeared. Unlike the respellings
  above this one is silent in plain JavaScript — the array is still iterable and
  still the right length, the elements are simply objects now.

- Depends on `@ar-js-org/artoolkit5-wasm@^0.3.0`, up from `^0.1.3`. `0.3.0` is required,
  not merely preferred: it is the first release to bind `idPatt`/`idMatrix`, without
  which the combined detection modes silently report nothing or the wrong marker.

### Removed

- **`ARToolKitState.markers`**, replaced by the `patternMarkers` and `barcodeMarkers`
  registries described under Added. There is no combined view: the two families have
  independent ID spaces, so merging them back into one map is exactly the collision
  the split exists to prevent.

### Notes

`thresholdMode: 'auto_adaptive'` is not offered: the WebARKitLib build this
library ships compiles that mode's implementation out, and passing it would
silently degrade to `'manual'`.

`matrixCodeType: 'global_id'` is not offered either. The engine decodes that
mode into `markerInfo->globalID`, a 64-bit field the WASM binding does not
expose ([artoolkit5-wasm#29](https://github.com/AR-js-org/artoolkit5-wasm/issues/29)),
so nothing here can read the result. Worse than unreadable, it would alias:
the engine also reports the code through `idMatrix`, where a global ID below
32768 arrives as itself but every larger one arrives as `0`. A barcode
registered as `0` would match every large global-ID marker in view. Re-adding
the option once the field is bound is a non-breaking addition.
([#41](https://github.com/AR-js-org/artoolkit5-ts/issues/41))

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
