# artoolkit5-ts — Detector Configuration & Barcode Markers Design

**Status:** #8 (`configureDetector`) implemented; #9 (barcode markers) pending, blocked on #8 merging
**Date:** 2026-08-30
**Author:** Walter Perdan
**Issues:** [#8](https://github.com/AR-js-org/artoolkit5-ts/issues/8) (`configureDetector`), [#9](https://github.com/AR-js-org/artoolkit5-ts/issues/9) (barcode markers)
**Branch:** `dev`

---

## 1. Understanding Summary

- **What:** Two sequential additions. First `configureDetector` (#8) — typed detector tuning with string-union options mapped internally to C constants. Then `trackBarcodeMarker` (#9) — barcode/matrix markers registered in the existing marker registry, with `type` reported on every pose.
- **Why:** Barcode markers need no `.patt` file and no network fetch, and detector tuning — threshold mode above all — is the single biggest lever on detection reliability under varying lighting. Both are reachable with zero C++ work.
- **Who for:** Direct consumers of the library, and `arjs-plugin-artoolkit` as the downstream ECS plugin.
- **Key constraint:** `getMarkerInfo` does not bind `idPatt`/`idMatrix`, so pattern-vs-barcode cannot be read from the engine. `type` is derived from our own registry instead, which is only sound while marker IDs are unique.
- **Sequencing:** #9 is blocked by #8. Two separate PRs, one issue per branch.
- **Non-goals:** NFT markers. Multi-marker sets. Binding `idPatt`/`idMatrix` upstream. Worker support (#11). Any change to `ARToolKitState`'s shape.

---

## 2. Verified Facts

Everything in this section was executed or read from source, not inferred.

### Engine surface

All detector methods are present in the shipped `artoolkit5.wasm` (`@ar-js-org/artoolkit5-wasm@0.2.0`), confirmed by symbol search:

`setThreshold`, `getThreshold`, `setThresholdMode`, `setPatternDetectionMode`,
`setMatrixCodeType`, `getMatrixCodeType`, `setLabelingMode`, `setImageProcMode`,
`setPattRatio`, `setDebugMode`, `setLogLevel`, `setProjectionNearPlane`,
`setProjectionFarPlane`

No new C++ work is required for either issue.

### `getMarkerInfo` binds only these fields

From `artoolkit5-wasm/cpp/arjs/artoolkit5/ARToolKitCore.cpp:456-499`:

```
id, dir, cf, area, errorCorrected, pos, line, vertex
```

`idPatt`, `idMatrix`, `dirPatt`, `dirMatrix`, `cfPatt`, `cfMatrix` are **not** exposed — confirmed absent from both the C++ source and the binary.

**Consequence.** In single-mode matrix detection ARToolKit writes the barcode ID into `id`, so the existing detection loop works unchanged. In the **combined** modes `id` holds whichever family won on confidence, with no way to tell which. This is the real risk in #9, and it is not the one the issue records.

### Constants available (`@ar-js-org/artoolkit5-constants@0.3.0`)

Reaching us transitively via `artoolkit5-wasm@0.2.0`. 62 constants total, including all five detection modes (both combined), all eleven matrix code types, and — as of `0.3.0` — the three `arLabelingMode` values: `AR_LABELING_WHITE_REGION` (0), `AR_LABELING_BLACK_REGION` (1), `AR_DEFAULT_LABELING_MODE` (1). **The claims in #8 and #9 that any of this is missing are stale** — they describe `0.1.0`, before the fixes released in `0.2.0` and `0.3.0`.

### One gap resolved during design, one remains

| Gap | Evidence | Handling |
|---|---|---|
| ~~`arLabelingMode` constants not generated~~ **Resolved** | Filed as [artoolkit5-constants#6](https://github.com/AR-js-org/artoolkit5-constants/issues/6), shipped in `constants@0.3.0` | `labelingMode` is back in scope for #8 — see §4.2 and Decision 9 |
| `AR_LABELING_THRESH_MODE_AUTO_ADAPTIVE` silently degrades to `MANUAL` | `AR_DISABLE_THRESH_MODE_AUTO_ADAPTIVE=1` in `config.h` compiles its `case` out; falls through to `default:` | `'auto-adaptive'` omitted from the union — still true, this is an upstream build flag, not a constants-generation gap |

### Numeric ranges

| Value | Rule | Source |
|---|---|---|
| `pattRatio` | `> 0.0` and `< 1.0`, exclusive; default `0.5` | `arCreateHandle.c:363` returns `-1` outside this |
| `threshold` | `0`–`255`; default `100` | `AR_DEFAULT_LABELING_THRESH` |

---

## 3. Assumptions

1. `@ar-js-org/artoolkit5-constants` becomes a **direct** dependency at `^0.3.0`. Zero extra install cost — `artoolkit5-wasm@0.2.0` already requires the same range, so npm dedupes to one copy.
2. All eleven matrix code types get string names, not the six in #8's draft.
3. Combined modes ship, but are claimed to work only after verification against the real engine in the example.
4. `errorCorrected` — barcode-specific and already bound — is not surfaced. YAGNI until asked for.
5. A new `examples/barcode/` is added; the webcam example is untouched.

---

## 4. Design

### 4.1 `src/config.ts` — the only module that knows an integer

Three frozen lookup tables keyed by the string union, every value imported from the constants package. No integer literals anywhere.

```ts
const DETECTION_MODES: Record<DetectionMode, number> = {
    color: AR_TEMPLATE_MATCHING_COLOR,
    mono: AR_TEMPLATE_MATCHING_MONO,
    matrix: AR_MATRIX_CODE_DETECTION,
    'color+matrix': AR_TEMPLATE_MATCHING_COLOR_AND_MATRIX,
    'mono+matrix': AR_TEMPLATE_MATCHING_MONO_AND_MATRIX,
};

const LABELING_MODES: Record<LabelingMode, number> = {
    'white-region': AR_LABELING_WHITE_REGION,
    'black-region': AR_LABELING_BLACK_REGION,
};
```

Typing these as `Record<Union, number>` makes the compiler enforce total coverage: adding a string without a mapping fails the build. That is the drift guard.

### 4.2 Public types

```ts
export type DetectionMode =
    | 'color' | 'mono' | 'matrix' | 'color+matrix' | 'mono+matrix';

export type MatrixCodeType =
    | '3x3' | '3x3_parity65' | '3x3_hamming63'
    | '4x4' | '4x4_bch_13_9_3' | '4x4_bch_13_5_5'
    | '5x5' | '5x5_bch_22_7_7' | '5x5_bch_22_12_5'
    | '6x6' | 'global_id';

export type ThresholdMode =
    | 'manual'          // 0
    | 'auto-median'     // 1
    | 'auto-otsu'       // 2
    | 'auto-bracketing'; // 4
    // 'auto-adaptive' (3) deliberately absent: compiled out upstream

export type ImageProcMode = 'frame' | 'field';

export type LabelingMode = 'white-region' | 'black-region';
// 'black-region' — black-bordered markers on a white background — is the engine default.

export interface DetectorOptions {
    detectionMode?: DetectionMode;
    matrixCodeType?: MatrixCodeType;
    threshold?: number;
    thresholdMode?: ThresholdMode;
    labelingMode?: LabelingMode;
    imageProcMode?: ImageProcMode;
    pattRatio?: number;
    nearPlane?: number;
    farPlane?: number;
}
```

`labelingMode` selects between black-bordered markers on a white background (`'black-region'`, the engine default) and white-bordered markers on a black background (`'white-region'`). It was omitted from the original draft of this design because `artoolkit5-constants@0.2.0` did not generate its values; `0.3.0` does (see §2, Decision 9).

### 4.3 `configureDetector(state, opts)`

Guards with `assertNotDisposed`, then applies **only the keys present**, so partial reconfiguration mid-session is safe. String options are looked up in the tables; a miss throws `ARToolKitError` naming the option and listing the valid values. Numeric options are range-checked before crossing into C.

Validating in TypeScript matters because `arSetPattRatio` merely returns `-1` on a bad value — the failure is otherwise silent, which is the exact class of bug the test suite exists to catch.

### 4.4 `trackBarcodeMarker(state, barcodeId, markerWidth?)`

Named for what it does. A barcode marker involves no loading at all:

| Step | Pattern | Barcode |
|---|---|---|
| Fetch a file | `.patt` over HTTP | nothing to fetch |
| Register with the C++ core | `addMarker` | engine reads the ID off the geometry |
| Add to the JS registry | `trackMarker` | **this is all it needs** |

Calling it `loadBarcodeMarker`, as #9 proposes, would name it after the one thing it does not do, and make it the only synchronous `load*` function in the API.

### 4.5 Unique IDs, and why `type` is trustworthy

`state.markers` stays a flat registry. `trackBarcodeMarker` throws `ARToolKitError` if the ID is already registered as a pattern marker; `trackMarker` gains the mirrored guard.

Because IDs are then unique, `type` is always derivable from the registry and correct in **every** mode, including combined — which is what makes shipping the combined modes honest despite `idMatrix` being unbound.

```ts
trackBarcodeMarker(state, 7);
trackMarker(state, 7);
// ARToolKitError: marker ID 7 is already registered as a barcode marker.
```

Documented limitation: one integer cannot be both a pattern and a barcode marker in the same session.

### 4.6 Pose changes

`TrackedMarkerState` and `MarkerPose` both gain `type: 'pattern' | 'barcode'`, read straight off the registry entry in `collectDetectedPoses`. No per-frame allocation and no extra engine call. Additive — `0.1.x` consumers are unaffected.

---

## 5. Testing Strategy

The suite runs against a **mocked core**. It can prove `detectionMode: 'matrix'` calls `setPatternDetectionMode(2)`; it fundamentally **cannot** prove the engine then detects a barcode. Unit tests verify wiring, not behaviour, and conflating those two is what produced the stale risk section in #9.

**Unit (mocked):** mapping correctness for every option; validation errors for every invalid input; absent keys invoke nothing; collision guards in both directions; `type` propagation through `processFrame`. Plus a test asserting the mapping tables match the constants package, so an upstream value change fails loudly rather than silently mis-detecting.

**`examples/barcode/` (real engine):** the only place combined modes are confirmed. Runtime mode switching so `matrix` and `mono+matrix` can be compared against the same markers. Requires a printed or on-screen matrix marker matching the configured `matrixCodeType`.

**Acceptance:** combined modes are documented as working only after that run. If they misbehave they are documented as unsupported and dropped from the union — non-breaking, since nothing has shipped.

---

## 6. Decision Log

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | #8 first, then #9, as two PRs | Both in one PR; #8 only | Each PR stays small and independently reviewable. #8 has standalone value for pattern-only users. Keeps the one-issue-per-branch rule. |
| 2 | String unions publicly, constants internally | Re-export constants; accept union or raw int | Keeps C naming out of a TypeScript API, gives compile-time typo errors, and stays stable if upstream integers change. The original rationale (incomplete constants) is obsolete; the ergonomic one is not. |
| 3 | One flat registry, collisions rejected at registration | Separate namespaces per family; single-mode only | Makes IDs unique, which is what makes `type` derivable and correct in combined mode. Avoids a breaking change to `ARToolKitState` and does not merely relocate the ambiguity. |
| 4 | `constants` becomes a direct dependency | Keep it transitive; devDependency | We import it directly, so declaring it is honest. Zero extra install cost through deduplication. |
| 5 | `'auto-adaptive'` omitted from the union | Offer and throw; offer with a caveat | A mode that silently degrades to `MANUAL` is the precise failure class our tests target. Re-adding it later is non-breaking. |
| 6 | `labelingMode` omitted; constants issue filed upstream | Add constants upstream first; hardcode `0`/`1` | Hardcoding would break the single-source-of-truth rule that the mapping layer exists to enforce. Blocking on a cross-repo release would stall both issues for a secondary option. |
| 7 | `trackBarcodeMarker`, not `loadBarcodeMarker` | The name in #9; extending `trackMarker` | It performs no I/O and no C++ call — it is a registry operation, which is exactly what `trackMarker` is. Avoids the only synchronous `load*` in the API. |
| 8 | Combined modes ship, verified in the example | Withhold until `idMatrix` is bound | Decision 3 makes `type` correct without `idMatrix`. Verification happens against the real engine before any claim is made. |
| 9 | `labelingMode` re-included in scope, superseding Decision 6 | Leave it deferred to a follow-up issue now that it is unblocked | `artoolkit5-constants#6` shipped in `0.3.0`: `AR_LABELING_WHITE_REGION`, `AR_LABELING_BLACK_REGION`, `AR_DEFAULT_LABELING_MODE` are generated. The reason for the original exclusion no longer holds, and the mapping-table pattern already extends to it with no structural change — deferring further would only cost a second round-trip through this design. |

---

## 7. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Combined modes misbehave in the real engine | Verified in `examples/barcode/` before being documented as supported. Dropping them from the union is non-breaking. |
| R2 | `type` is wrong if IDs are not unique | Uniqueness is enforced at registration, not assumed. Both registration paths guard. |
| R3 | A constants upgrade changes an integer | Mapping tables asserted against the package in tests. Values are inlined at our build time, so shipped behaviour matches what was tested. |
| R4 | `labelingMode` stays unavailable | **Resolved.** `artoolkit5-constants#6` shipped in `0.3.0`; `labelingMode` is in scope per Decision 9. |
| R5 | Mocked tests give false confidence about detection | Explicitly scoped: unit tests cover wiring only. Behaviour is confirmed in the browser example. |

---

## 8. Follow-up Work

All items below were open when this design was first written. All are now done, kept here as the record of what this design triggered elsewhere.

- ~~**artoolkit5-constants#6**~~ — done. Generated `arLabelingMode` and `arMarkerExtractionMode`; shipped in `0.3.0`.
- ~~**artoolkit5-constants#2**~~ — done. Verified resolved by `0.2.0` and closed.
- ~~**Correct #8 and #9**~~ — done. Stale `constants@0.1.0` rationale replaced, #9's `#06` reference fixed to #8, matrix type list expanded from six to eleven, #9's combined-mode risk replaced with the `getMarkerInfo` finding.
- ~~**`docs/issues/*.md`**~~ — done. Each draft carries a header mapping it to its filed issue number.
- **Upstream (optional, still open)** — bind `idPatt`/`idMatrix`/`cfPatt`/`cfMatrix` in `artoolkit5-wasm` so pattern-vs-barcode could be read from the engine rather than derived. Not needed given Decision 3.
- **`@ar-js-org/artoolkit5-wasm` bumped to `^0.2.0`** (this repo), reaching `constants@0.3.0` and unblocking `labelingMode` — see Decision 9.
