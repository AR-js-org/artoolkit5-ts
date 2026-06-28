// tracking.ts
import { ARToolKitState, TrackedMarkerState } from "./domain";
import { transMatToGLMat, arglCameraViewRHf } from "./math";

export function trackMarker(state: ARToolKitState, pattId: number, markerWidth: number = 1.0): void {
    // Initialize the state for this marker
    console.log(state)
    state.markers[pattId] = {
        id: pattId,
        markerWidth: markerWidth,
        inPrevious: false,
        inCurrent: false,
        matrix: new Float64Array(12),
        matrixGL: new Float32Array(16)
    };
}

export function processFrame(state: ARToolKitState, videoFrame: Uint8ClampedArray) {

    // 1. I/O: Pass the buffer to the C++ core (as ARController did)
    state.core.passVideoData(videoFrame, [], true);

    // 2. Execution: Detect markers in the current buffer
    state.core.detectMarker();
    const markerNum = state.core.getMarkerNum();

    // 3. State Management: Shift 'current' to 'previous' for all registered markers
    for (const id in state.markers) {
        const marker = state.markers[id];
        marker.inPrevious = marker.inCurrent;
        marker.inCurrent = false;
    }

    const detected = [];
    let transform_mat: Float32Array = new Float32Array(16);

    // 4. Extraction: Iterate over the found squares
    for (let i = 0; i < markerNum; i++) {
        const markerInfo = state.core.getMarkerInfo(i);

        // If the ID is valid and we are tracking this specific marker
        if (markerInfo.id > -1 && state.markers[markerInfo.id]) {
            const tracked = state.markers[markerInfo.id];
            tracked.inCurrent = true;

            // Use continuous tracking if it was visible in the previous frame
            if (tracked.inPrevious) {
                state.core.getTransMatSquareCont(i, tracked.markerWidth);
            } else {
                state.core.getTransMatSquare(i, tracked.markerWidth);
            }

            // Extract the matrix from Emscripten's HEAP memory
            const ptr = state.core.getTransform();
            const heapIndex = ptr >> 3; // Division by 8 (Float64 is 8 bytes)

            // Create a temporary view to copy the data safely
            const heapMatrix = state.mod.HEAPF64.subarray(heapIndex, heapIndex + 12);
            tracked.matrix.set(heapMatrix);

            // 3x4 -> 4x4 WebGL conversion
            transform_mat = transMatToGLMat(tracked.matrix);
            tracked.matrixGL = arglCameraViewRHf(transform_mat);

            // Return a "snapshot" of the state (optional: you could return the object itself)
            detected.push({
                id: tracked.id,
                matrix: tracked.matrix,
                matrixGL: tracked.matrixGL
            });
        }
    }

    return detected;
}