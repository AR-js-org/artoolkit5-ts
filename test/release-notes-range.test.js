/*
 *  release-notes-range.test.js
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
 * Which commit range `release-notes.mjs` picks, which is not something the
 * formatter tests can see: they call `render` directly, and this is decided
 * before `render` is reached, by asking git.
 *
 * Worth its own file because the answer changed with the release trigger. While
 * releases were dispatched against an untagged `main`, the nearest tag was the
 * previous release and `<tag>..HEAD` was right. Now that the workflow runs on
 * the tag push, HEAD *is* the tag, the nearest tag is itself, and the range is
 * empty — `release-notes.mjs` exits 1 on an empty range, so the release stops
 * at the notes step with nothing published (#22).
 *
 * The script is driven as a subprocess rather than imported, for the reason the
 * sibling test file records: it is plain JavaScript, and importing it would
 * need `allowJs`.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = resolve(import.meta.dirname, '../scripts/release-notes.mjs');

/**
 * A repository with its own identity and signing switched off, so the test does
 * not depend on — or consult — whatever the machine running it has configured.
 */
function makeRepo() {
    const dir = mkdtempSync(join(tmpdir(), 'artk5-notes-'));
    const git = (...args) =>
        execFileSync('git', ['-C', dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
            '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    execFileSync('git', ['init', '-q', '-b', 'main', dir], { stdio: ['ignore', 'pipe', 'pipe'] });

    let n = 0;
    return {
        dir,
        git,
        commit(subject) {
            writeFileSync(join(dir, 'file.txt'), String(++n));
            git('add', '-A');
            git('commit', '-q', '-m', subject);
        },
        tag(name) {
            git('tag', '-a', name, '-m', `Release ${name}`);
        },
        /** stdout is the notes; the commit count the script reports is on stderr. */
        notes() {
            const stdout = execFileSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'] });
            return stdout;
        },
    };
}

describe('the commit range the notes cover', () => {
    /** @type {ReturnType<typeof makeRepo>[]} */
    const repos = [];
    const repo = () => {
        const r = makeRepo();
        repos.push(r);
        return r;
    };

    afterAll(() => {
        for (const r of repos) rmSync(r.dir, { recursive: true, force: true });
    });

    // The case the tag-triggered release depends on. Before the fix this exited
    // 1 with "No commits since v0.2.0" and took the release down with it.
    it('spans the previous tag to this one when HEAD is a tag', () => {
        const r = repo();
        r.commit('feat: the first thing');
        r.tag('v0.1.0');
        r.commit('fix: the second thing');
        r.commit('feat: the third thing');
        r.tag('v0.2.0');

        const notes = r.notes();
        expect(notes).toContain('the second thing');
        expect(notes).toContain('the third thing');
        // Released under v0.1.0, so it belongs to the previous notes, not these.
        expect(notes).not.toContain('the first thing');
    });

    it('spans the nearest tag to HEAD when HEAD is not a tag', () => {
        const r = repo();
        r.commit('feat: the first thing');
        r.tag('v0.1.0');
        r.commit('fix: the second thing');

        const notes = r.notes();
        expect(notes).toContain('the second thing');
        expect(notes).not.toContain('the first thing');
    });

    it('covers every commit when HEAD is the first release tag', () => {
        const r = repo();
        r.commit('feat: the only thing');
        r.tag('v0.1.0');

        expect(r.notes()).toContain('the only thing');
    });

    // Two tags on one commit is why the current tag is found by comparing
    // commits rather than excluded by name: excluding `v0.2.0` would select
    // `v0.2.0-rc.1`, which is the same commit, and the range would be empty
    // again.
    it('looks past every tag on HEAD, not just the one being released', () => {
        const r = repo();
        r.commit('feat: the first thing');
        r.tag('v0.1.0');
        r.commit('fix: the second thing');
        r.tag('v0.2.0-rc.1');
        r.tag('v0.2.0');

        const notes = r.notes();
        expect(notes).toContain('the second thing');
        expect(notes).not.toContain('the first thing');
    });

    // Documents a consequence rather than a requirement. Stepping back one
    // commit means a second tag on an already-tagged commit regenerates the
    // earlier range instead of reporting an empty one, so the old loud failure
    // ("No commits since vX") is no longer reachable that way. Acceptable
    // because the realistic form of the mistake is caught earlier and harder:
    // the workflow refuses a tag that disagrees with `package.json`, and
    // reaching v0.2.1 requires a commit that sets the version to 0.2.1.
    it('regenerates the earlier range rather than failing on a re-tagged commit', () => {
        const r = repo();
        r.commit('feat: the first thing');
        r.tag('v0.1.0');
        r.commit('fix: the second thing');
        r.tag('v0.2.0');
        r.tag('v0.2.1');

        expect(r.notes()).toContain('the second thing');
    });
});
