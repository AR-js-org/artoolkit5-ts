**Title:** spike: verify what `getCameraLens()` actually returns

## Problem

`src/math.ts:4-6` returns `state.core.getCameraLens()` directly as a `Float64Array`:

```ts
export function getCameraProjectionMatrix(state: ARToolKitState): Float64Array {
    return state.core.getCameraLens();
}
```

Every other core getter in this codebase returns a **heap pointer** that must be read via `HEAPF64.subarray(ptr >> 3, ...)` — that is exactly what `processFrame` does with `getTransform()` at `src/tracking.ts:54-58`.

If `getCameraLens` follows the same convention, this function currently returns a raw integer address rather than matrix data, and the example's projection matrix is silently wrong. The webcam example does render, which is weak evidence it returns real data — but that has never been confirmed, and a plausible-looking-but-wrong projection matrix is exactly the kind of bug that survives visual inspection.

## Task

1. Inspect the returned value at runtime — check whether it is a number (pointer) or a typed array.
2. If it is a pointer, read it as `HEAPF64.subarray(ptr >> 3, (ptr >> 3) + 16)`.
3. Confirm the 16 values form a plausible projection matrix (near/far planes reflected, correct aspect).
4. Document the convention in a JSDoc comment so the next reader does not have to re-derive it.

## Note

This does **not** require the `getCameraMatrix` binding drafted in the `.agents` log. `getCameraLens` already exists and supersedes it — see D10 in `docs/DESIGN-v0.1.md`.

## Acceptance

- [ ] Actual return shape documented
- [ ] `getCameraProjectionMatrix` correct for that shape
- [ ] Test locks the behaviour against a mocked core
