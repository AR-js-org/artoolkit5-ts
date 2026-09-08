# artoolkit5-ts — Detector Configuration & Barcode Markers Design

**Status:** #8 (`configureDetector`) implemented and merged. #9 (barcode markers) implemented for single-mode detection. #33 (combined-mode verification) designed and implemented, but **blocked**: combined modes cannot work until `artoolkit5-wasm` binds `idPatt`/`idMatrix` — see §9 Outcome.
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

**`examples/barcode/` (real engine):** implemented, scoped to single-mode detection only (`detectionMode: 'matrix'`), against a real, verified `3x3` marker (ID 5, sourced from `WebARKitLib.rs`'s own test fixtures rather than hand-generated — getting a matrix marker's bit encoding wrong is not something a unit test would catch). This confirms barcode detection works end to end. It does **not** confirm combined-mode detection: no runtime mode switcher was built, and the example was deliberately kept to one family at a time.

**Acceptance:** single-mode barcode detection is confirmed. Combined-mode detection is implemented and typed but **not yet run against the real engine** — narrower than originally planned. See Decision 10.

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
| 10 | `examples/barcode/` scoped to single-mode detection, narrowing Decision 8 | Build the runtime mode switcher and verify combined modes now, as originally planned | A real, verified `3x3` marker became available (sourced from `WebARKitLib.rs`'s own test fixtures) partway through implementation, which unblocked single-mode verification immediately. Combined-mode verification needs a second marker, a mode-switching UI, and a second round of manual confirmation — a deliberately separate, smaller step rather than folding it into an already-large PR. Decision 8's claim ("verified in the example") is correspondingly narrower than first written: single-family detection is verified, combined-family detection is implemented and typed but not yet run against the real engine. |

---

## 7. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Combined modes misbehave in the real engine | **Open, per Decision 10.** `examples/barcode/` verifies single-family detection only; combined modes remain implemented and typed but unrun against the real engine. Dropping them from the union, if they turn out not to work, is still non-breaking — nothing depends on them yet. |
| R2 | `type` is wrong if IDs are not unique | Uniqueness is enforced at registration, not assumed. Both registration paths guard. |
| R3 | A constants upgrade changes an integer | Mapping tables asserted against the package in tests. Values are inlined at our build time, so shipped behaviour matches what was tested. |
| R4 | `labelingMode` stays unavailable | **Resolved.** `artoolkit5-constants#6` shipped in `0.3.0`; `labelingMode` is in scope per Decision 9. |
| R5 | Mocked tests give false confidence about detection | Explicitly scoped: unit tests cover wiring only. Behaviour is confirmed in the browser example. |

---

## 8. Follow-up Work

Most items below were open when this design was first written and are now done, kept here as the record of what this design triggered elsewhere. One — combined-mode verification — is still genuinely open; see Decision 10.

- ~~**artoolkit5-constants#6**~~ — done. Generated `arLabelingMode` and `arMarkerExtractionMode`; shipped in `0.3.0`.
- ~~**artoolkit5-constants#2**~~ — done. Verified resolved by `0.2.0` and closed.
- ~~**Correct #8 and #9**~~ — done. Stale `constants@0.1.0` rationale replaced, #9's `#06` reference fixed to #8, matrix type list expanded from six to eleven, #9's combined-mode risk replaced with the `getMarkerInfo` finding.
- ~~**`docs/issues/*.md`**~~ — done. Each draft carries a header mapping it to its filed issue number.
- ~~**`@ar-js-org/artoolkit5-wasm` bumped to `^0.2.0`**~~ — done (this repo), reaching `constants@0.3.0` and unblocking `labelingMode` — see Decision 9.
- **Combined-mode verification** — design below, §9. Implementation tracked in [#33](https://github.com/AR-js-org/artoolkit5-ts/issues/33).
- **Upstream (optional, still open)** — bind `idPatt`/`idMatrix`/`cfPatt`/`cfMatrix` in `artoolkit5-wasm` so pattern-vs-barcode could be read from the engine rather than derived. Not needed given Decision 3.

---

## 9. Combined-Mode Verification Design (Issue #33)

Brainstormed with `/brainstorming` before implementation, per this project's convention. Full understanding-lock and incremental design walkthrough happened in conversation; this section is the persisted record.

### Verified before designing, not assumed

Went in suspecting `'color+matrix'` might be a non-starter, since this library hardcodes luma conversion (`CONVERT_TO_LUMA = true` in `tracking.ts`). Checked the C++ before letting that shape the design: `ARToolKitCore::passVideoData` computes luma **in addition to** retaining the full RGBA frame, and `detectMarker()` passes both to the engine (`buff.buff` = RGBA, `buff.buffLuma` = luma). Default `pixFormat` is `AR_PIXEL_FORMAT_RGBA`, matching what a browser's `getImageData()` provides, and `arPattGetID.c`'s color-extraction path explicitly handles `AR_PIXEL_FORMAT_RGBA`. So there is no structural reason `'color+matrix'` can't work through this wrapper — that hypothesis was wrong, corrected before it reached the design.

Also confirmed: matrix-code (barcode) detection reads from a code path independent of the `COLOR`/`MONO` choice in `arPattGetID.c` — only the *pattern* half of detection is actually affected by which combined mode is selected. Whether the `.patt` reference format matches correctly under `COLOR` vs `MONO` extraction is not resolvable by reading more source; that is exactly what running the real test determines.

### Design

Extends `examples/barcode/` in place (no new example, no shared module between examples — each stays self-contained, matching #31's precedent):

- Both markers registered unconditionally at startup — the existing Hiro pattern marker (`loadPatternMarker` + `trackMarker`) alongside the existing `3x3` barcode marker. Harmless under plain `'matrix'` mode: the template-matching pass simply never runs for that mode, so the pattern marker is registered but never matched until a combined mode is selected.
- A `detectionMode` dropdown (`'matrix'` / `'mono+matrix'` / `'color+matrix'`, defaulting to `'matrix'`), applying changes through one `applyDetectionMode(state, mode)` function shared with the initial call, so the default and the switch can't drift apart.
- A text log, updated every frame from the full `detected` array (`id N (pattern|barcode)`, comma-separated, or `none`) — not a second 3D object. Chosen as the verification signal specifically because it's unambiguous: reading two labelled entries proves both were found, with no risk of misreading overlapping or mis-posed 3D geometry. The log runs in every mode, not just combined ones, so the same line visibly grows from one entry to two the moment the mode changes.
- `examples/barcode/`'s name and `examples/index.html`'s description stay as they are, with the on-page copy updated to mention combined-mode testing. Combined detection is still fundamentally a barcode-detection question — the modes exist to add matrix detection *on top of* pattern detection — so the folder's subject has grown by one comparison feature, not changed.

### Decision Log

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | Extend `examples/barcode/` in place | New `examples/combined/` | Least duplication; natural single page for "compare without restarting", which is what the issue asks for |
| 2 | Test both `'mono+matrix'` and `'color+matrix'` | `'mono+matrix'` only | Genuinely separate code paths (verified in `arPattGetID.c`); marginal extra cost once the switcher exists |
| 3 | Text log, not a second 3D object | Second cube/sphere for the barcode marker | Unambiguous verification signal; avoids extending `showMarker` for what is a diagnostic tool, not a demo |
| 4 | Manual dropdown, not auto-cycling | Timer-driven mode cycling every N seconds | Verification needs a mode held steady while positioning markers in frame, not one that changes underneath the tester |
| 5 | Both markers registered unconditionally at startup | Register conditionally per mode | Simpler; inert in `'matrix'` mode rather than actually harmful |
| 6 | Mode changes funnel through one `applyDetectionMode` function | Separate initial call and `onchange` handler | Can't drift apart; single source of truth for what "set the mode" means |
| 7 | Doc updates (README/CHANGELOG/this doc) deferred until real results come back | Update proactively based on expected behaviour | Nothing is verified until the page is actually run with a camera; writing the outcome before observing it is the mistake [[verify-do-not-reason]] exists to prevent |
| 8 | `examples/barcode/` keeps its name; descriptions updated in place | Rename to a broader name; split into `examples/combined/` | Avoids rename churn across README, CHANGELOG, and this doc's own §5/Decision 10/R1, all of which already name this path; the name still fits the (grown) scope |

### Outcome, recorded here once known

**Combined modes do not work, and cannot be fixed in this repository.** Verified on a real camera with a Hiro pattern marker and a 3x3 barcode marker (ID 5): `'matrix'` alone detects the barcode correctly, while `'mono+matrix'` and `'color+matrix'` detect nothing — or intermittently render a small, flashing, mispositioned cube.

Root cause. `ARMarkerInfo` carries three families of result fields, and `ar.h:197-215` documents their validity precisely: `.id`/`.dir`/`.cf` are valid only when detection is pattern-only **or** matrix-only, *"but not both"*; `.idPatt`/`.dirPatt`/`.cfPatt` are valid whenever the mode *includes* pattern matching, and `.idMatrix`/`.dirMatrix`/`.cfMatrix` whenever it *includes* matrix detection. In the two combined modes the engine populates the latter two families and never assigns `.id`. This is deliberate — with both families active there is no single correct answer to "what is this marker's ID" — and it is implemented consistently in `arGetMarkerInfo.c` and in both of `arDetectMarker.c`'s combined-mode branches (history carryover at L251-276, confidence cutoff at L352-363), neither of which touches `.id`.

`artoolkit5-wasm`'s `getMarkerInfo()` binds only the `.id` family, so `tracking.ts` reads a field the engine never wrote. Because the handle is `arMalloc`'d without initialising `markerInfo`, and that array is reused every frame without clearing, the read returns uninitialised heap or a leftover from a different square in an earlier frame. On a zero-filled WASM heap it returns `0` — a *valid* marker ID, and almost certainly the Hiro pattern's — which is why the symptom is a plausible-looking wrong detection rather than a clean miss.

Corrected mid-investigation: this was first diagnosed as a missing `else` branch in `arGetMarkerInfo.c`. That was wrong. There is no missing branch; the engine is behaving as documented, and the defect is on our side of the boundary.

Reference implementation. AR.js reads `marker.idPatt` for pattern markers and `marker.idMatrix` for barcode markers (`arjs-markercontrols.js:308,315`), gating both on `cfPatt`/`cfMatrix`, and never reads `.id` anywhere. Its `Context` exposes no matrix-only mode at all (`['color', 'color_and_matrix', 'mono', 'mono_and_matrix']`), so combined modes are AR.js's *only* barcode path — strong evidence the approach works once the right fields are readable.

Consequences for this design:

- **R1 is realised.** `'color+matrix'` and `'mono+matrix'` stay in the `DetectionMode` union but must not be documented as supported until the binding is fixed. Nothing has shipped, so no consumer is affected yet.
- **The #33 branch is held, not merged.** Merging would publish two modes that silently return nothing.
- **A second gap surfaced.** Confidence is not exposed at all, so consumers cannot filter above the engine's built-in `AR_CONFIDENCE_CUTOFF_DEFAULT` of `0.5` (`arConfig.h:120`). AR.js defaults its own `minConfidence` to `0.6`. This matters most in combined mode, where template matching runs against every square including barcode ones. Needs the same binding change.
- **`globalID` is unreachable too.** `matrixCodeType: 'global_id'` is selectable but its 64-bit result is not bound, so that code type cannot currently be used.

Blocked on `artoolkit5-wasm` binding `idPatt`/`idMatrix`/`dirPatt`/`dirMatrix`/`cfPatt`/`cfMatrix` (and ideally `globalID`), plus a WASM rebuild.
