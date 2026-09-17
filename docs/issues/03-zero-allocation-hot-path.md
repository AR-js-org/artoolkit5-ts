<!-- filed-as -->
> **Filed as [#5](https://github.com/AR-js-org/artoolkit5-ts/issues/5) — closed.**
> The GitHub issue is the live record; this draft is kept for its design
> reasoning and is not updated. Draft numbering does not match issue
> numbering — always follow the link rather than the filename.

**Title:** perf: eliminate per-frame typed-array allocation in `processFrame`

## Problem

`processFrame` runs on every animation frame, and currently allocates on every detected marker:

- `src/tracking.ts:35` — `new Float32Array(16)` per call
- `src/math.ts:8` — `transMatToGLMat` allocates when no output buffer is passed, and `src/tracking.ts:62` never passes one
- `src/math.ts:35` — `arglCameraViewRHf` allocates a fresh array per call

At 30 fps with 4 markers that is ~360 typed-array allocations per second, producing avoidable GC pressure on exactly the devices least able to absorb it. `AGENTS.md` already states the rule: "Avoid allocating new Float32Arrays in hot paths — reuse buffers where possible."

Note the existing `glMat` output parameter on `transMatToGLMat` was designed for this and is simply unused.

## Fix

- Allocate `tracked.matrix` and `tracked.matrixGL` once in `trackMarker` (already done) and write into them.
- Pass output buffers to both math functions on every call.
- Use one module-scoped scratch `Float32Array(16)` for the intermediate 4×4.

Small per-frame objects (the `detected` array and pose objects) stay freshly allocated — reusing those across frames would be a correctness footgun for consumers holding references.

## Acceptance

- [ ] After warm-up, `processFrame` allocates zero typed arrays
- [ ] A test asserts `matrixGL` identity is stable across frames for a continuously tracked marker
- [ ] Pose values remain numerically identical to the current implementation
