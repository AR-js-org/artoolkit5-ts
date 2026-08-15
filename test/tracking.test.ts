/*
 *  tracking.test.ts
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

import { describe, expect, it } from 'vitest';
import { processFrame, trackMarker } from '../src/tracking';
import { ARToolKitError } from '../src/errors';
import { createMockState } from './mock-core';

const MARKER_ID = 7;
const FRAME = new Uint8ClampedArray(16);

describe('trackMarker', () => {
    it('registers a marker with its pose buffers', () => {
        const { state } = createMockState();
        trackMarker(state, MARKER_ID, 2.5);

        const tracked = state.markers[MARKER_ID];
        expect(tracked.id).toBe(MARKER_ID);
        expect(tracked.markerWidth).toBe(2.5);
        expect(tracked.matrix).toHaveLength(12);
        expect(tracked.matrixGL).toHaveLength(16);
    });

    it('defaults markerWidth to 1', () => {
        const { state } = createMockState();
        trackMarker(state, MARKER_ID);
        expect(state.markers[MARKER_ID].markerWidth).toBe(1);
    });

    it('throws once the state is disposed', () => {
        const { state } = createMockState();
        state.disposed = true;
        expect(() => trackMarker(state, MARKER_ID)).toThrow(ARToolKitError);
    });
});

describe('processFrame visibility transitions', () => {
    it('reports lost exactly once, on the frame the marker disappears', () => {
        // absent, found, still there, gone, still gone, found again
        const { state } = createMockState({
            visibleIds: [[], [MARKER_ID], [MARKER_ID], [], [], [MARKER_ID]],
        });
        trackMarker(state, MARKER_ID);

        const timeline = Array.from({ length: 6 }, () => {
            const { detected, lost } = processFrame(state, FRAME);
            return { detected: detected.map((m) => m.id), lost };
        });

        expect(timeline).toEqual([
            { detected: [], lost: [] },          // never seen: no spurious loss
            { detected: [MARKER_ID], lost: [] }, // found
            { detected: [MARKER_ID], lost: [] }, // still visible
            { detected: [], lost: [MARKER_ID] }, // lost, reported once
            { detected: [], lost: [] },          // stays absent, not repeated
            { detected: [MARKER_ID], lost: [] }, // found again
        ]);
    });

    it('does not report a marker as lost before it has ever been seen', () => {
        const { state } = createMockState({ visibleIds: [[], [], []] });
        trackMarker(state, MARKER_ID);

        for (let i = 0; i < 3; i++) {
            expect(processFrame(state, FRAME).lost).toEqual([]);
        }
    });
});

describe('processFrame pose extraction', () => {
    it('uses continuous tracking only when the marker was visible last frame', () => {
        const { state, calls } = createMockState({
            visibleIds: [[MARKER_ID], [MARKER_ID]],
        });
        trackMarker(state, MARKER_ID);

        processFrame(state, FRAME);
        // First sighting: no previous pose to continue from.
        expect(calls.transMat).toEqual([0]);
        expect(calls.transMatCont).toEqual([]);

        processFrame(state, FRAME);
        // Second: continuous tracking is valid and more stable.
        expect(calls.transMat).toEqual([0]);
        expect(calls.transMatCont).toEqual([0]);
    });

    it('copies the pose out of the heap', () => {
        const pose = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const { state } = createMockState({ visibleIds: [[MARKER_ID]], pose });
        trackMarker(state, MARKER_ID);

        const { detected } = processFrame(state, FRAME);
        expect(Array.from(detected[0].matrix)).toEqual(pose);
    });

    it('reuses the same buffers across frames rather than reallocating', () => {
        const { state } = createMockState({ visibleIds: [[MARKER_ID], [MARKER_ID]] });
        trackMarker(state, MARKER_ID);

        const first = processFrame(state, FRAME).detected[0];
        const matrix = first.matrix;
        const matrixGL = first.matrixGL;

        const second = processFrame(state, FRAME).detected[0];

        // Identity, not equality: the per-frame path must not allocate.
        expect(second.matrix).toBe(matrix);
        expect(second.matrixGL).toBe(matrixGL);
    });

    it('exposes matrixGL as a Float32Array for WebGL', () => {
        const { state } = createMockState({ visibleIds: [[MARKER_ID]] });
        trackMarker(state, MARKER_ID);

        const { detected } = processFrame(state, FRAME);
        expect(detected[0].matrixGL).toBeInstanceOf(Float32Array);
        expect(detected[0].matrix).toBeInstanceOf(Float64Array);
    });
});

describe('processFrame filtering', () => {
    it('ignores detected markers that were never registered', () => {
        const UNREGISTERED = 99;
        const { state } = createMockState({ visibleIds: [[UNREGISTERED]] });
        trackMarker(state, MARKER_ID);

        expect(processFrame(state, FRAME).detected).toEqual([]);
    });

    it('ignores squares the detector could not identify', () => {
        // -1 is the detector's "unrecognised" sentinel.
        const { state } = createMockState({ visibleIds: [[-1]] });
        trackMarker(state, MARKER_ID);

        expect(processFrame(state, FRAME).detected).toEqual([]);
    });

    it('throws once the state is disposed', () => {
        const { state } = createMockState();
        state.disposed = true;
        expect(() => processFrame(state, FRAME)).toThrow(ARToolKitError);
    });
});
