/*
 *  docs-versions.test.js
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

/*
 * Keeps the dependency ranges quoted in the documentation equal to the ones in
 * `package.json`.
 *
 * Not hypothetical: #89 raised `@ar-js-org/artoolkit5-wasm` from `^0.4.0` to
 * `^0.4.2` and left three statements of the old range behind — two in
 * `README.md`, one in `AGENTS.md`. All three read as current fact rather than
 * as examples, so each was simply wrong, and a reader overriding the range
 * would have overridden it to the wrong floor. Found by sweeping for stale
 * versions while fixing #83, which was the same class one step milder.
 *
 * It will recur: #77 raises this dependency again for wasm 0.5.0.
 *
 * Plain JavaScript, not TypeScript, because it reads files. `tsconfig.json`
 * narrows `types` to `["vite/client"]` and deliberately omits `node` — "nothing
 * under `src`, `test` or `examples` uses a Node global" — and a `.ts` test
 * importing `node:fs` would force that decision open for the sake of a
 * documentation check. `release-notes.test.js` and `dist-tag.test.js` are here
 * for the same reason.
 *
 * Only ranges written as a quoted `^x.y.z` next to the package's name are
 * checked. Prose about *historical* versions is left alone, and must be: "0.2.0
 * carries no attestation" is a true record that would be false if updated.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

/** Files that state what this package depends on, as opposed to narrating it. */
const DOCS = ['README.md', 'AGENTS.md'];

/**
 * A caret range in backticks, on a line that also names the package.
 *
 * Line-scoped on purpose: a range anywhere in a document is not a claim about
 * that package, and matching across lines would pair a version with whatever
 * name happened to be nearby.
 */
function quotedRanges(text, dependency) {
    const found = [];
    const lines = text.split('\n');

    for (const [index, line] of lines.entries()) {
        if (!line.includes(dependency)) continue;
        for (const [, range] of line.matchAll(/`(\^\d+\.\d+\.\d+)`/g)) {
            found.push({ line: index + 1, range });
        }
    }
    return found;
}

describe('dependency ranges quoted in the documentation', () => {
    for (const [dependency, declared] of Object.entries(pkg.dependencies)) {
        for (const file of DOCS) {
            const text = readFileSync(file, 'utf8');
            const quoted = quotedRanges(text, dependency);

            // `it` per file and dependency rather than one aggregate assertion,
            // so a failure names which file disagrees instead of dumping every
            // pairing at once.
            it(`${file} agrees with package.json about ${dependency}`, () => {
                for (const { line, range } of quoted) {
                    expect(range, `${file}:${line} quotes ${range}`).toBe(declared);
                }
            });
        }
    }

    // Guards the guard. If the pattern ever stops matching — someone reformats
    // the range out of backticks, say — every assertion above passes over an
    // empty list and the check quietly stops working.
    it('actually found the ranges it is checking', () => {
        const total = Object.keys(pkg.dependencies).reduce(
            (sum, dependency) =>
                sum + DOCS.reduce(
                    (n, file) => n + quotedRanges(readFileSync(file, 'utf8'), dependency).length,
                    0
                ),
            0
        );
        expect(total).toBeGreaterThan(0);
    });
});
