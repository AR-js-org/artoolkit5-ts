**Title:** feat: verify worker compatibility and add `examples/worker/`

## Why

`@ar-js-org/arjs-plugin-artoolkit` runs detection off the main thread ("Web Worker-based detection", "ImageBitmap support — zero-copy frame transfer"). If `artoolkit5-ts` is to replace `artoolkit5-js` as its engine, it must be provably usable inside a `Worker`.

`src/` is already DOM-free, which is necessary but not sufficient — WASM instantiation, `locateFile` resolution, and `fetch` of `.patt` / `camera_para.dat` all need to work in worker scope, and none of that has been tested.

## Scope

**No worker ships in the library.** The target consumer already owns its worker; shipping ours would duplicate it and add versioned surface area for no gain (D6). This issue delivers proof and documentation only.

## Deliverable

`examples/worker/` where:

- the worker calls `createARToolKitState`, `loadPatternMarker`, `trackMarker`, `processFrame`
- the main thread only captures frames and renders
- pixel buffers are transferred, not copied
- poses come back as plain `{ id, matrixGL }` objects

Plus a README section documenting the pattern, including the `wasmUrl` resolution difference in worker scope.

## Acceptance

- [ ] Worker example tracks a marker with rendering on the main thread
- [ ] No DOM API reachable from any `src/` code path
- [ ] Worker caveats documented
- [ ] If WASM init fails in worker scope, findings recorded and an upstream `artoolkit5-wasm` issue opened
