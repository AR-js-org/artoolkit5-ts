// src/markers.ts
import { ARToolKitState } from './domain';
import { addMarkerFromUrl } from '@ar-js-org/artoolkit5-wasm';

/**
 * Downloads a pattern file (.patt), writes it to the WASM virtual file system
 * and registers it in the ARToolKit core.
 * Returns the internal ID assigned by the C++ engine.
 */
export async function loadPatternMarker(state: ARToolKitState, markerUrl: string): Promise<number> {
    // addMarkerFromUrl automatically handles fetch and mod.FS
    console.log(state)
    return await addMarkerFromUrl(state.mod, state.core, markerUrl);
}