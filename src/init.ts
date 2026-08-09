/*
 *  init.ts
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

import { createARToolKit, loadCameraFromUrl } from '@ar-js-org/artoolkit5-wasm';
import { ARToolKitCore, ARToolKitModule, ARToolKitState } from './domain';

/** Emscripten module extended with the bound C++ class constructor. */
interface ARToolKitModuleWithCore extends ARToolKitModule {
    ARToolKitCore: new () => ARToolKitCore;
}

/**
 * Initialises the WASM module, loads camera parameters and returns the state
 * object that every other operation in this library operates on.
 *
 * @param width  Frame width in pixels; must match the frames passed to `processFrame`.
 * @param height Frame height in pixels; must match the frames passed to `processFrame`.
 * @param cameraUrl URL of an ARToolKit `camera_para.dat` calibration file.
 * @param wasmUrl Optional explicit URL for `artoolkit5.wasm`. Required when the
 *   bundler rewrites asset paths, as Vite does.
 */
export async function createARToolKitState(
    width: number,
    height: number,
    cameraUrl: string,
    wasmUrl?: string
): Promise<ARToolKitState> {
    const artk = await createARToolKit({
        locateFile: (path: string) =>
            wasmUrl && path.endsWith('.wasm') ? wasmUrl : path,
    });

    // The loader types `mod` as `any`; narrow it once here so the rest of the
    // library is fully typed.
    const mod = artk.mod as ARToolKitModuleWithCore;
    const core = new mod.ARToolKitCore();

    const cameraId = await loadCameraFromUrl(mod, core, cameraUrl);
    await core.setup(width, height, cameraId);

    return { mod, core, width, height, markers: {} };
}
