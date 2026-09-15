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
 * Applies detector tuning.
 *
 * Only the keys present in `opts` are applied — a partial call mid-session
 * changes just those settings and leaves everything else as it was.
 *
 * Every option but one is handed to the ARToolKit5 engine. `minConfidence`
 * is the exception: the engine's confidence cutoff is a compile-time
 * constant with no setter, so that threshold is recorded on `state` and
 * applied by `processFrame` instead.
 *
 * Setting `nearPlane` or `farPlane` also recomputes the projection matrix
 * `getCameraProjectionMatrix` returns, so a change is visible on the very
 * next call rather than requiring a separate step to take effect.
 *
 * @throws {ARToolKitError} if the state has been disposed, if a string option
 *   is not one of its documented values, or if `threshold` or `patternRatio` is
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

    if (opts.patternRatio !== undefined) {
        state.core.setPattRatio(validatePatternRatio(opts.patternRatio));
    }

    if (opts.minConfidence !== undefined) {
        const { pattern, barcode } = opts.minConfidence;
        if (pattern !== undefined) {
            state.minConfidence.pattern = validateConfidence(pattern, 'minConfidence.pattern');
        }
        if (barcode !== undefined) {
            state.minConfidence.barcode = validateConfidence(barcode, 'minConfidence.barcode');
        }
    }

    if (opts.nearPlane !== undefined) {
        state.core.setProjectionNearPlane(opts.nearPlane);
    }

    if (opts.farPlane !== undefined) {
        state.core.setProjectionFarPlane(opts.farPlane);
    }

    // setProjectionNearPlane/FarPlane only assign the field; the projection
    // matrix getCameraProjectionMatrix returns is a cache that stays stale
    // until this recomputes it. Called once, and only when a plane actually
    // changed — every other option is unrelated to the camera frustum, and
    // recomputing on every call would make a call that touches neither plane
    // do WASM work its own opts said nothing about.
    if (opts.nearPlane !== undefined || opts.farPlane !== undefined) {
        state.core.recalculateCameraLens();
    }
}

/**
 * `arSetLabelingThresh` silently no-ops outside 0-255 (`ARToolKitCore.cpp:396`),
 * so an out-of-range value would otherwise fail without any indication why.
 *
 * `Number.isInteger` rather than a plain range comparison: `threshold < 0 ||
 * threshold > 255` lets `NaN` through, since every comparison against `NaN`
 * is `false`. It also rejects a fractional value the bound C++ setter takes
 * as `int` — `Number.isInteger` catches both in one check, since `NaN` and
 * every non-integer number both fail it.
 */
function validateThreshold(threshold: number): number {
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) {
        throw new ARToolKitError(
            `Invalid value ${threshold} for 'threshold'. Must be an integer between 0 and 255 inclusive.`
        );
    }
    return threshold;
}

/**
 * `arSetPattRatio` silently no-ops when `ratio <= 0` or `ratio >= 1`
 * (`ARToolKitCore.cpp:311`), so an out-of-range value would otherwise fail
 * without any indication why.
 *
 * `Number.isFinite` guards against `NaN` and `Infinity`, neither of which
 * `patternRatio <= 0 || patternRatio >= 1` catches on its own — every comparison
 * against `NaN` is `false`, so it passes both halves of that check. Unlike
 * `threshold`, a fraction is exactly what this option expects, so this stays
 * a finiteness check rather than an integer one.
 */
/**
 * A threshold outside 0..1 is always a mistake rather than a strict filter:
 * above 1 rejects every marker including perfect matrix decodes, and below 0
 * is meaningless since the engine never reports a negative confidence for a
 * match. Rejecting it here beats silently tracking nothing.
 */
function validateConfidence(value: number, optionName: string): number {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new ARToolKitError(
            `Invalid value ${value} for '${optionName}'. Must be a finite number between 0 and 1 inclusive.`
        );
    }
    return value;
}

function validatePatternRatio(patternRatio: number): number {
    if (!Number.isFinite(patternRatio) || patternRatio <= 0 || patternRatio >= 1) {
        throw new ARToolKitError(
            `Invalid value ${patternRatio} for 'patternRatio'. Must be a finite number greater than 0 and less than 1.`
        );
    }
    return patternRatio;
}
