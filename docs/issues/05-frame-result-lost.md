<!-- filed-as -->
> **Filed as [#7](https://github.com/AR-js-org/artoolkit5-ts/issues/7) — closed.**
> The GitHub issue is the live record; this draft is kept for its design
> reasoning and is not updated. Draft numbering does not match issue
> numbering — always follow the link rather than the filename.

**Title:** feat: `processFrame` returns detected poses and lost marker IDs

## Problem

`processFrame` computes marker visibility transitions and then throws half of them away. `src/tracking.ts:28-32` maintains `inPrevious`/`inCurrent` for every registered marker, but the return value contains only currently-visible markers.

Any consumer wanting a "marker lost" signal must therefore re-implement the diff it already paid for. `@ar-js-org/arjs-plugin-artoolkit` emits `markerFound` / `markerUpdated` / `markerLost`, so this bookkeeping is duplicated downstream today.

## Proposal

```ts
export interface FrameResult {
  detected: MarkerPose[];  // visible this frame
  lost: number[];          // visible last frame, not this frame
}

export function processFrame(
  state: ARToolKitState,
  videoFrame: Uint8ClampedArray
): FrameResult;
```

`detected` entries gain a `type: 'pattern' | 'barcode'` field (see #07). Found-versus-updated is derivable by the consumer from `inPrevious`, or directly: a marker in `detected` that was not in the previous frame's `detected` is "found".

## Breaking change

Yes — the return type changes from an array to an object. Acceptable: nothing is published yet (D3).

## Acceptance

- [ ] `FrameResult` exported from `index.ts`
- [ ] `lost` is populated exactly once on the transition frame, then empty
- [ ] Tests cover found → updated → lost → re-found against a mocked core
- [ ] `examples/webcam/main.ts` updated
