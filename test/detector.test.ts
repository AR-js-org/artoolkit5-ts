/*
 *  detector.test.ts
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
import * as constants from '@ar-js-org/artoolkit5-constants';
import { configureDetector } from '../src/detector';
import {
    DETECTION_MODES,
    IMAGE_PROC_MODES,
    LABELING_MODES,
    MATRIX_CODE_TYPES,
    THRESHOLD_MODES,
} from '../src/config';
import { ARToolKitError } from '../src/errors';
import { createMockState } from './mock-core';

describe('configureDetector', () => {
    it('applies only the keys present in opts', () => {
        const { state, calls } = createMockState();

        configureDetector(state, { detectionMode: 'matrix' });

        expect(calls.detector.setPatternDetectionMode).toBe(constants.AR_MATRIX_CODE_DETECTION);
        expect(calls.detector).not.toHaveProperty('setThreshold');
        expect(calls.detector).not.toHaveProperty('setLabelingMode');
        expect(calls.detector).not.toHaveProperty('setPattRatio');
    });

    it('applies every option, each to its own setter with the right constant', () => {
        const { state, calls } = createMockState();

        configureDetector(state, {
            detectionMode: 'mono+matrix',
            matrixCodeType: '4x4_bch_13_9_3',
            threshold: 120,
            thresholdMode: 'auto-otsu',
            labelingMode: 'white-region',
            imageProcMode: 'field',
            pattRatio: 0.6,
            nearPlane: 1,
            farPlane: 1000,
        });

        expect(calls.detector).toEqual({
            setPatternDetectionMode: constants.AR_TEMPLATE_MATCHING_MONO_AND_MATRIX,
            setMatrixCodeType: constants.AR_MATRIX_CODE_4x4_BCH_13_9_3,
            setThreshold: 120,
            setThresholdMode: constants.AR_LABELING_THRESH_MODE_AUTO_OTSU,
            setLabelingMode: constants.AR_LABELING_WHITE_REGION,
            setImageProcMode: constants.AR_IMAGE_PROC_FIELD_IMAGE,
            setPattRatio: 0.6,
            setProjectionNearPlane: 1,
            setProjectionFarPlane: 1000,
        });
    });

    it('calls nothing when opts is empty', () => {
        const { state, calls } = createMockState();

        configureDetector(state, {});

        expect(calls.detector).toEqual({});
    });

    it.each([
        ['detectionMode', 'not-a-mode'],
        ['matrixCodeType', 'not-a-type'],
        ['thresholdMode', 'not-a-mode'],
        ['labelingMode', 'not-a-region'],
        ['imageProcMode', 'not-a-proc-mode'],
        // 'auto-adaptive' is a real constant name, deliberately not in the
        // union — this is the case the omission is meant to catch.
        ['thresholdMode', 'auto-adaptive'],
    ] as const)('throws ARToolKitError for an invalid %s', (option, value) => {
        const { state } = createMockState();

        expect(() => configureDetector(state, { [option]: value } as never)).toThrow(
            ARToolKitError
        );
    });

    it('names the invalid option and lists valid values in the message', () => {
        const { state } = createMockState();

        expect(() => configureDetector(state, { labelingMode: 'sideways' as never })).toThrow(
            /'labelingMode'.*white-region.*black-region/s
        );
    });

    describe('threshold', () => {
        it.each([0, 100, 255])('accepts %i', (threshold) => {
            const { state, calls } = createMockState();
            configureDetector(state, { threshold });
            expect(calls.detector.setThreshold).toBe(threshold);
        });

        it.each([-1, 256])('rejects %i, which the engine would otherwise silently ignore', (threshold) => {
            const { state } = createMockState();
            expect(() => configureDetector(state, { threshold })).toThrow(ARToolKitError);
        });
    });

    describe('pattRatio', () => {
        it.each([0.1, 0.5, 0.9])('accepts %f', (pattRatio) => {
            const { state, calls } = createMockState();
            configureDetector(state, { pattRatio });
            expect(calls.detector.setPattRatio).toBe(pattRatio);
        });

        it.each([0, 1, -0.1, 1.1])(
            'rejects %f, which the engine would otherwise silently ignore',
            (pattRatio) => {
                const { state } = createMockState();
                expect(() => configureDetector(state, { pattRatio })).toThrow(ARToolKitError);
            }
        );
    });

    it('throws once the state is disposed', () => {
        const { state } = createMockState();
        state.disposed = true;

        expect(() => configureDetector(state, { threshold: 100 })).toThrow(ARToolKitError);
    });
});

/**
 * Guards against the mapping tables drifting from the constants package —
 * `Record<Union, number>` catches a missing key at compile time, but not a
 * value that no longer matches what the constants package actually exports.
 */
