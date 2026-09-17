<!-- filed-as -->
> **Filed as [#8](https://github.com/AR-js-org/artoolkit5-ts/issues/8) — open.**
> The GitHub issue is the live record; this draft is kept for its design
> reasoning and is not updated. Draft numbering does not match issue
> numbering — always follow the link rather than the filename.

**Title:** feat: add `configureDetector` with typed detection options

## Problem

`artoolkit5.wasm` exposes a full tier of detector tuning that the library does not surface at all: `setThreshold`, `setThresholdMode`, `setLabelingMode`, `setImageProcMode`, `setPattRatio`, `setDebugMode`, `setLogLevel`, `setProjectionNearPlane`, `setProjectionFarPlane`.

Threshold mode in particular is the single biggest lever on detection reliability under varying lighting, and it is currently unreachable without dropping to `state.core` directly.

## Proposal

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

## Why string unions rather than the constants package

`@ar-js-org/artoolkit5-constants@0.1.0` generates only detection modes `0`, `1`, `2` — it has no `AR_MATRIX_CODE_*` values and no combined modes. See #13. String unions keep C constants out of the public API and stay stable if the underlying integers ever change, so adopting upstream constants later is not a breaking change.

## Acceptance

- [ ] `configureDetector` exported and documented
- [ ] Internal mapping tables live in one place (`src/config.ts`)
- [ ] Invalid values rejected with `ARToolKitError`
- [ ] Tests assert each option calls the right core setter with the right int
