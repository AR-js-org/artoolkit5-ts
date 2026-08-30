<!-- filed-as -->
> **Filed as [#13](https://github.com/AR-js-org/artoolkit5-ts/issues/13) — closed.**
> The GitHub issue is the live record; this draft is kept for its design
> reasoning and is not updated. Draft numbering does not match issue
> numbering — always follow the link rather than the filename.

**Title:** test: add Vitest suite with a mocked core

## Problem

There are no tests. The library is arithmetic over a WASM boundary — matrix conversions and visibility state machines — which is precisely the code that fails silently and is cheapest to test.

## Setup

Vitest, matching `arjs-plugin-artoolkit` and `AR.js-next` (both already use it). A hand-written mock `core` returns canned pointers and marker info, so no WASM is needed in CI.

## Coverage

**`math.ts`** — pure, highest value
- `transMatToGLMat`: known 3×4 → expected 4×4, column-major layout, `[0,0,0,1]` last row
- `arglCameraViewRHf`: Y/Z sign inversion, scale parameter, returns `Float32Array` (#02)
- Output-buffer variants write in place and allocate nothing (#03)

**`tracking.ts`** — state machine
- found → updated → lost → re-found transitions
- `lost` populated exactly once on the transition frame (#05)
- `getTransMatSquareCont` used only when `inPrevious` is true
- untracked marker IDs ignored
- matrix identity stable across frames (#03)

**`config.ts`** — each option maps to the right core setter and int; invalid values throw (#06)

**`init.ts`** — dispose releases the core; post-dispose calls throw; double-dispose is safe (#04)

## Not in scope

Browser/E2E automation. The webcam and worker examples remain the manual smoke test for v0.1.

## Acceptance

- [ ] `npm test` runs Vitest
- [ ] All modules above covered
- [ ] Suite runs without WASM, in Node, under 5 seconds