describe('mapping tables match @ar-js-org/artoolkit5-constants', () => {
    it('DETECTION_MODES', () => {
        expect(DETECTION_MODES).toEqual({
            color: constants.AR_TEMPLATE_MATCHING_COLOR,
            mono: constants.AR_TEMPLATE_MATCHING_MONO,
            matrix: constants.AR_MATRIX_CODE_DETECTION,
            'color+matrix': constants.AR_TEMPLATE_MATCHING_COLOR_AND_MATRIX,
            'mono+matrix': constants.AR_TEMPLATE_MATCHING_MONO_AND_MATRIX,
        });
    });

    it('MATRIX_CODE_TYPES', () => {
        expect(MATRIX_CODE_TYPES).toEqual({
            '3x3': constants.AR_MATRIX_CODE_3x3,
            '3x3_parity65': constants.AR_MATRIX_CODE_3x3_PARITY65,
            '3x3_hamming63': constants.AR_MATRIX_CODE_3x3_HAMMING63,
            '4x4': constants.AR_MATRIX_CODE_4x4,
            '4x4_bch_13_9_3': constants.AR_MATRIX_CODE_4x4_BCH_13_9_3,
            '4x4_bch_13_5_5': constants.AR_MATRIX_CODE_4x4_BCH_13_5_5,
            '5x5': constants.AR_MATRIX_CODE_5x5,
            '5x5_bch_22_7_7': constants.AR_MATRIX_CODE_5x5_BCH_22_7_7,
            '5x5_bch_22_12_5': constants.AR_MATRIX_CODE_5x5_BCH_22_12_5,
            '6x6': constants.AR_MATRIX_CODE_6x6,
            global_id: constants.AR_MATRIX_CODE_GLOBAL_ID,
        });
    });

    it('THRESHOLD_MODES', () => {
        expect(THRESHOLD_MODES).toEqual({
            manual: constants.AR_LABELING_THRESH_MODE_MANUAL,
            'auto-median': constants.AR_LABELING_THRESH_MODE_AUTO_MEDIAN,
            'auto-otsu': constants.AR_LABELING_THRESH_MODE_AUTO_OTSU,
            'auto-bracketing': constants.AR_LABELING_THRESH_MODE_AUTO_BRACKETING,
        });

        // The upstream build compiles this mode's case out; offering it would
        // silently degrade to 'manual'. Asserting its absence turns a future
        // accidental re-add into a failing test rather than a silent lie.
        expect(THRESHOLD_MODES).not.toHaveProperty('auto-adaptive');
    });

    it('IMAGE_PROC_MODES', () => {
        expect(IMAGE_PROC_MODES).toEqual({
            frame: constants.AR_IMAGE_PROC_FRAME_IMAGE,
            field: constants.AR_IMAGE_PROC_FIELD_IMAGE,
        });
    });

    it('LABELING_MODES', () => {
        expect(LABELING_MODES).toEqual({
            'white-region': constants.AR_LABELING_WHITE_REGION,
            'black-region': constants.AR_LABELING_BLACK_REGION,
        });
    });
});
