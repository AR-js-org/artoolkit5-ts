/*
 *  format-release-notes.mjs
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
 * Groups Conventional Commit subjects into release-note sections.
 *
 * Split from `release-notes.mjs`, which owns the git calls and the stdout, so
 * this half is a pure function of its input and can be tested without a
 * repository. It also has to be a separate file rather than an export from
 * that one: `release-notes.mjs` opens with a shebang, and while node strips
 * that, bundlers transforming an imported module do not — importing it fails
 * to parse at the `#`.
 */

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

/**
 * Renders the notes for a list of commit subjects, oldest first.
 *
 * @param {string[]} commits - Commit subject lines.
 * @returns {string} Markdown, with no trailing newline.
 */
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

    // Anything no section claimed. Two kinds end up here: a subject that is not
    // a Conventional Commit at all, and one that is but whose type is outside
    // SECTIONS — `style:`, say. The second kind used to vanish entirely, since
    // it matched no section and was not null either.
    //
    // Breaking changes are excluded because they were already rendered above,
    // whatever their type.
    const known = new Set(SECTIONS.map((s) => s.key));
    const leftover = parsed.filter(
        (c) => !c.parts?.breaking && (c.parts === null || !known.has(c.parts.type))
    );

    if (leftover.length > 0) {
        lines.push('### Other', '');
        for (const { subject, parts } of leftover) {
            // A parsed subject renders like any other entry; an unparseable one
            // has no description to use, so it goes in raw.
            lines.push(
                parts
                    ? `- ${parts.scope ? `**${parts.scope}:** ` : ''}${parts.description}`
                    : `- ${subject}`
            );
        }
        lines.push('');
    }

    return lines.join('\n').trim();
}

/**
 * The Conventional Commit types in `commits` that no section claims.
 *
 * Exported so the CLI can warn about them. A type reaching Other this way means
 * SECTIONS and the type list documented in AGENTS.md have drifted apart, and
 * without a warning that is only visible by noticing an entry under a heading
 * you did not expect — the same kind of silence this file's fallback exists to
 * prevent.
 *
 * Breaking changes are excluded: they render regardless of type, so an unlisted
 * breaking type is not a drift signal.
 *
 * @param {string[]} commits - Commit subject lines.
 * @returns {string[]} Unique unrecognised types, in the order first seen.
 */
function unrecognisedTypes(commits) {
    const known = new Set(SECTIONS.map((s) => s.key));
    const seen = [];

    for (const subject of commits) {
        const parts = parse(subject);
        if (!parts || parts.breaking || known.has(parts.type)) continue;
        if (!seen.includes(parts.type)) seen.push(parts.type);
    }

    return seen;
}

export { SECTIONS, parse, render, unrecognisedTypes };
