/*
 *  mock-core.ts
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

import { ARToolKitState } from '../src/domain';

/** Elements in ARToolKit's 3x4 pose matrix. */
const POSE_ELEMENT_COUNT = 12;

/** Records of what the library asked the C++ core to do. */
export interface CoreCalls {
    teardown: number;
    delete: number;
    /** Candidate indices passed to the continuous-tracking variant. */
    transMatCont: number[];
    /** Candidate indices passed to the from-scratch variant. */
    transMat: number[];
}

export interface MockCoreOptions {
    /**
     * Marker IDs the detector reports, per frame. `visibleIds[0]` is used on the
     * first `processFrame` call, `[1]` on the second, and so on. Once exhausted,
     * the last entry repeats.
     */
    visibleIds?: number[][];
    /** Pose values the heap yields, so tests can assert what was copied out. */
    pose?: number[];
}

/**
 * A stand-in for the Emscripten module and bound C++ instance.
 *
 * The real core needs a browser and a compiled WASM binary, neither of which
 * belongs in a unit test. This fake reproduces only the contract the library
 * depends on: a heap to read poses from, a per-frame list of detected marker
 * IDs, and a record of which calls were made.
 */
export function createMockState(options: MockCoreOptions = {}): {
    state: ARToolKitState;
    calls: CoreCalls;
    /** Advances which entry of `visibleIds` the next frame will report. */
    frameIndex: () => number;
} {
    const visibleIds = options.visibleIds ?? [[]];
    const pose = options.pose ?? Array.from({ length: POSE_ELEMENT_COUNT }, (_, i) => i + 1);

    const calls: CoreCalls = { teardown: 0, delete: 0, transMatCont: [], transMat: [] };

    // The library reads poses at `getTransform() >> 3`, so the pose is placed at
    // a known offset and that offset is returned as a byte address.
    const POSE_HEAP_INDEX = 8;
    const heap = new Float64Array(64);
    heap.set(pose, POSE_HEAP_INDEX);

    let frame = -1;
    const currentIds = (): number[] => {
        const index = Math.min(frame, visibleIds.length - 1);
        return visibleIds[Math.max(index, 0)] ?? [];
    };

    const state: ARToolKitState = {
        mod: {
            HEAPF64: heap,
            FS: {},
            loadCameraFromPath: () => 0,
            addMarker: () => 0,
        },
        core: {
            setup: async () => undefined,
            passVideoData: () => {
                // One frame advance per processFrame call; this is the first
                // core call the library makes, so it is the natural hook.
                frame += 1;
            },
            detectMarker: () => undefined,
            getMarkerNum: () => currentIds().length,
            getMarkerInfo: (index: number) => ({ id: currentIds()[index] }),
            getTransMatSquare: (index: number) => {
                calls.transMat.push(index);
            },
            getTransMatSquareCont: (index: number) => {
                calls.transMatCont.push(index);
            },
            getTransform: () => POSE_HEAP_INDEX * Float64Array.BYTES_PER_ELEMENT,
            getCameraLens: () => new Float64Array(16).fill(0.5),
            teardown: () => {
                calls.teardown += 1;
                return 0;
            },
            delete: () => {
                calls.delete += 1;
            },
        },
        width: 640,
        height: 480,
        markers: {},
        disposed: false,
    };

    return { state, calls, frameIndex: () => frame };
}
