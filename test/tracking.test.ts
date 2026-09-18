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
import { processFrame, trackBarcodeMarker, trackMarker } from '../src/tracking';
import { configureDetector } from '../src/detector';
import { ARToolKitError } from '../src/errors';
import { createMockState } from './mock-core';

const MARKER_ID = 7;
const FRAME = new Uint8ClampedArray(16);

describe('trackMarker', () => {
    it('registers a marker with its pose buffers', () => {
        const { state } = createMockState();
        trackMarker(state, MARKER_ID, 2.5);

        const tracked = state.patternMarkers[MARKER_ID];
        expect(tracked.id).toBe(MARKER_ID);
        expect(tracked.markerWidth).toBe(2.5);
        expect(tracked.matrix).toHaveLength(12);
        expect(tracked.matrixGL).toHaveLength(16);
    });

    it('defaults markerWidth to 1', () => {
        const { state } = createMockState();
        trackMarker(state, MARKER_ID);
        expect(state.patternMarkers[MARKER_ID].markerWidth).toBe(1);
    });

    it('throws once the state is disposed', () => {
        const { state } = createMockState();
        state.disposed = true;
        expect(() => trackMarker(state, MARKER_ID)).toThrow(ARToolKitError);
    });
});

describe('trackBarcodeMarker', () => {
    it('registers a marker with its pose buffers, tagged as barcode', () => {
        const { state } = createMockState();
        trackBarcodeMarker(state, MARKER_ID, 2.5);

        const tracked = state.barcodeMarkers[MARKER_ID];
        expect(tracked.id).toBe(MARKER_ID);
        expect(tracked.markerWidth).toBe(2.5);
        expect(tracked.matrix).toHaveLength(12);
        expect(tracked.matrixGL).toHaveLength(16);
    });

    it('defaults markerWidth to 1', () => {
        const { state } = createMockState();
        trackBarcodeMarker(state, MARKER_ID);
        expect(state.barcodeMarkers[MARKER_ID].markerWidth).toBe(1);
    });

    it('throws once the state is disposed', () => {
        const { state } = createMockState();
        state.disposed = true;
        expect(() => trackBarcodeMarker(state, MARKER_ID)).toThrow(ARToolKitError);
    });
});

describe('independent ID spaces', () => {
    // Pattern IDs are assigned by the engine starting at 0; barcode IDs are
    // chosen by whoever printed the marker. `7` in one is unrelated to `7` in
    // the other, so both must be registrable and trackable simultaneously.

    it('registers a pattern and a barcode under the same ID', () => {
        const { state } = createMockState();
        trackMarker(state, MARKER_ID, 1.0);
        trackBarcodeMarker(state, MARKER_ID, 2.0);

        expect(state.patternMarkers[MARKER_ID].markerWidth).toBe(1.0);
        expect(state.barcodeMarkers[MARKER_ID].markerWidth).toBe(2.0);
    });

    it('detects both families under the same ID in a single frame', () => {
        const { state } = createMockState({ visibleIds: [[MARKER_ID]] });
        trackMarker(state, MARKER_ID);
        trackBarcodeMarker(state, MARKER_ID);

        const { detected } = processFrame(state, FRAME);

        expect(detected.map((m) => m.type).sort()).toEqual(['barcode', 'pattern']);
        expect(detected.every((m) => m.id === MARKER_ID)).toBe(true);
    });

    it('reports loss per family, so a shared ID stays unambiguous', () => {
        const { state } = createMockState({ visibleIds: [[MARKER_ID], []] });
        trackMarker(state, MARKER_ID);
        trackBarcodeMarker(state, MARKER_ID);

        processFrame(state, FRAME);
        const { lost } = processFrame(state, FRAME);

        expect(lost).toEqual([
            { id: MARKER_ID, type: 'pattern' },
            { id: MARKER_ID, type: 'barcode' },
        ]);
    });

    it('re-registering the same ID in the same family replaces it', () => {
        const { state } = createMockState();
        trackMarker(state, MARKER_ID, 1.0);
        trackMarker(state, MARKER_ID, 2.0);
        expect(state.patternMarkers[MARKER_ID].markerWidth).toBe(2.0);

        trackBarcodeMarker(state, MARKER_ID, 1.0);
        trackBarcodeMarker(state, MARKER_ID, 2.0);
        expect(state.barcodeMarkers[MARKER_ID].markerWidth).toBe(2.0);
    });
});

