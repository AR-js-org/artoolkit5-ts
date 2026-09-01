/*
 *  domain.ts
 *  artoolkit5-ts
 *
 *  This file is part of artoolkit5-ts - AR-js-org.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  artoolkit5-ts is distributed in the hope that it will be useful, but WITHOUT
 *  ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. See the MIT License
 *  for more details.
 *
 *  You should have received a copy of the MIT License along with artoolkit5-ts.
 *  If not, see <https://opensource.org/licenses/MIT>.
 *
 *  This library wraps a WebAssembly build of ARToolkit5 (WebARKitLib), which
 *  is licensed under the GNU Lesser General Public License v3.0.
 *
 *  Copyright (c) 2026 AR-js-org
 *
 *  Author(s): Walter Perdan @kalwalt https://github.com/kalwalt
 *
 */

/**
 * Shared data structures.
 *
 * This module contains types only — no logic, no side effects.
 */

/**
 * Detection result for a single marker in a single frame.
 *
 * `matrix` and `matrixGL` are views onto buffers owned by the tracker and
 * reused every frame. Copy them if you need to retain values across frames.
 *
 * The differing precisions are deliberate: full precision is kept at the
 * source and narrowed exactly once, at the boundary where the data becomes
 * GPU-bound. Prefer `matrix` for any CPU-side maths — smoothing,
 * interpolation, physics — and `matrixGL` only for rendering.
 */
export interface MarkerPose {
    id: number;
    /**
     * 3x4 row-major pose, exactly as ARToolKit produces it.
     *
     * 64-bit because the C core computes in `ARdouble` and writes to
     * `HEAPF64`; reading it as `Float64Array` is a lossless copy.
     */
    matrix: Float64Array;
    /**
     * 4x4 column-major right-handed pose, ready for WebGL.
     *
     * 32-bit because WebGL is single-precision end to end — `uniformMatrix4fv`
     * takes a `Float32Array` and GLSL's `highp float` is 32-bit, so any wider
     * precision is discarded on upload. Not an accuracy compromise: float32
     * resolves below a micron at metre scale, while pose error is dominated by
     * camera noise and calibration in the millimetre range.
     */
    matrixGL: Float32Array;
}

/**
 * Outcome of a single call to `processFrame`.
 *
 * `lost` exists because the visibility transition is already computed while
 * tracking, and discarding it would force every consumer to re-derive it by
 * diffing successive results.
 */
export interface FrameResult {
    /** Markers visible in this frame, with their poses. */
    detected: MarkerPose[];
    /**
     * IDs of markers visible in the previous frame but not this one.
     *
     * Reported exactly once, on the frame the marker disappears.
     */
    lost: number[];
}

/** Per-marker tracking state, owned by {@link ARToolKitState}. */
export interface TrackedMarkerState {
    id: number;
    markerWidth: number;
    /** Visible in the previous frame — enables continuous tracking. */
    inPrevious: boolean;
    /** Visible in the frame currently being processed. */
    inCurrent: boolean;
    /** Reused across frames; never reallocated after registration. */
    matrix: Float64Array;
    /** Reused across frames; never reallocated after registration. */
    matrixGL: Float32Array;
}

/**
 * The Emscripten module, narrowed to the surface this library uses.
 *
 * Structurally compatible with the `Mod` type expected by the
 * `@ar-js-org/artoolkit5-wasm` loader helpers.
 */
export interface ARToolKitModule {
    /** Emscripten heap, read directly when unpacking pose pointers. */
    HEAPF64: Float64Array;
    FS: unknown;
    loadCameraFromPath(path: string): number;
    addMarker(path: string): number;
}

/** Marker metadata returned by the detector for one candidate square. */
export interface MarkerInfo {
    /** Engine-assigned marker ID, or -1 when unrecognised. */
    id: number;
}

/**
 * The C++ `ARToolKitCore` instance, narrowed to the methods this library calls.
 *
 * Pose getters return a pointer into the Emscripten heap rather than a value;
 * see {@link ARToolKitCore.getTransform}.
 */
export interface ARToolKitCore {
    setup(width: number, height: number, cameraId: number): Promise<void>;
    passVideoData(frame: Uint8ClampedArray, lumaBuffer: number[], convertToLuma: boolean): void;
    detectMarker(): void;
    getMarkerNum(): number;
    getMarkerInfo(index: number): MarkerInfo;
    getTransMatSquare(index: number, markerWidth: number): void;
    getTransMatSquareCont(index: number, markerWidth: number): void;
    /** Byte offset into `HEAPF64` holding the most recent 3x4 pose. */
    getTransform(): number;
    getCameraLens(): Float64Array;
    setPatternDetectionMode(mode: number): void;
    setMatrixCodeType(type: number): void;
    setThreshold(threshold: number): void;
    setThresholdMode(mode: number): void;
    setLabelingMode(mode: number): void;
    setImageProcMode(mode: number): void;
    setPattRatio(ratio: number): void;
    setProjectionNearPlane(nearPlane: number): void;
    setProjectionFarPlane(farPlane: number): void;
    /** Releases the ARToolKit handles held by the C++ instance. */
    teardown(): number;
    /** Frees the C++ instance itself. Generated by Embind, not declared in C++. */
    delete(): void;
}

/**
 * The central state object threaded through every operation.
 *
 * A pure data container: it has no methods, and functions receive it as their
 * first argument rather than being bound to it.
 */
export interface ARToolKitState {
    readonly mod: ARToolKitModule;
    readonly core: ARToolKitCore;
    readonly width: number;
    readonly height: number;
    /** Registered markers, keyed by engine-assigned ID. */
    markers: Record<number, TrackedMarkerState>;
    /**
     * Set by `disposeARToolKitState`. Once true the C++ instance is gone and
     * every operation on this state throws rather than reaching freed memory.
     */
    disposed: boolean;
}
