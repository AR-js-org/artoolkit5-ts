/*
 *  errors.ts
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

import { ARToolKitState } from './domain';

/**
 * Error thrown by this library.
 *
 * Distinct from a plain `Error` so callers can tell a misuse of this API apart
 * from a failure inside the WASM module or the host application.
 */
export class ARToolKitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ARToolKitError';

        // Restores the prototype chain, which is lost when subclassing built-ins
        // compiled to ES5 targets. Without it `instanceof ARToolKitError` fails.
        Object.setPrototypeOf(this, ARToolKitError.prototype);
    }
}

/**
 * Throws if the state has been disposed.
 *
 * Every public operation calls this first. Without it, using a disposed state
 * reaches freed WASM memory and fails somewhere inside the module, where the
 * error says nothing about the actual mistake.
 *
 * @param operation Name of the calling function, used in the message.
 */
export function assertNotDisposed(state: ARToolKitState, operation: string): void {
    if (state.disposed) {
        throw new ARToolKitError(
            `${operation} was called on a disposed ARToolKitState. ` +
            'Create a new one with createARToolKitState().'
        );
    }
}
