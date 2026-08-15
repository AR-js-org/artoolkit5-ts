#!/usr/bin/env node
/*
 *  promote-changelog.mjs
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
 * Promotes the changelog's Unreleased section to a released version.
 *
 * Renames `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, opens a fresh empty
 * Unreleased section above it, and rewrites the link definitions at the bottom.
 *
 *   node scripts/promote-changelog.mjs 0.1.0
 */

import { readFileSync, writeFileSync } from 'node:fs';

const REPO = 'https://github.com/AR-js-org/artoolkit5-ts';
const CHANGELOG = 'CHANGELOG.md';

const version = process.argv[2];
if (!version) {
    console.error('Usage: node scripts/promote-changelog.mjs <version>');
    process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
let text = readFileSync(CHANGELOG, 'utf8');

const unreleasedHeading = /^## \[Unreleased\].*$/m;
if (!unreleasedHeading.test(text)) {
    console.error(`No "## [Unreleased]" section found in ${CHANGELOG}. Nothing to promote.`);
    process.exit(1);
}

// Content between promote:strip markers is guidance for whoever is editing the
// Unreleased section, not part of the release record. Matching explicit markers
// rather than the prose itself means rewording the note cannot break this.
text = text.replace(
    /[ \t]*<!--\s*promote:strip\s*-->[\s\S]*?<!--\s*\/promote:strip\s*-->\r?\n?/g,
    ''
);

text = text.replace(
    unreleasedHeading,
    `## [Unreleased]\n\n## [${version}] - ${today}`
);

// The link block is rebuilt from the version headings rather than edited in
// place, so it stays ordered — Unreleased first, then versions newest to
// oldest — however many releases accumulate.
const versions = [...text.matchAll(/^## \[(\d+\.\d+\.\d+[^\]]*)\]/gm)].map((m) => m[1]);

const links = [`[Unreleased]: ${REPO}/compare/v${version}...HEAD`];
versions.forEach((current, index) => {
    const older = versions[index + 1];
    links.push(
        older
            ? `[${current}]: ${REPO}/compare/v${older}...v${current}`
            : `[${current}]: ${REPO}/releases/tag/v${current}`
    );
});

// Drop every existing definition; the block above replaces them wholesale.
text = text.replace(/^\[[^\]]+\]:.*(\r?\n)?/gm, '');

// Stripping blocks can leave runs of blank lines behind.
text = text.replace(/(\r?\n){3,}/g, '$1$1');

text = `${text.trimEnd()}\n\n${links.join('\n')}\n`;

writeFileSync(CHANGELOG, text, 'utf8');
console.log(`Promoted Unreleased to ${version} (${today}).`);

