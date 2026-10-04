/*
 *  version.ts
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
 * This package's version, so a bundled copy can be identified at runtime.
 *
 * Replaced at build time by Vite's `define`, which reads `package.json`
 * directly — see `vite.config.ts`. Nothing imports `package.json` from here on
 * purpose: doing so would inline the whole manifest, dependency list and all,
 * into every bundle.
 *
 * Deliberately not logged on import. A library that prints to the console
 * merely because it was loaded is noise for consumers who did not ask for it;
 * anything that wants the version in its startup banner can read these and log
 * it itself.
 */

// Supplied by `define`. Typed as possibly undefined because a consumer building
// from `src/` with another toolchain gets no substitution, and reading an
// undeclared identifier bare would throw a ReferenceError rather than yield
// undefined.
declare const __ARTOOLKIT5_TS_VERSION__: string | undefined;

const injected =
    typeof __ARTOOLKIT5_TS_VERSION__ === 'string' ? __ARTOOLKIT5_TS_VERSION__ : undefined;

/**
 * This package's version, e.g. `'0.2.2'`.
 *
 * `'0.0.0-unbuilt'` when the build-time substitution did not happen, which says
 * plainly that the copy was not produced by this package's build rather than
 * reporting a version it cannot vouch for.
 */
export const VERSION: string = injected ?? '0.0.0-unbuilt';

/**
 * The same value under an unambiguous name, for code importing several packages
 * in this family at once — `artoolkit5-wasm` and `artoolkit5-constants` both
 * export a bare `VERSION` too, and a wildcard re-export makes the bare name a
 * coin toss.
 */
export const ARTOOLKIT5_TS_VERSION: string = VERSION;
