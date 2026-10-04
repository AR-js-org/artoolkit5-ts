#!/usr/bin/env node
/*
 *  release-notes.mjs
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
 * Prints release notes derived from git history.
 *
 * Groups Conventional Commits since the previous tag by type, so the notes
 * reflect what actually landed rather than what someone remembered to write
 * down. Intended both for drafting a CHANGELOG entry and for pasting into a
 * GitHub Release.
 *
 *   node scripts/release-notes.mjs            # since the most recent tag
 *   node scripts/release-notes.mjs v0.1.0     # since a specific tag
 *
 * The grouping lives in `format-release-notes.mjs`. This file owns the git
 * calls and the output; that one is a pure function and is where the tests
 * point.
 */

import { execFileSync } from 'node:child_process';

import { render, unrecognisedTypes } from './format-release-notes.mjs';

// stderr is piped rather than inherited so a probing call that is expected to
// fail — `describe` before the first tag exists — stays silent.
const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** The tag to compare against, or null when this is the first release. */
function previousTag(explicit) {
    if (explicit) return explicit;
    try {
        return git('describe', '--tags', '--abbrev=0');
    } catch {
        return null; // No tags yet.
    }
}

/** Subject lines of the commits being released, oldest first. */
function commitsSince(tag) {
    const range = tag ? `${tag}..HEAD` : 'HEAD';
    const log = git('log', range, '--no-merges', '--reverse', '--pretty=format:%s');
    return log ? log.split('\n') : [];
}

const tag = previousTag(process.argv[2]);
const commits = commitsSince(tag);

if (commits.length === 0) {
    console.error(tag ? `No commits since ${tag}.` : 'No commits found.');
    process.exit(1);
}

console.error(
    tag
        ? `${commits.length} commits since ${tag}`
        : `${commits.length} commits (no previous tag — first release)`
);

// Warned about rather than left to be noticed: these still appear in the notes,
// under Other, but the reason they are there is that SECTIONS does not list
// them. On stderr, so it does not reach a file this is redirected into.
const unrecognised = unrecognisedTypes(commits);
if (unrecognised.length > 0) {
    console.error(
        `Warning: no section claims ${unrecognised.join(', ')}, so those commits are grouped ` +
            'under "Other". Add the type to SECTIONS in format-release-notes.mjs, or keep the ' +
            "list in AGENTS.md in step with it."
    );
}

console.log(render(commits));
