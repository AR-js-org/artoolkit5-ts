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
 */

import { execFileSync } from 'node:child_process';

/** Conventional Commit types, in the order they should appear. */
const SECTIONS = [
    { key: 'feat', heading: 'Features' },
    { key: 'fix', heading: 'Fixes' },
    { key: 'perf', heading: 'Performance' },
    { key: 'refactor', heading: 'Refactoring' },
    { key: 'docs', heading: 'Documentation' },
    { key: 'test', heading: 'Tests' },
    { key: 'ci', heading: 'CI' },
    { key: 'build', heading: 'Build' },
    { key: 'chore', heading: 'Chores' },
];

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

/**
 * Splits a Conventional Commit subject into its parts.
 *
 * Returns null for subjects that do not follow the convention, so they can be
 * surfaced rather than silently dropped.
 */
function parse(subject) {
    const match = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
    if (!match) return null;

    const [, type, scope, breaking, description] = match;
    return { type, scope, breaking: Boolean(breaking), description };
}

function render(commits) {
    const parsed = commits.map((subject) => ({ subject, parts: parse(subject) }));

    const lines = [];

    // Breaking changes lead, regardless of type: they are what a reader most
    // needs to see before upgrading.
    const breaking = parsed.filter((c) => c.parts?.breaking);
    if (breaking.length > 0) {
        lines.push('### ⚠️ Breaking changes', '');
        for (const { parts } of breaking) {
            lines.push(`- ${parts.scope ? `**${parts.scope}:** ` : ''}${parts.description}`);
        }
        lines.push('');
    }

    for (const { key, heading } of SECTIONS) {
        const matching = parsed.filter((c) => c.parts?.type === key && !c.parts.breaking);
        if (matching.length === 0) continue;

        lines.push(`### ${heading}`, '');
        for (const { parts } of matching) {
            lines.push(`- ${parts.scope ? `**${parts.scope}:** ` : ''}${parts.description}`);
        }
        lines.push('');
    }

    const unconventional = parsed.filter((c) => c.parts === null);
    if (unconventional.length > 0) {
        lines.push('### Other', '');
        for (const { subject } of unconventional) {
            lines.push(`- ${subject}`);
        }
        lines.push('');
    }

    return lines.join('\n').trim();
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
console.log(render(commits));
