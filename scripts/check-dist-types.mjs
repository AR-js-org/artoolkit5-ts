/*
 *  check-dist-types.mjs
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
 * Compiles a throwaway consumer against the packed tarball, under the strictest
 * resolution mode, to check that the declarations this package ships are usable.
 *
 * The gap this closes is specific. `tsconfig.json` here sets
 * `moduleResolution: "Bundler"`, which permits extensionless relative imports,
 * and `skipLibCheck: true`, which stops us compiling our own declarations — so
 * for four releases `dist/*.d.ts` shipped imports that are invalid under
 * `node16`/`nodenext`, and nothing here could see it. It surfaced only
 * downstream, in a repository whose own type build had been failing silently
 * (#85).
 *
 * Checking the working tree would not have caught it either. What a consumer
 * receives is the tarball, filtered by `files` and entered through `exports`,
 * so that is what this unpacks and compiles against.
 *
 *   npm run check:dist-types       # after npm run build
 *
 * No network and no installed dependencies: the shipped declarations import
 * nothing outside themselves, which the script asserts rather than assumes, so
 * a bare extraction is a faithful consumer.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PACKAGE_NAME = JSON.parse(readFileSync('package.json', 'utf8')).name;
const TSC = resolve('node_modules', 'typescript', 'bin', 'tsc');

const run = (file, args, cwd) =>
    execFileSync(file, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const fail = (message) => {
    console.error(`::error::${message}`);
    process.exitCode = 1;
};

const work = mkdtempSync(join(tmpdir(), 'artk5-dist-types-'));

try {
    // --- pack ------------------------------------------------------------

    // `--json` rather than parsing the human output, which npm has changed
    // between majors and which also carries the file listing.
    const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work]));
    console.log(`packed ${packed[0].filename} (${packed[0].entryCount} entries)`);

    // Relative name with the working directory set, rather than an absolute
    // path or `-C`. GNU tar reads a leading `C:\` as a remote host and fails
    // with "Cannot connect to C: resolve failed", which is what it does on the
    // tar that ships with Git for Windows. Nothing here sees a drive letter, so
    // this works on both that and the bsdtar on Windows and macOS.
    run('tar', ['-xzf', packed[0].filename], work);

    // npm tarballs always root at `package/`. Moved into a node_modules layout
    // so the fixture resolves the package by name, through `exports`, the way a
    // consumer does — rather than by a relative path, which bypasses it.
    const installed = join(work, 'consumer', 'node_modules', ...PACKAGE_NAME.split('/'));
    mkdirSync(join(installed, '..'), { recursive: true });
    renameSync(join(work, 'package'), installed);

    // --- the cheap check, for a precise message --------------------------

    const declarations = readdirSync(join(installed, 'dist')).filter((f) => f.endsWith('.d.ts'));
    if (declarations.length === 0) fail('The tarball ships no .d.ts files at all.');

    for (const file of declarations) {
        const text = readFileSync(join(installed, 'dist', file), 'utf8');

        for (const [, specifier] of text.matchAll(/from '(\.[^']*)'/g)) {
            if (!/\.(js|mjs|cjs|json)$/.test(specifier)) {
                fail(
                    `dist/${file} imports '${specifier}' without a file extension. Relative ` +
                    "specifiers in shipped declarations need one, or a consumer using " +
                    "moduleResolution node16/nodenext cannot compile them (TS2834). Write the " +
                    "extension in src/ — './x.js' resolves to x.ts for us and is what TypeScript " +
                    'recommends.'
                );
            }
        }

        // The fixture below installs nothing, so an external import would make
        // it fail for a reason that is not the one being tested. Asserted so
        // that stops being a silent assumption the day a declaration grows one.
        for (const [, specifier] of text.matchAll(/from '([^.][^']*)'/g)) {
            fail(
                `dist/${file} imports '${specifier}', which is outside the package. This check ` +
                'compiles the tarball with nothing installed, so it needs extending to install ' +
                "that dependency before it can judge the declarations."
            );
        }
    }

    // --- the authoritative check: be the consumer ------------------------

    const consumer = join(work, 'consumer');
    writeFileSync(
        join(consumer, 'package.json'),
        JSON.stringify({ name: 'consumer', private: true, type: 'module' }, null, 2)
    );
    writeFileSync(
        join(consumer, 'tsconfig.json'),
        JSON.stringify(
            {
                compilerOptions: {
                    // The whole point: the mode that rejects extensionless
                    // relative imports, which `Bundler` accepts.
                    module: 'nodenext',
                    moduleResolution: 'nodenext',
                    // Off, deliberately. The downstream workaround for #85 was
                    // to turn this *on*; with it on this check proves nothing,
                    // and a consumer who does not set it has no workaround
                    // short of patching node_modules.
                    skipLibCheck: false,
                    strict: true,
                    noEmit: true,
                    types: [],
                },
                files: ['index.ts'],
            },
            null,
            2
        )
    );
    writeFileSync(
        join(consumer, 'index.ts'),
        `// Imported by name so resolution goes through the package's "exports".\n` +
        `import {\n` +
        `    ARToolKitError,\n` +
        `    VERSION,\n` +
        `    configureDetector,\n` +
        `    createARToolKitState,\n` +
        `    disposeARToolKitState,\n` +
        `    getCameraProjectionMatrix,\n` +
        `    loadPatternMarker,\n` +
        `    processFrame,\n` +
        `    trackBarcodeMarker,\n` +
        `    trackMarker,\n` +
        `    transMatToGLMat,\n` +
        `} from '${PACKAGE_NAME}';\n` +
        `import type { ARToolKitState, FrameResult, MarkerPose } from '${PACKAGE_NAME}';\n` +
        `\n` +
        `// Referenced so nothing is elided before it has been resolved.\n` +
        `export const used = [\n` +
        `    ARToolKitError, VERSION, configureDetector, createARToolKitState,\n` +
        `    disposeARToolKitState, getCameraProjectionMatrix, loadPatternMarker,\n` +
        `    processFrame, trackBarcodeMarker, trackMarker, transMatToGLMat,\n` +
        `] as const;\n` +
        `export type Used = [ARToolKitState, FrameResult, MarkerPose];\n`
    );

    try {
        run(process.execPath, [TSC, '--project', 'tsconfig.json'], consumer);
        console.log(`${PACKAGE_NAME} compiles under moduleResolution nodenext with skipLibCheck off.`);
    } catch (error) {
        fail(
            'A consumer using moduleResolution nodenext cannot compile the shipped ' +
            'declarations. tsc reported:'
        );
        console.error(String(error.stdout ?? '').trim() || String(error.stderr ?? '').trim());
    }
} finally {
    rmSync(work, { recursive: true, force: true });
}
