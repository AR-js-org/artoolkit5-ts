/*
 *  config.ts
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
 * Detector configuration options and their mapping to `@ar-js-org/artoolkit5-constants`.
 *
 * This is the only module in the library that imports a numeric ARToolKit5
 * constant. Every option below is a string union in the public API; the C
 * integer it maps to lives exclusively in the lookup tables here, typed as
 * `Record<Union, number>` so the compiler rejects a union member with no
 * mapping.
 */

import {
    AR_IMAGE_PROC_FIELD_IMAGE,
    AR_IMAGE_PROC_FRAME_IMAGE,
    AR_LABELING_BLACK_REGION,
    AR_LABELING_THRESH_MODE_AUTO_BRACKETING,
    AR_LABELING_THRESH_MODE_AUTO_MEDIAN,
    AR_LABELING_THRESH_MODE_AUTO_OTSU,
    AR_LABELING_THRESH_MODE_MANUAL,
    AR_LABELING_WHITE_REGION,
    AR_MATRIX_CODE_3x3,
    AR_MATRIX_CODE_3x3_HAMMING63,
    AR_MATRIX_CODE_3x3_PARITY65,
    AR_MATRIX_CODE_4x4,
    AR_MATRIX_CODE_4x4_BCH_13_5_5,
    AR_MATRIX_CODE_4x4_BCH_13_9_3,
    AR_MATRIX_CODE_5x5,
    AR_MATRIX_CODE_5x5_BCH_22_12_5,
    AR_MATRIX_CODE_5x5_BCH_22_7_7,
    AR_MATRIX_CODE_6x6,
    AR_MATRIX_CODE_DETECTION,
    AR_TEMPLATE_MATCHING_COLOR,
    AR_TEMPLATE_MATCHING_COLOR_AND_MATRIX,
    AR_TEMPLATE_MATCHING_MONO,
    AR_TEMPLATE_MATCHING_MONO_AND_MATRIX,
} from '@ar-js-org/artoolkit5-constants';
import { ARToolKitError } from './errors';

export type DetectionMode = 'color' | 'mono' | 'matrix' | 'color_and_matrix' | 'mono_and_matrix';

/**
 * `'global_id'` is deliberately absent. `AR_MATRIX_CODE_GLOBAL_ID` decodes a
 * 64-bit value into `markerInfo->globalID`, and that field is not bound, so
 * nothing here can read what the mode decoded (artoolkit5-wasm#29).
 *
 * Offering it anyway would not leave the mode inert — it would leave it
 * aliasing. The engine still fills `idMatrix`, the field `processFrame` reads:
 * a global ID below 32768 is reported as itself, and **every** larger one is
 * reported as `0` (`arPattGetID.c:213-217`). A barcode registered as `0` would
 * therefore match every large global-ID marker in view, and with none
 * registered those markers would silently never match at all.
 *
 * Re-adding it once the value is bound is a non-breaking addition. Shipping it
 * first would be the expensive order: #29 has still to settle how a 64-bit
 * value crosses into JavaScript, and by then that would be released API.
 */
export type MatrixCodeType =
    | '3x3'
    | '3x3_PARITY65'
    | '3x3_HAMMING63'
    | '4x4'
    | '4x4_BCH_13_9_3'
    | '4x4_BCH_13_5_5'
    | '5x5'
    | '5x5_BCH_22_7_7'
    | '5x5_BCH_22_12_5'
    | '6x6';

/**
 * `'auto_adaptive'` is deliberately absent. `AR_LABELING_THRESH_MODE_AUTO_ADAPTIVE`
 * is exported by the constants package, but `AR_DISABLE_THRESH_MODE_AUTO_ADAPTIVE`
 * is set in the WebARKitLib build this module compiles against, which compiles out
 * its `case` in `arCreateHandle.c`. Passing it silently falls through to `manual`.
 * Offering a mode that cannot work would be worse than not offering it; re-adding
 * it if the upstream build flag changes is a non-breaking addition.
 */
export type ThresholdMode = 'manual' | 'auto_median' | 'auto_otsu' | 'auto_bracketing';

export type ImageProcMode = 'frame' | 'field';

/** `'black_region'` — black-bordered markers on a white background — is the engine default. */
export type LabelingMode = 'white_region' | 'black_region';

/**
 * Minimum match confidence per marker family, 0.0 to 1.0.
 *
 * The two families are not comparable, so they take separate thresholds.
 *
 * Confidence is a continuous quality score for *both* families, not a verdict:
 * it moves with viewing angle, distance and focus. Measured on real hardware,
 * the genuine and spurious ranges overlap in both directions — a genuine
 * barcode read 0.500 at an awkward angle while a misread of a pattern marker
 * reached 0.867. So no threshold avoids both missed markers and admitted
 * phantoms; see the README for the measurements and the trade-off.
 *
 * Omitted keys are left unchanged. Both default to 0, which filters nothing
 * beyond the engine's own cutoff of 0.5.
 */
