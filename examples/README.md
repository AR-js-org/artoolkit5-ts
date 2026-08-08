# ARToolKit5-TS Examples

This folder contains working examples demonstrating the **Data-Oriented, composable API** of `artoolkit5-ts`.

## Webcam Example

Real-time AR marker tracking using your device camera, with a Three.js cube overlay on top of detected markers.

### Prerequisites

- Modern browser with WebRTC support (webcam access)
- A printable marker: download the [Hiro marker](https://commons.wikimedia.org/wiki/File:Hiro_marker_wikipedia.png)
- Camera calibration file: `examples/webcam/data/camera_para.dat` (included)
- Marker pattern file: `examples/webcam/data/patt.hiro` (included)

### Running

```bash
npm run dev
```

This starts the Vite dev server and automatically opens `examples/webcam/index.html`.

### How It Works

The example demonstrates the composable approach:

```typescript
// 1. Create AR context (encapsulates WASM state)
const state = await createARToolKitState(width, height, cameraUrl, wasmUrl);

// 2. Load and register markers (pure functions)
const markerId = await loadPatternMarker(state, markerUrl);
trackMarker(state, markerId, markerWidth);

// 3. Process video frames (stateless detection)
const markers = processFrame(state, imageData);

// 4. Update your scene with detected poses
markers.forEach(marker => {
  mesh.matrix.set(marker.matrixGL);
});
```

### Key Points

- **No monolithic controller:** Functions receive `ARToolKitState` as an argument (dependency injection)
- **Tree-shakeable:** Only imports what you use
- **Web Worker ready:** The state can live in a worker; just pass pixel buffers
- **Testable:** Pure functions, no hidden global state

### Debugging

Uncomment the logging in `main.ts` to see:
- WASM module initialization
- Marker detection status each frame
- Matrix calculations

```typescript
console.log("Marker found! Matrix:", marker.matrixGL);
```