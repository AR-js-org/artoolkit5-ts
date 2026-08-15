/*
 *  math.test.ts
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
import { arglCameraViewRHf, getCameraProjectionMatrix, transMatToGLMat } from '../src/math';
import { ARToolKitError } from '../src/errors';
import { createMockState } from './mock-core';

/**
 * ARToolKit's 3x4 pose, row-major. Values are distinct and non-symmetric so a
 * transposition mistake cannot pass by coincidence.
 */
const TRANS_MAT = new Float64Array([
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
]);

describe('transMatToGLMat', () => {
    it('expands 3x4 row-major into 4x4 column-major', () => {
        // Column-major: the translation column (4, 8, 12) lands at indices
        // 12..14, not 3..5. Getting this wrong puts the marker in the wrong
        // place while still looking plausible.
        expect(Array.from(transMatToGLMat(TRANS_MAT))).toEqual([
            1, 5, 9, 0,
            2, 6, 10, 0,
            3, 7, 11, 0,
            4, 8, 12, 1,
        ]);
    });

    it('writes the perspective row so the matrix is affine', () => {
        const result = transMatToGLMat(TRANS_MAT);
        expect([result[3], result[7], result[11], result[15]]).toEqual([0, 0, 0, 1]);
    });

    it('returns a Float32Array', () => {
        expect(transMatToGLMat(TRANS_MAT)).toBeInstanceOf(Float32Array);
    });

    it('writes into a supplied buffer instead of allocating', () => {
        const out = new Float32Array(16);
        const returned = transMatToGLMat(TRANS_MAT, out);

        // Identity, not just equality: the hot path depends on reuse.
        expect(returned).toBe(out);
        expect(out[12]).toBe(4);
    });
});

describe('arglCameraViewRHf', () => {
    const glMatrix = transMatToGLMat(TRANS_MAT);

    it('negates the Y and Z axes and leaves X alone', () => {
        const result = arglCameraViewRHf(glMatrix);

        // Without this conversion the pose renders behind the camera.
        expect([result[0], result[4], result[8], result[12]]).toEqual([1, 2, 3, 4]);
        expect([result[1], result[5], result[9], result[13]]).toEqual([-5, -6, -7, -8]);
        expect([result[2], result[6], result[10], result[14]]).toEqual([-9, -10, -11, -12]);
    });

    it('writes the perspective row', () => {
        const result = arglCameraViewRHf(glMatrix);
        expect([result[3], result[7], result[11], result[15]]).toEqual([0, 0, 0, 1]);
    });

    it('returns a Float32Array, matching what the WebGL contract requires', () => {
        // Regression guard: this allocated a Float64Array while every type
        // declaration promised Float32Array.
        expect(arglCameraViewRHf(glMatrix)).toBeInstanceOf(Float32Array);
    });

    it('scales only the translation column when a scale is given', () => {
        const result = arglCameraViewRHf(glMatrix, undefined, 2);

        expect([result[12], result[13], result[14]]).toEqual([8, -16, -24]);
        // Rotation must be untouched, or the marker changes size as well as position.
        expect([result[0], result[1], result[2]]).toEqual([1, -5, -9]);
    });

    it('ignores a zero scale rather than collapsing the translation', () => {
        const result = arglCameraViewRHf(glMatrix, undefined, 0);
        expect([result[12], result[13], result[14]]).toEqual([4, -8, -12]);
    });

    it('writes into a supplied buffer instead of allocating', () => {
        const out = new Float32Array(16);
        expect(arglCameraViewRHf(glMatrix, out)).toBe(out);
    });
});

describe('getCameraProjectionMatrix', () => {
    it('returns the matrix the core reports', () => {
        const { state } = createMockState();
        expect(Array.from(getCameraProjectionMatrix(state))).toEqual(new Array(16).fill(0.5));
    });

    it('throws once the state is disposed', () => {
        const { state } = createMockState();
        state.disposed = true;

        expect(() => getCameraProjectionMatrix(state)).toThrow(ARToolKitError);
    });
});
