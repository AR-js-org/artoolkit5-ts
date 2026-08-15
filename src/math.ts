/*
 *  math.ts
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

import { ARToolKitState } from './domain';
import { assertNotDisposed } from './errors';

const GL_MATRIX_LENGTH = 16;

/**
 * Returns the camera projection matrix computed by ARToolKit from the loaded
 * `camera_para.dat`, accounting for real lens distortion.
 *
 * NOTE: unlike `getTransform`, which returns a heap pointer, this returns the
 * matrix directly. That asymmetry is unverified against the C++ source. See
 * "spike: verify what getCameraLens() actually returns":
 * https://github.com/AR-js-org/artoolkit5-ts/issues/10
 *
 * @throws {ARToolKitError} if the state has been disposed.
 */
export function getCameraProjectionMatrix(state: ARToolKitState): Float64Array {
    assertNotDisposed(state, 'getCameraProjectionMatrix');
    return state.core.getCameraLens();
}

/**
 * Expands ARToolKit's 3x4 row-major pose into a 4x4 column-major matrix.
 *
 * @param out Optional destination. Supply one in hot paths to avoid allocating.
 */
export function transMatToGLMat(
    transMat: Float64Array,
    out: Float32Array = new Float32Array(GL_MATRIX_LENGTH)
): Float32Array {
    out[0] = transMat[0];
    out[1] = transMat[4];
    out[2] = transMat[8];
    out[3] = 0.0;

    out[4] = transMat[1];
    out[5] = transMat[5];
    out[6] = transMat[9];
    out[7] = 0.0;

    out[8] = transMat[2];
    out[9] = transMat[6];
    out[10] = transMat[10];
    out[11] = 0.0;

    out[12] = transMat[3];
    out[13] = transMat[7];
    out[14] = transMat[11];
    out[15] = 1.0;

    return out;
}

/**
 * Converts a 4x4 ARToolKit matrix into the right-handed coordinate system used
 * by WebGL, by negating the Y and Z axes.
 *
 * Without this the pose renders behind the camera. It is the mathematically
 * correct equivalent of manually flipping matrix signs.
 *
 * @param out Optional destination. Supply one in hot paths to avoid allocating.
 * @param scale Optional uniform scale applied to the translation column.
 */
export function arglCameraViewRHf(
    glMatrix: Float32Array,
    out: Float32Array = new Float32Array(GL_MATRIX_LENGTH),
    scale?: number
): Float32Array {
    // x axis, unchanged
    out[0] = glMatrix[0];
    out[4] = glMatrix[4];
    out[8] = glMatrix[8];
    out[12] = glMatrix[12];

    // y axis, negated
    out[1] = -glMatrix[1];
    out[5] = -glMatrix[5];
    out[9] = -glMatrix[9];
    out[13] = -glMatrix[13];

    // z axis, negated
    out[2] = -glMatrix[2];
    out[6] = -glMatrix[6];
    out[10] = -glMatrix[10];
    out[14] = -glMatrix[14];

    out[3] = 0;
    out[7] = 0;
    out[11] = 0;
    out[15] = 1;

    if (scale !== undefined && scale !== 0.0) {
        out[12] *= scale;
        out[13] *= scale;
        out[14] *= scale;
    }

    return out;
}
