/*
 *  release-notes.test.js
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
 * JavaScript rather than TypeScript, unlike the rest of `test/`, because the
 * subject is a plain `.mjs` script with no type declarations. A `.ts` test
 * importing it would need `allowJs` or a hand-written `.d.mts`, and would break
 * the moment `test/` is added to the typecheck (see #44).
 */

import { describe, it, expect } from 'vitest';

import { render, unrecognisedTypes } from '../scripts/format-release-notes.mjs';

describe('release notes', () => {
    it('keeps a commit whose type parses but is not one of the known sections', () => {
        // `style` is a real Conventional Commit type, just not one of the nine
        // this script groups by. It must still reach the notes.
        const notes = render(['style: reformat the detector tables']);

        expect(notes).toContain('reformat the detector tables');
    });

    it('renders an unlisted type with its description, not its raw subject', () => {
        const notes = render(['style(detector): align the tables']);

        expect(notes).toContain('**detector:** align the tables');
        expect(notes).not.toContain('style(detector):');
    });

    it('still keeps a subject that is not a Conventional Commit at all', () => {
        // Existing behaviour, kept as a guard: widening the fallback to catch
        // unrecognised types must not stop it catching unparseable subjects.
        const notes = render(['Merge branch tidy-up into dev']);

        expect(notes).toContain('Merge branch tidy-up into dev');
    });

    it('does not list a breaking change twice when its type is unlisted', () => {
        // `!` renders in the breaking section regardless of type, so an unlisted
        // breaking type must not also fall through to Other.
        const notes = render(['style!: drop the legacy table layout']);

        const occurrences = notes.split('drop the legacy table layout').length - 1;
        expect(occurrences).toBe(1);
        expect(notes).toContain('Breaking changes');
        expect(notes).not.toContain('### Other');
    });

    it('groups a known type into its own section rather than Other', () => {
        const notes = render(['feat: add a thing', 'style: tidy a thing']);

        expect(notes).toContain('### Features');
        expect(notes).toContain('### Other');
        // The known one must not leak into the fallback.
        expect(notes.split('### Other')[1]).not.toContain('add a thing');
    });
});

describe('unrecognised types', () => {
    it('names each unlisted type once, in the order first seen', () => {
        const types = unrecognisedTypes([
            'style: tidy',
            'feat: a feature',
            'wip: something',
            'style: tidy again',
        ]);

        expect(types).toEqual(['style', 'wip']);
    });

    it('reports nothing when every type has a section', () => {
        expect(unrecognisedTypes(['feat: a', 'fix: b', 'chore(deps): c'])).toEqual([]);
    });

    it('ignores subjects that are not Conventional Commits', () => {
        // Those are already surfaced under Other on their own merit; they say
        // nothing about SECTIONS being out of date.
        expect(unrecognisedTypes(['Merge branch x into dev'])).toEqual([]);
    });

    it('ignores a breaking change, which renders whatever its type', () => {
        expect(unrecognisedTypes(['style!: drop the old layout'])).toEqual([]);
    });
});