export interface MinConfidence {
    /** Applies to pattern markers, compared against `cfPatt`. */
    pattern?: number;
    /** Applies to barcode markers, compared against `cfMatrix`. */
    barcode?: number;
}

export interface DetectorOptions {
    detectionMode?: DetectionMode;
    matrixCodeType?: MatrixCodeType;
    /** Luma threshold, 0-255. Only meaningful when `thresholdMode` is `'manual'`. */
    threshold?: number;
    thresholdMode?: ThresholdMode;
    labelingMode?: LabelingMode;
    imageProcMode?: ImageProcMode;
    /** Proportion of the marker occupied by the pattern. Exclusive of 0 and 1. */
    patternRatio?: number;
    nearPlane?: number;
    farPlane?: number;
    /**
     * Rejects weak matches, per family. Unlike every other option here this
     * is applied by this library rather than passed to the engine — ARToolKit
     * has no setter for it.
     */
    minConfidence?: MinConfidence;
}

export const DETECTION_MODES: Record<DetectionMode, number> = {
    color: AR_TEMPLATE_MATCHING_COLOR,
    mono: AR_TEMPLATE_MATCHING_MONO,
    matrix: AR_MATRIX_CODE_DETECTION,
    color_and_matrix: AR_TEMPLATE_MATCHING_COLOR_AND_MATRIX,
    mono_and_matrix: AR_TEMPLATE_MATCHING_MONO_AND_MATRIX,
};

export const MATRIX_CODE_TYPES: Record<MatrixCodeType, number> = {
    '3x3': AR_MATRIX_CODE_3x3,
    '3x3_PARITY65': AR_MATRIX_CODE_3x3_PARITY65,
    '3x3_HAMMING63': AR_MATRIX_CODE_3x3_HAMMING63,
    '4x4': AR_MATRIX_CODE_4x4,
    '4x4_BCH_13_9_3': AR_MATRIX_CODE_4x4_BCH_13_9_3,
    '4x4_BCH_13_5_5': AR_MATRIX_CODE_4x4_BCH_13_5_5,
    '5x5': AR_MATRIX_CODE_5x5,
    '5x5_BCH_22_7_7': AR_MATRIX_CODE_5x5_BCH_22_7_7,
    '5x5_BCH_22_12_5': AR_MATRIX_CODE_5x5_BCH_22_12_5,
    '6x6': AR_MATRIX_CODE_6x6,
};

export const THRESHOLD_MODES: Record<ThresholdMode, number> = {
    manual: AR_LABELING_THRESH_MODE_MANUAL,
    auto_median: AR_LABELING_THRESH_MODE_AUTO_MEDIAN,
    auto_otsu: AR_LABELING_THRESH_MODE_AUTO_OTSU,
    auto_bracketing: AR_LABELING_THRESH_MODE_AUTO_BRACKETING,
};

export const IMAGE_PROC_MODES: Record<ImageProcMode, number> = {
    frame: AR_IMAGE_PROC_FRAME_IMAGE,
    field: AR_IMAGE_PROC_FIELD_IMAGE,
};

export const LABELING_MODES: Record<LabelingMode, number> = {
    white_region: AR_LABELING_WHITE_REGION,
    black_region: AR_LABELING_BLACK_REGION,
};

/**
 * Looks up `value` in `table`, throwing a message that names the option and
 * lists what it does accept — the failure mode a raw `table[value]` cannot
 * give you, since an unknown key there is `undefined`, not an error.
 *
 * `Object.prototype.hasOwnProperty` guards against inherited keys: `table`
 * is a plain object literal, so `value` arriving as e.g. `'toString'` from
 * outside TypeScript's type safety (a plain-JS caller, JSON, a UI control)
 * would otherwise resolve to `Object.prototype.toString` rather than
 * `undefined`, silently passing a function into the setter instead of
 * throwing.
 */
export function lookUp<T extends string>(
    table: Record<T, number>,
    value: T,
    optionName: string
): number {
    const resolved = Object.prototype.hasOwnProperty.call(table, value)
        ? table[value]
        : undefined;
    if (resolved === undefined) {
        const validValues = Object.keys(table).join(', ');
        throw new ARToolKitError(
            `Invalid value ${JSON.stringify(value)} for '${optionName}'. ` +
            `Valid values are: ${validValues}.`
        );
    }
    return resolved;
}
