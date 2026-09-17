<!-- filed-as -->
> **Filed as [AR-js-org/artoolkit5-constants#2](https://github.com/AR-js-org/artoolkit5-constants/issues/2) — closed.**
> The GitHub issue is the live record; this draft is kept for its design
> reasoning and is not updated. Draft numbering does not match issue
> numbering — always follow the link rather than the filename.

**Title:** Missing `AR_MATRIX_CODE_*` values and combined detection modes

> **File this on `AR-js-org/artoolkit5-constants`, not on `artoolkit5-ts`.**

## Problem

`@ar-js-org/artoolkit5-constants@0.1.0` generates only three pattern detection modes:

```js
export const AR_TEMPLATE_MATCHING_COLOR = 0;
export const AR_TEMPLATE_MATCHING_MONO = 1;
export const AR_MATRIX_CODE_DETECTION = 2;
```

Two groups of values used by ARToolKit5 are absent.

### 1. Combined detection modes

ARToolKit5's C enum also defines:

- `AR_TEMPLATE_MATCHING_COLOR_AND_MATRIX = 3`
- `AR_TEMPLATE_MATCHING_MONO_AND_MATRIX = 4`

These allow pattern and barcode markers to be detected **simultaneously**, which is the only way to mix marker families in one scene. Without them, consumers must guess the raw integers.

### 2. Matrix code types

`ARToolKitCore::setMatrixCodeType` is exposed in the wasm binary, but no `AR_MATRIX_CODE_*` constant is generated at all:

- `AR_MATRIX_CODE_3x3`, `AR_MATRIX_CODE_3x3_PARITY65`, `AR_MATRIX_CODE_3x3_HAMMING63`
- `AR_MATRIX_CODE_4x4`, `AR_MATRIX_CODE_4x4_BCH_13_9_3`, `AR_MATRIX_CODE_4x4_BCH_13_5_5`

**Barcode marker support is therefore impossible using this package alone** — the setter is reachable but no valid argument is exported.

## Impact

`artoolkit5-ts` hardcodes these values locally in v0.1 to unblock barcode support, which risks drift from the upstream C headers. Once generated here, it can delegate.

## Request

Extend the Embind extraction to emit both groups. If the generator only walks constants explicitly registered in the bindings, the underlying `artoolkit5-wasm` bindings may need to register them first — worth confirming which layer is the gap.
