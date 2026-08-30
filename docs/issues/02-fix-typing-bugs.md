<!-- filed-as -->
> **Filed as [#4](https://github.com/AR-js-org/artoolkit5-ts/issues/4) — closed.**
> The GitHub issue is the live record; this draft is kept for its design
> reasoning and is not updated. Draft numbering does not match issue
> numbering — always follow the link rather than the filename.

**Title:** fix: correct type errors and eliminate `any` in the public API

## Problems

1. **`arglCameraViewRHf` returns the wrong array type.** `src/math.ts:35` declares parameters as `any` and allocates a `Float64Array(16)`, but `TrackedMarkerState.matrixGL` and `MarkerPose.matrixGL` are typed `Float32Array`. The assignment at `src/tracking.ts:63` therefore stores a `Float64Array` where a `Float32Array` is declared. Consumers reading `matrixGL` per the published types get a different array type than documented — and the AR.js-next marker event contract specifies `Float32Array(16)`.

2. **`processFrame` has no return type.** `src/tracking.ts:34` uses `const detected = []`, inferred as `any[]`. The documented return is `MarkerPose[]`.

3. **`ARToolKitState.mod` and `.core` are `any`.** `src/domain.ts:18-19`. This forces the `@ts-ignore` at `src/init.ts:23` and `src/init.ts:34`, and removes all type safety from every core call.

## Fix

- Type `arglCameraViewRHf(glMatrix: Float32Array, out?: Float32Array, scale?: number): Float32Array` and allocate `Float32Array`.
- Annotate `processFrame` explicitly (see #05 for the final shape).
- Add minimal hand-written `ARToolKitModule` and `ARToolKitCore` interfaces covering only the methods actually called, and delete both `@ts-ignore` comments.

## Acceptance

- [ ] `tsc --noEmit` passes with `strict` and no suppressions in `src/`
- [ ] No `any` in any exported type
- [ ] `matrixGL` is genuinely a `Float32Array` at runtime (asserted in tests)
