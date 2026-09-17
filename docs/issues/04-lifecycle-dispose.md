<!-- filed-as -->
> **Filed as [#6](https://github.com/AR-js-org/artoolkit5-ts/issues/6) — closed.**
> The GitHub issue is the live record; this draft is kept for its design
> reasoning and is not updated. Draft numbering does not match issue
> numbering — always follow the link rather than the filename.

**Title:** feat: add `disposeARToolKitState` and post-dispose guards

## Problem

There is no way to release the ARToolKit core. A single-page app that starts and stops AR — or a test suite creating a state per case — leaks the C++ instance and its WASM heap allocations every time.

There is also no guard against using a state after teardown; today that would fail somewhere inside WASM with an unreadable error.

## Proposal

```ts
export function disposeARToolKitState(state: ARToolKitState): void;
```

- Calls embind's generated `core.delete()`
- Sets `state.disposed = true`
- Is idempotent — calling twice is a no-op, not an error

Every public function checks `state.disposed` first and throws `ARToolKitError` with an actionable message, converting a WASM crash into a clear TypeScript error.

Introduce `src/errors.ts` with `ARToolKitError` as part of this issue.

## Open question

Embind normally generates `.delete()` on bound class instances, but no explicit destructor symbol appears in `artoolkit5.wasm`. Verify at implementation time; if absent, fall back to a documented no-op and open an upstream issue.

## Acceptance

- [ ] `disposeARToolKitState` releases the core
- [ ] All public functions throw `ARToolKitError` when called on a disposed state
- [ ] Double-dispose is safe
- [ ] Documented in the README lifecycle section
