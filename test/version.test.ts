/*
 *  version.test.ts
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

import { ARTOOLKIT5_TS_VERSION, VERSION } from '../src/index';

import pkg from '../package.json';

describe('package version', () => {
    // The point of the whole feature: a built copy can be identified. Asserting
    // against package.json rather than a literal is what stops this test needing
    // an edit at every release — and what would catch the injection silently
    // breaking and leaving a stale or placeholder value behind.
    it('matches the version in package.json', () => {
        expect(VERSION).toBe(pkg.version);
    });

    it('is also exported under the package-specific name', () => {
        expect(ARTOOLKIT5_TS_VERSION).toBe(pkg.version);
    });

    it('is a plain semver string, not a template left unreplaced', () => {
        expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
});
