/*
 *  dist-tag.test.js
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
 * The dist-tag decision, and the version comparison under it.
 *
 * Worth testing properly rather than by inspection: `latest` is what a plain
 * `npm install` resolves, so a wrong answer here changes what every consumer
 * gets, and the mistake is only visible to someone who looks at the registry.
 * The comparison is also hand-rolled — `semver` is not a dependency here — so
 * the ordering rules it implements are asserted rather than assumed.
 *
 * The registry lookup is passed in rather than performed, so none of this
 * touches the network.
 */

import { describe, expect, it } from 'vitest';

import { chooseDistTag, comparePrecedence, parseVersion } from '../scripts/dist-tag.mjs';

const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);

describe('parseVersion', () => {
    it('reads the core and the prerelease apart', () => {
        expect(parseVersion('1.2.3')).toEqual({ core: [1, 2, 3], prerelease: null });
        expect(parseVersion('0.4.0-rc.1')).toEqual({ core: [0, 4, 0], prerelease: 'rc.1' });
    });

    it('rejects what is not a version', () => {
        // A leading v is the common mistake, since the tag carries one.
        for (const bad of ['v1.2.3', '1.2', '1.2.3.4', '', 'latest', '1.2.3+build']) {
            expect(parseVersion(bad), bad).toBeNull();
        }
    });
});

describe('comparePrecedence', () => {
    it('orders by major, then minor, then patch', () => {
        expect(sign(comparePrecedence('1.0.0', '0.9.9'))).toBe(1);
        expect(sign(comparePrecedence('0.4.0', '0.3.9'))).toBe(1);
        expect(sign(comparePrecedence('0.3.2', '0.3.10'))).toBe(-1);
        expect(sign(comparePrecedence('0.3.1', '0.3.1'))).toBe(0);
    });

    // Numerically, not as text: this is why the components are parsed rather
    // than compared as strings, where "10" sorts before "9".
    it('compares components as numbers', () => {
        expect(sign(comparePrecedence('0.10.0', '0.9.0'))).toBe(1);
        expect(sign(comparePrecedence('1.0.0', '0.100.0'))).toBe(1);
    });

    it('ranks a release above any prerelease of itself', () => {
        expect(sign(comparePrecedence('1.0.0', '1.0.0-rc.1'))).toBe(1);
        expect(sign(comparePrecedence('1.0.0-rc.1', '1.0.0'))).toBe(-1);
    });

    // A prerelease still loses to a lower release, which is the case that makes
    // "newest tag pushed" and "should be latest" different questions.
    it('ranks a prerelease below an earlier release', () => {
        expect(sign(comparePrecedence('1.0.0-rc.1', '0.9.0'))).toBe(1);
        expect(sign(comparePrecedence('0.9.0', '1.0.0-rc.1'))).toBe(-1);
    });

    it('orders prereleases by identifier, numerically where they are numbers', () => {
        expect(sign(comparePrecedence('1.0.0-rc.2', '1.0.0-rc.10'))).toBe(-1);
        expect(sign(comparePrecedence('1.0.0-alpha', '1.0.0-beta'))).toBe(-1);
        expect(sign(comparePrecedence('1.0.0-rc.1', '1.0.0-rc.1'))).toBe(0);
    });

    it('ranks a numeric identifier below an alphanumeric one', () => {
        expect(sign(comparePrecedence('1.0.0-1', '1.0.0-alpha'))).toBe(-1);
    });

    it('ranks a shorter prerelease below a longer one with the same prefix', () => {
        expect(sign(comparePrecedence('1.0.0-rc', '1.0.0-rc.1'))).toBe(-1);
    });

    // The example chain from the semver specification, which is the clearest
    // single check that the rules above compose correctly.
    it('reproduces the ordering from the semver specification', () => {
        const ascending = [
            '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta',
            '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0',
        ];
        for (let i = 0; i < ascending.length - 1; i++) {
            expect(
                sign(comparePrecedence(ascending[i], ascending[i + 1])),
                `${ascending[i]} should precede ${ascending[i + 1]}`
            ).toBe(-1);
        }
    });

    it('throws on something that is not a version', () => {
        expect(() => comparePrecedence('1.0.0', 'latest')).toThrow(/Not a version: latest/);
    });
});

describe('chooseDistTag', () => {
    const choose = (version, latest, fallback = 'recovered') =>
        chooseDistTag({ version, latest, fallback }).tag;

    it('takes latest for a newer stable version', () => {
        expect(choose('0.4.0', '0.3.1')).toBe('latest');
    });

    it('leaves latest alone for an older version', () => {
        expect(choose('0.3.0', '0.3.1')).toBe('recovered');
    });

    it('leaves latest alone for the same version', () => {
        expect(choose('0.3.1', '0.3.1')).toBe('recovered');
    });

    // The half of #81 that was latent: a prerelease must never be latest, and
    // the old order gave it latest whenever the lookup came back empty.
    it('never gives a prerelease latest, even with nothing published', () => {
        expect(choose('0.4.0-rc.1', '0.3.1')).toBe('recovered');
        expect(choose('0.4.0-rc.1', null)).toBe('recovered');
        expect(choose('1.0.0-rc.1', '0.1.0')).toBe('recovered');
    });

    it('takes latest for the first published version', () => {
        expect(choose('0.1.0', null)).toBe('latest');
    });

    it('uses the caller\'s fallback name', () => {
        // `release.yml` publishes a prerelease under `next`, npm's convention;
        // `publish-tag.yml` recovers an older version under `recovered`.
        expect(choose('0.4.0-rc.1', '0.3.1', 'next')).toBe('next');
        expect(choose('0.3.0', '0.3.1', 'recovered')).toBe('recovered');
    });

    it('explains itself, since the reason reaches the run log', () => {
        expect(chooseDistTag({ version: '0.4.0', latest: '0.3.1', fallback: 'next' }).why)
            .toMatch(/0\.4\.0 is newer than the published 0\.3\.1/);
    });

    it('throws on something that is not a version', () => {
        expect(() => choose('v0.4.0', '0.3.1')).toThrow(/Not a version/);
    });
});
