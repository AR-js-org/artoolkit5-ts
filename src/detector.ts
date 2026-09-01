/*
 *  detector.ts
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

import {
    DETECTION_MODES,
    DetectorOptions,
    IMAGE_PROC_MODES,
    LABELING_MODES,
    lookUp,
    MATRIX_CODE_TYPES,
    THRESHOLD_MODES,
} from './config';
import { ARToolKitState } from './domain';
import { ARToolKitError, assertNotDisposed } from './errors';

/**
 * Applies detector tuning to the underlying ARToolKit5 engine.
 *
 * Only the keys present in `opts` are applied — a partial call mid-session
 * changes just those settings and leaves everything else as it was.
 *
 * @throws {ARToolKitError} if the state has been disposed, if a string option
 *   is not one of its documented values, or if `threshold` or `pattRatio` is
 *   outside the range the engine accepts.
 */
export function configureDetector(state: ARToolKitState, opts: DetectorOptions): void {
    assertNotDisposed(state, 'configureDetector');

    if (opts.detectionMode !== undefined) {
        state.core.setPatternDetectionMode(
            lookUp(DETECTION_MODES, opts.detectionMode, 'detectionMode')
        );
    }

    if (opts.matrixCodeType !== undefined) {
        state.core.setMatrixCodeType(lookUp(MATRIX_CODE_TYPES, opts.matrixCodeType, 'matrixCodeType'));
    }

    if (opts.threshold !== undefined) {
        state.core.setThreshold(validateThreshold(opts.threshold));
    }

    if (opts.thresholdMode !== undefined) {
        state.core.setThresholdMode(lookUp(THRESHOLD_MODES, opts.thresholdMode, 'thresholdMode'));
    }

    if (opts.labelingMode !== undefined) {
        state.core.setLabelingMode(lookUp(LABELING_MODES, opts.labelingMode, 'labelingMode'));
    }

    if (opts.imageProcMode !== undefined) {
        state.core.setImageProcMode(lookUp(IMAGE_PROC_MODES, opts.imageProcMode, 'imageProcMode'));
    }

    if (opts.pattRatio !== undefined) {
        state.core.setPattRatio(validatePattRatio(opts.pattRatio));
    }

    if (opts.nearPlane !== undefined) {
        state.core.setProjectionNearPlane(opts.nearPlane);
    }

    if (opts.farPlane !== undefined) {
        state.core.setProjectionFarPlane(opts.farPlane);
    }
}

/**
 * `arSetLabelingThresh` silently no-ops outside 0-255 (`ARToolKitCore.cpp:396`),
 * so an out-of-range value would otherwise fail without any indication why.
 */
function validateThreshold(threshold: number): number {
    if (threshold < 0 || threshold > 255) {
        throw new ARToolKitError(
            `Invalid value ${threshold} for 'threshold'. Must be between 0 and 255 inclusive.`
        );
    }
    return threshold;
}

/**
 * `arSetPattRatio` silently no-ops when `ratio <= 0` or `ratio >= 1`
 * (`ARToolKitCore.cpp:311`), so an out-of-range value would otherwise fail
 * without any indication why.
 */
function validatePattRatio(pattRatio: number): number {
    if (pattRatio <= 0 || pattRatio >= 1) {
        throw new ARToolKitError(
            `Invalid value ${pattRatio} for 'pattRatio'. Must be greater than 0 and less than 1.`
        );
    }
    return pattRatio;
}
