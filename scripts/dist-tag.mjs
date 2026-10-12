/*
 *  dist-tag.mjs
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
 * Which npm dist-tag a version should be published under.
 *
 * `npm publish` moves `latest` unless told otherwise, and `latest` is what a
 * plain `npm install` resolves — so pointing it at a prerelease, or at a
 * version older than one already out, changes what every consumer gets.
 *
 * Shared by `release.yml` and `publish-tag.yml`. It used to live inline in
 * `publish-tag.yml` only, which was fine while that was the sole publisher;
 * once a tag push publishes too, `release.yml` needed the same answer, and two
 * copies of this in shell is exactly the drift #82 was about.
 *
 *   node scripts/dist-tag.mjs 0.4.0                 # -> latest
 *   node scripts/dist-tag.mjs 0.4.0-rc.1 --fallback next
 *
 * The chosen tag goes to stdout; everything explaining it goes to stderr, so
 * `DIST_TAG="$(node scripts/dist-tag.mjs "$VERSION")"` is safe.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** `X.Y.Z` with an optional prerelease suffix, as npm versions this package. */
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseVersion(version) {
    const match = VERSION_PATTERN.exec(version);
    if (!match) return null;
    return {
        core: [Number(match[1]), Number(match[2]), Number(match[3])],
        prerelease: match[4] ?? null,
    };
}

/**
 * Semver precedence, limited to what this package can produce: no build
 * metadata, which semver ignores for precedence anyway.
 *
 * Hand-rolled rather than delegated to the `semver` package, which is not a
 * dependency here, and rather than shelling out to `npx semver@7`, which is
 * what the inline version did — that fetches from the network in the middle of
 * a release, and cannot be unit-tested. The rules below are covered by
 * test/dist-tag.test.js, including the prerelease ordering.
 *
 * @returns negative if `a` precedes `b`, 0 if equal, positive if `a` follows.
 */
export function comparePrecedence(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    if (!left || !right) throw new Error(`Not a version: ${!left ? a : b}`);

    for (let i = 0; i < 3; i++) {
        if (left.core[i] !== right.core[i]) return left.core[i] - right.core[i];
    }

    // Equal core. A release outranks any prerelease of itself: 1.0.0 follows
    // 1.0.0-rc.1.
    if (left.prerelease === null && right.prerelease === null) return 0;
    if (left.prerelease === null) return 1;
    if (right.prerelease === null) return -1;

    // Both prereleases: identifier by identifier. Numeric identifiers compare
    // numerically and precede alphanumeric ones; running out of identifiers
    // first precedes, so 1.0.0-rc precedes 1.0.0-rc.1.
    const leftIds = left.prerelease.split('.');
    const rightIds = right.prerelease.split('.');

    for (let i = 0; i < Math.min(leftIds.length, rightIds.length); i++) {
        if (leftIds[i] === rightIds[i]) continue;

        const leftNumeric = /^\d+$/.test(leftIds[i]);
        const rightNumeric = /^\d+$/.test(rightIds[i]);

        if (leftNumeric && rightNumeric) return Number(leftIds[i]) - Number(rightIds[i]);
        if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
        return leftIds[i] < rightIds[i] ? -1 : 1;
    }

    return leftIds.length - rightIds.length;
}

/**
 * The decision itself, with the registry lookup already done so it can be
 * tested without one.
 *
 * @param version   the version about to be published.
 * @param latest    what the registry currently serves as `latest`, or null
 *                  when the package verifiably has no published version.
 * @param fallback  the tag to use when `latest` must not move.
 */
export function chooseDistTag({ version, latest, fallback }) {
    if (!parseVersion(version)) throw new Error(`Not a version: ${version}`);

    // Before the no-published-version branch, not after it. The other order
    // gave a prerelease `latest` whenever the lookup came back empty, which is
    // half of #81 — and a prerelease must never be `latest` whatever else is
    // true, because `npm install <pkg>` would then resolve to it.
    if (parseVersion(version).prerelease !== null) {
        return { tag: fallback, why: `${version} is a prerelease; it never becomes latest.` };
    }

    if (latest === null) {
        return { tag: 'latest', why: `nothing is published yet; ${version} becomes latest.` };
    }

    if (comparePrecedence(version, latest) > 0) {
        return { tag: 'latest', why: `${version} is newer than the published ${latest}; it becomes latest.` };
    }

    return {
        tag: fallback,
        why: `${version} is not newer than the published ${latest}; leaving latest alone.`,
    };
}

/**
 * Asks the registry what `latest` is.
 *
 * Three outcomes, kept apart. `npm view` exits 0 with the version on stdout
 * when the package is published, and non-zero with `E404` on stderr when it
 * verifiably is not; anything else is a lookup that did not answer the
 * question. Conflating the third with the second is what let a network blip
 * point `latest` at an older version (#81), so it throws rather than guesses.
 */
export function readPublishedLatest(name) {
    try {
        const stdout = execFileSync('npm', ['view', name, 'version'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return stdout.trim();
    } catch (error) {
        const stderr = String(error.stderr ?? '');
        if (stderr.includes('E404')) return null;
        throw new Error(
            `Could not read the current latest version of ${name}. The registry lookup failed ` +
            'for a reason other than the package being absent, so this cannot tell "nothing ' +
            'published yet" from "registry unreachable" — and getting that wrong points latest ' +
            `at an older version. npm view wrote:\n${stderr.trim()}`
        );
    }
}

// Only when run as a script, so the exports above stay importable by the tests.
// Compared as resolved file URLs rather than by matching path text: argv[1] may
// be relative, may differ in case or separator on Windows, and may be a symlink.
const isMain =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isMain) {
    const [version, ...rest] = process.argv.slice(2);
    const fallbackIndex = rest.indexOf('--fallback');
    const fallback = fallbackIndex === -1 ? 'recovered' : rest[fallbackIndex + 1];

    if (!version || !parseVersion(version)) {
        console.error('Usage: node scripts/dist-tag.mjs <version> [--fallback <tag>]');
        process.exit(1);
    }
    if (!fallback) {
        console.error('--fallback needs a tag name.');
        process.exit(1);
    }

    const name = JSON.parse(readFileSync('package.json', 'utf8')).name;

    let latest;
    try {
        latest = readPublishedLatest(name);
    } catch (error) {
        console.error(`::error::${error.message}`);
        process.exit(1);
    }

    const { tag, why } = chooseDistTag({ version, latest, fallback });
    console.error(why);
    console.log(tag);
}
