**Title:** chore: remove console logging from `src/`

## Problem

`src/` contains debug logging that violates the project's own convention ("Avoid side effects — no logging, no DOM manipulation, no event emission inside `src/`", `AGENTS.md`).

- `src/markers.ts:12` — `console.log(state)` on every marker load
- `src/tracking.ts:7` — `console.log(state)` on every `trackMarker` call

Logging the entire state object also dumps the WASM module and core instance to the console, which is noisy and can pin objects in devtools.

## Fix

Remove both statements. Errors surface as thrown `ARToolKitError` (see #04), never as logs.

## Acceptance

- [ ] No `console.*` call anywhere in `src/`
- [ ] A lint rule (`no-console`) enforces this for `src/` so it cannot regress