describe('vertex', () => {
    it('reports the corners the engine found for the square', () => {
        const { state } = createMockState({ visibleIds: [[MARKER_ID]] });
        trackMarker(state, MARKER_ID);

        const { detected } = processFrame(state, FRAME);

        // The mock's corners for candidate 0, verbatim. Asserting the exact
        // values proves they were carried through rather than reconstructed.
        expect(detected[0].vertex).toEqual([
            [10, 20],
            [30, 20],
            [30, 40],
            [10, 40],
        ]);
    });

    it('gives both families the corners of the square they matched', () => {
        // One square can match a pattern and a barcode in the same frame. Both
        // poses describe that same square, so both carry the same corners.
        const { state } = createMockState({ visibleIds: [[MARKER_ID]] });
        trackMarker(state, MARKER_ID);
        trackBarcodeMarker(state, MARKER_ID);

        const { detected } = processFrame(state, FRAME);

        expect(detected).toHaveLength(2);
        expect(detected[0].type).toBe('pattern');
        expect(detected[1].type).toBe('barcode');
        // Asserting the concrete value as well as the equality: comparing the
        // two poses alone would pass while both were undefined.
        expect(detected[0].vertex).toEqual([
            [10, 20],
            [30, 20],
            [30, 40],
            [10, 40],
        ]);
        expect(detected[1].vertex).toEqual(detected[0].vertex);
    });

    it('gives each visible square its own corners', () => {
        const SECOND_ID = MARKER_ID + 1;
        const { state } = createMockState({ visibleIds: [[MARKER_ID, SECOND_ID]] });
        trackMarker(state, MARKER_ID);
        trackMarker(state, SECOND_ID);

        const { detected } = processFrame(state, FRAME);

        expect(detected).toHaveLength(2);
        expect(detected[0].vertex).not.toEqual(detected[1].vertex);
    });

    it('is freshly allocated per frame, not a reused buffer', () => {
        // Unlike matrix and matrixGL, which are reused across frames, the
        // corners come back as a new array each call. Consumers may retain
        // them, and this pins that guarantee.
        const { state } = createMockState({ visibleIds: [[MARKER_ID], [MARKER_ID]] });
        trackMarker(state, MARKER_ID);

        const first = processFrame(state, FRAME).detected[0].vertex;
        const firstCopy = first.map((point) => [...point]);
        const second = processFrame(state, FRAME).detected[0].vertex;

        // Identity, not just contents: an array reused across frames holding
        // the same values would satisfy the second assertion on its own.
        expect(second).not.toBe(first);
        expect(first).toEqual(firstCopy);
    });
});

