# artoolkit5-ts

TypeScript library wrapping `@ar-js-org/artoolkit5-wasm` (Emscripten/WASM build of ARToolKit5) for AR marker tracking in the browser.

## Tech stack

- **Language**: TypeScript (strict, ES2020, ESNext modules)
- **Build**: Vite 8 in library mode — outputs ES (`artoolkit5-ts.js`) and UMD (`artoolkit5-ts.umd.cjs`)
- **Types**: emitted via `tsc -p tsconfig.build.json`
- **3D rendering**: Three.js (used in examples, peer-dep in library)
- **WASM dependency**: `@ar-js-org/artoolkit5-wasm` (pinned git commit, treated as external in the bundle)

## Source layout

```
src/
  index.ts      — public API re-exports
  domain.ts     — shared TypeScript interfaces (ARToolKitState, MarkerPose, TrackedMarkerState)
  init.ts       — createARToolKitState(): initialises WASM, camera params, returns state object
  markers.ts    — loadPatternMarker(): fetches .patt file, registers with ARToolKit core
  tracking.ts   — trackMarker(), processFrame(): per-frame detection and pose extraction
  math.ts       — transMatToGLMat(), arglCameraViewRHf(), getCameraProjectionMatrix()

examples/
  webcam/
    main.ts     — full working example: webcam → ARToolKit → Three.js cube overlay
```

## Public API

| Export | Description |
|---|---|
| `createARToolKitState(w, h, cameraUrl, wasmUrl?)` | Async init — returns `ARToolKitState` |
| `loadPatternMarker(state, markerUrl)` | Async — downloads `.patt`, returns marker ID |
| `trackMarker(state, pattId, markerWidth?)` | Registers a marker for tracking |
| `processFrame(state, videoFrame)` | Per-frame detection — returns `MarkerPose[]` |
| `transMatToGLMat(transMat)` | 3×4 → 4×4 column-major Float32Array |
| `getCameraProjectionMatrix(state)` | Returns camera lens matrix from ARToolKit core |

## Commands

```bash
npm run dev      # Vite dev server — opens examples/webcam/index.html
npm run build    # vite build + tsc (lib output + .d.ts)
npm run preview  # Preview production build
```

## Conventions

- Keep `src/` focused on the pure AR/WASM interface — no DOM, no Three.js.
- Three.js and DOM code belongs in examples.
- `ARToolKitState` is the central mutable object passed through all API calls — do not split or duplicate it.
- Matrix layout: ARToolKit uses row-major 3×4; WebGL expects column-major 4×4. `transMatToGLMat` + `arglCameraViewRHf` handle the conversion and right-hand flip.
- The WASM module is always passed as `state.mod`; the C++ ARToolKitCore instance as `state.core`.
- Marker IDs are assigned by the C++ engine at load time — never hardcode them.

## Architecture: Data-Oriented over Object-Oriented

This library adopts a **composable, function-based design** instead of a monolithic controller class. This choice has deep implications:

### Why Data-Oriented?

The old ARToolKit.js used a "God Object" pattern (`ARController` class), which:
- Hid complexity (async init, memory management, state tracking)
- Made tree-shaking impossible — bundlers couldn't eliminate unused marker types (Pattern, Barcode, NFT)
- Required global state or complex serialization for Web Workers
- Tightly coupled DOM, canvas, and WASM concerns

**Our approach separates concerns:**
- **State** lives in `ARToolKitState` — a pure data container (no methods)
- **Operations** are stateless functions — `processFrame(state, pixels)` returns data
- **Dependencies** flow as arguments, not hidden globals

### API Pattern

```typescript
// 1. Create state once
const state = await createARToolKitState(width, height, cameraUrl, wasmUrl);

// 2. Register markers (sync, updates state.markers dictionary)
const id = await loadPatternMarker(state, patternUrl);
trackMarker(state, id, markerWidth);

// 3. Per-frame: call pure function, get results
const detectedMarkers = processFrame(state, imageData);

// 4. Update your scene (no side effects in the library)
detectedMarkers.forEach(marker => {
  mesh.matrix.set(marker.matrixGL);
});
```

### Benefits

- **Tree-shakeable**: Bundle only the functions you call
- **Testable**: Functions take input, return output; no mocking needed
- **Web Worker compatible**: Pass state to a worker, get back pose arrays
- **Framework agnostic**: Works in React, Vue, vanilla JS, Svelte, etc.
- **SIMD-ready**: Memory layout exposed; future C++ optimizations don't require API changes

## Key data flow

```
getUserMedia → canvas pixel extraction (Uint8ClampedArray)
  → processFrame(state, pixels)
    → core.passVideoData() + core.detectMarker()
    → per-marker: getTransMatSquare[Cont] → read from HEAPF64
    → transMatToGLMat + arglCameraViewRHf
  → MarkerPose[] (id, matrix 3×4, matrixGL 4×4)
    → Your code: renderer.render() or update THREE.js objects
```

## Development workflow

### Adding a new feature

1. **Define types** in `domain.ts` (interfaces, data structures)
2. **Implement logic** in a focused module (`tracking.ts`, `math.ts`, etc.)
3. **Accept `state` as first parameter** — functions receive state, return data
4. **Export from `index.ts`** — make it part of the public API
5. **Add to example** — demonstrate the feature in `examples/webcam/main.ts` or a new example
6. **Test with `npm run dev`** — run the example in your browser

### Performance considerations

- **`processFrame()` is called every animation frame** — keep it tight
- **Avoid allocating new Float32Arrays** in hot paths — reuse buffers where possible
- **HEAP access is fast** — reading from `state.mod.HEAPF64` directly is fine
- **Emscripten handles memory** — do not manually `malloc`/`free` unless you know what you're doing
- **Future: SIMD** — once WASM SIMD stabilizes, we can move pixel processing to C++ without changing the TS API

## Extending the API

When adding new marker types or features:

1. **Keep it functional** — avoid methods on state objects
2. **Use `state` as dependency injection** — pass state to all functions
3. **Return immutable results** — functions should not modify state unless semantically necessary (e.g., `trackMarker` updates the marker dictionary)
4. **Document assumptions** — if a function requires certain markers to be loaded, state it in JSDoc
5. **Avoid side effects** — no logging, no DOM manipulation, no event emission inside `src/`

### Example: Adding NFT marker support

```typescript
// domain.ts: extend the state if needed
export interface ARToolKitState {
  // ... existing fields
  nftMarkers?: Record<number, NFTMarkerState>;
}

// nft.ts: pure functions
export async function loadNFTMarker(
  state: ARToolKitState,
  descriptorUrl: string
): Promise<number> {
  // fetch descriptor, register with core, return ID
  // update state.nftMarkers
}

export function processNFTFrame(
  state: ARToolKitState,
  markerIndex: number
): NFTMarkerPose | null {
  // detect and extract pose for NFT marker
}

// index.ts: export
export { loadNFTMarker, processNFTFrame } from './nft';
```

## Git workflow

- **Branching strategy**: Use `dev` as the primary development branch. Start feature branches and PRs from `dev`, not `main`. The `main` branch is reserved for stable, release-ready code.
- **Commit messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `refactor:` for code refactoring
  - `test:` for test additions or updates
  - `chore:` for build/tooling changes
  - Example: `feat: add marker group tracking support`
  - For breaking changes, append `!` before the colon: `feat!: redesign marker API`