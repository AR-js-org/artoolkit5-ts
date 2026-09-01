/*
 *  lifecycle.test.ts
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
import { disposeARToolKitState } from '../src/init';
import { processFrame, trackMarker } from '../src/tracking';
import { getCameraProjectionMatrix } from '../src/math';
import { loadPatternMarker } from '../src/markers';
import { configureDetector } from '../src/detector';
import { ARToolKitError } from '../src/errors';
import { createMockState } from './mock-core';

describe('disposeARToolKitState', () => {
    it('releases the ARToolKit handles before freeing the instance', () => {
        // delete() alone would leak the handles teardown() is responsible for.
        const { state, calls } = createMockState();
        disposeARToolKitState(state);

        expect(calls.teardown).toBe(1);
        expect(calls.delete).toBe(1);
    });

    it('marks the state disposed and drops registered markers', () => {
        const { state } = createMockState();
        trackMarker(state, 7);

        disposeARToolKitState(state);

        expect(state.disposed).toBe(true);
        expect(state.markers).toEqual({});
    });

    it('is idempotent, so a second call frees nothing twice', () => {
        // Calling delete() twice on an Embind instance is a hard error.
        const { state, calls } = createMockState();

        disposeARToolKitState(state);
        disposeARToolKitState(state);

        expect(calls.teardown).toBe(1);
        expect(calls.delete).toBe(1);
    });
});

describe('post-dispose guards', () => {
    it('throws ARToolKitError from every operation that touches the core', async () => {
        const { state } = createMockState();
        disposeARToolKitState(state);

        expect(() => processFrame(state, new Uint8ClampedArray(16))).toThrow(ARToolKitError);
        expect(() => trackMarker(state, 7)).toThrow(ARToolKitError);
        expect(() => getCameraProjectionMatrix(state)).toThrow(ARToolKitError);
        expect(() => configureDetector(state, { threshold: 100 })).toThrow(ARToolKitError);
        await expect(loadPatternMarker(state, 'marker.patt')).rejects.toThrow(ARToolKitError);
    });

    it('names the operation that was misused', () => {
        const { state } = createMockState();
        disposeARToolKitState(state);

        // The whole point of the guard is an actionable message rather than a
        // crash somewhere inside the WASM module.
        expect(() => processFrame(state, new Uint8ClampedArray(16)))
            .toThrow(/processFrame was called on a disposed ARToolKitState/);
    });
});