describe('confidence', () => {
    it('reports the confidence of the match that produced each pose', () => {
        const { state } = createMockState({
            visibleIds: [[MARKER_ID]],
            confidence: { pattern: 0.82, matrix: 1 },
        });
        trackMarker(state, MARKER_ID);

        const { detected } = processFrame(state, FRAME);
        expect(detected[0].confidence).toBe(0.82);
    });

    it('reads confidence from the family that matched, not the other', () => {
        // The mock reports both families; each pose must carry its own score.
        const { state } = createMockState({
            visibleIds: [[MARKER_ID]],
            confidence: { pattern: 0.6, matrix: 1 },
        });
        trackMarker(state, MARKER_ID);
        trackBarcodeMarker(state, MARKER_ID);

        const { detected } = processFrame(state, FRAME);
        const byType = Object.fromEntries(detected.map((m) => [m.type, m.confidence]));

        expect(byType).toEqual({ pattern: 0.6, barcode: 1 });
    });

    it('does not filter anything by default', () => {
        const { state } = createMockState({
            visibleIds: [[MARKER_ID]],
            confidence: { pattern: 0.01, matrix: 0.01 },
        });
        trackMarker(state, MARKER_ID);

        expect(processFrame(state, FRAME).detected).toHaveLength(1);
    });

    it('drops a match below minConfidence', () => {
        const { state } = createMockState({
            visibleIds: [[MARKER_ID]],
            confidence: { pattern: 0.55, matrix: 1 },
        });
        trackMarker(state, MARKER_ID);
        configureDetector(state, { minConfidence: { pattern: 0.6 } });

        expect(processFrame(state, FRAME).detected).toEqual([]);
    });

    it('keeps a match exactly at the threshold', () => {
        const { state } = createMockState({
            visibleIds: [[MARKER_ID]],
            confidence: { pattern: 0.6, matrix: 1 },
        });
        trackMarker(state, MARKER_ID);
        configureDetector(state, { minConfidence: { pattern: 0.6 } });

        expect(processFrame(state, FRAME).detected).toHaveLength(1);
    });

    it('applies each family threshold only to its own family', () => {
        // The thresholds must differ, and each family's confidence must sit
        // between them. Then applying the wrong threshold to either family
        // flips that family's outcome:
        //
        //   pattern cf 0.95 >= its 0.90  -> kept   (0.95 >= barcode's 0.50 too,
        //                                           so a swap keeps it wrongly)
        //   barcode cf 0.60 >= its 0.50  -> kept   (0.60 <  pattern's 0.90,
        //                                           so a swap drops it)
        //
        // Equal thresholds would make a swap undetectable, which is what an
        // earlier version of this test got wrong.
        const { state } = createMockState({
            visibleIds: [[MARKER_ID]],
            confidence: { pattern: 0.95, matrix: 0.6 },
        });
        trackMarker(state, MARKER_ID);
        trackBarcodeMarker(state, MARKER_ID);
        configureDetector(state, { minConfidence: { pattern: 0.9, barcode: 0.5 } });

        const { detected } = processFrame(state, FRAME);
        expect(detected.map((m) => m.type).sort()).toEqual(['barcode', 'pattern']);
    });

    it('rejects a family whose own threshold it fails, even if it would pass the other', () => {
        // pattern cf 0.60 fails its own 0.90, but would pass barcode's 0.50.
        const { state } = createMockState({
            visibleIds: [[MARKER_ID]],
            confidence: { pattern: 0.6, matrix: 0.6 },
        });
        trackMarker(state, MARKER_ID);
        trackBarcodeMarker(state, MARKER_ID);
        configureDetector(state, { minConfidence: { pattern: 0.9, barcode: 0.5 } });

        const { detected } = processFrame(state, FRAME);
        expect(detected.map((m) => m.type)).toEqual(['barcode']);
    });

    it('reports a marker lost when its confidence falls below the threshold', () => {
        // Filtered out is indistinguishable from absent: the marker was
        // visible, then drops under the threshold, and that is a loss.
        const { state } = createMockState({
            visibleIds: [[MARKER_ID], [MARKER_ID]],
            confidence: { pattern: 1, matrix: 1 },
        });
        trackMarker(state, MARKER_ID);

        expect(processFrame(state, FRAME).detected).toHaveLength(1);

        configureDetector(state, { minConfidence: { pattern: 0.9 } });
        state.core.getMarkerInfo = () => ({
            id: -1, idPatt: MARKER_ID, idMatrix: -1, cfPatt: 0.2, cfMatrix: -1,
            vertex: [[0, 0], [1, 0], [1, 1], [0, 1]],
        });

        const { detected, lost } = processFrame(state, FRAME);
        expect(detected).toEqual([]);
        expect(lost).toEqual([{ id: MARKER_ID, type: 'pattern' }]);
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
            { detected: [], lost: [{ id: MARKER_ID, type: 'pattern' }] }, // lost, once
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

describe('processFrame type reporting', () => {
    it('reports the type each marker was registered with', () => {
        const { state } = createMockState({ visibleIds: [[MARKER_ID]] });
        trackBarcodeMarker(state, MARKER_ID);

        const { detected } = processFrame(state, FRAME);
        expect(detected[0].type).toBe('barcode');
    });

    it('reports the correct type per marker when both families are detected in the same frame', () => {
        // The mock reports every ID in both families at once, which is the
        // strictest input available: only the registered type disambiguates
        // them, so this fails with duplicates if that check is ever dropped.
        const PATTERN_ID = MARKER_ID;
        const BARCODE_ID = MARKER_ID + 1;
        const { state } = createMockState({ visibleIds: [[PATTERN_ID, BARCODE_ID]] });
        trackMarker(state, PATTERN_ID);
        trackBarcodeMarker(state, BARCODE_ID);

        const { detected } = processFrame(state, FRAME);
        const byId = Object.fromEntries(detected.map((m) => [m.id, m.type]));

        expect(byId).toEqual({
            [PATTERN_ID]: 'pattern',
            [BARCODE_ID]: 'barcode',
        });
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
