export interface MarkerPose {
    id: number;
    matrix: Float64Array;    // 3x4 original
    matrixGL: Float32Array;  // 4x4 for WebGL (note: now using Float32Array as in your ARController)
}

// Internal state for a single tracked marker
export interface TrackedMarkerState {
    id: number;
    markerWidth: number;
    inPrevious: boolean;
    inCurrent: boolean;
    matrix: Float64Array;
    matrixGL: Float32Array;
}

export interface ARToolKitState {
    mod: any;
    core: any;
    width: number;
    height: number;
    // Dictionary mapping marker ID to its tracking state
    markers: Record<number, TrackedMarkerState>;
}