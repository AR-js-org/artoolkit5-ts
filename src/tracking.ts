/*
 *  tracking.ts
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

import { ARToolKitState, FrameResult, MarkerPose, TrackedMarkerState } from './domain';
import { assertNotDisposed } from './errors';
import { arglCameraViewRHf, transMatToGLMat } from './math';

/** Elements in ARToolKit's 3x4 pose matrix. */
const POSE_ELEMENT_COUNT = 12;

/** `HEAPF64` is indexed in 8-byte elements, so byte offsets shift right by 3. */
const BYTES_TO_FLOAT64_INDEX_SHIFT = 3;

/** ID reported by the detector for a square it could not identify. */
const UNRECOGNISED_MARKER_ID = -1;

/** The core computes luma itself, so no buffer is supplied. */
const EMPTY_LUMA_BUFFER: number[] = [];
const CONVERT_TO_LUMA = true;

/**
 * Holds the intermediate 4x4 matrix between expansion and the right-handed
 * conversion. Module-scoped so the per-frame path allocates nothing.
 */
const glMatrixScratch = new Float32Array(16);

/**
 * Registers a marker for tracking and allocates its reusable pose buffers.
 *
 * @param pattId ID returned by `loadPatternMarker`.
 * @param markerWidth Physical marker width; the unit chosen here is the unit
 *   all returned translations are expressed in.
 * @throws {ARToolKitError} if the state has been disposed.
 */
export function trackMarker(
    state: ARToolKitState,
    pattId: number,
    markerWidth: number = 1.0
): void {
    assertNotDisposed(state, 'trackMarker');

    state.markers[pattId] = {
        id: pattId,
        markerWidth,
        inPrevious: false,
        inCurrent: false,
        matrix: new Float64Array(POSE_ELEMENT_COUNT),
        matrixGL: new Float32Array(16),
    };
}

/**
 * Detects registered markers in a single frame.
 *
 * Returns both the markers visible now and those that have just disappeared,
 * so a consumer emitting found/updated/lost events does not have to diff
 * successive results to recover information tracking already had.
 *
 * Called once per animation frame, so it allocates no typed arrays: every pose
 * is written into buffers owned by the marker's tracking state. Those buffers
 * are reused next frame — copy them if you need to retain values.
 *
 * @param videoFrame RGBA pixels matching the width and height the state was
 *   created with.
 * @throws {ARToolKitError} if the state has been disposed.
 */
export function processFrame(
    state: ARToolKitState,
    videoFrame: Uint8ClampedArray
): FrameResult {
    assertNotDisposed(state, 'processFrame');

    detectMarkersInFrame(state, videoFrame);
    advanceTrackingState(state);

    // Order matters: collecting poses is what marks markers as visible this
    // frame, so anything still unmarked afterwards is what was just lost.
    const detected = collectDetectedPoses(state);
    const lost = collectLostMarkers(state);

    return { detected, lost };
}

function detectMarkersInFrame(state: ARToolKitState, videoFrame: Uint8ClampedArray): void {
    state.core.passVideoData(videoFrame, EMPTY_LUMA_BUFFER, CONVERT_TO_LUMA);
    state.core.detectMarker();
}

/** Rolls this frame's visibility into last frame's, so continuity survives. */
function advanceTrackingState(state: ARToolKitState): void {
    for (const id in state.markers) {
        const marker = state.markers[id];
        marker.inPrevious = marker.inCurrent;
        marker.inCurrent = false;
    }
}

function collectDetectedPoses(state: ARToolKitState): MarkerPose[] {
    const detected: MarkerPose[] = [];
    const candidateCount = state.core.getMarkerNum();

    for (let candidate = 0; candidate < candidateCount; candidate++) {
        const { id } = state.core.getMarkerInfo(candidate);
        if (id === UNRECOGNISED_MARKER_ID) continue;

        const tracked = state.markers[id];
        if (!tracked) continue;

        tracked.inCurrent = true;
        updatePose(state, candidate, tracked);

        detected.push({
            id: tracked.id,
            matrix: tracked.matrix,
            matrixGL: tracked.matrixGL,
        });
    }

    return detected;
}

/**
 * Markers visible last frame but not this one.
 *
 * Fires once per disappearance: the following frame rolls `inCurrent` (false)
 * into `inPrevious`, so the condition no longer holds.
 */
function collectLostMarkers(state: ARToolKitState): number[] {
    const lost: number[] = [];

    for (const id in state.markers) {
        const marker = state.markers[id];
        if (marker.inPrevious && !marker.inCurrent) {
            lost.push(marker.id);
        }
    }

    return lost;
}

function updatePose(
    state: ARToolKitState,
    candidate: number,
    tracked: TrackedMarkerState
): void {
    // Continuous tracking is more stable, but is only valid when the marker was
    // already visible in the previous frame.
    if (tracked.inPrevious) {
        state.core.getTransMatSquareCont(candidate, tracked.markerWidth);
    } else {
        state.core.getTransMatSquare(candidate, tracked.markerWidth);
    }

    copyPoseFromHeap(state, tracked.matrix);
    transMatToGLMat(tracked.matrix, glMatrixScratch);
    arglCameraViewRHf(glMatrixScratch, tracked.matrixGL);
}

function copyPoseFromHeap(state: ARToolKitState, destination: Float64Array): void {
    const heapIndex = state.core.getTransform() >> BYTES_TO_FLOAT64_INDEX_SHIFT;
    destination.set(
        state.mod.HEAPF64.subarray(heapIndex, heapIndex + POSE_ELEMENT_COUNT)
    );
}
