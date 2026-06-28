// init.ts
import { createARToolKit, loadCameraFromUrl } from "@ar-js-org/artoolkit5-wasm";
import { ARToolKitState } from "./domain";

export async function createARToolKitState(
    width: number,
    height: number,
    cameraUrl: string,
    wasmUrl?: string
): Promise<ARToolKitState> {

    const artk = await createARToolKit({
        locateFile: (path) => {
            // If Emscripten looks for the .wasm and we have a specific URL, use that
            if (path.endsWith('.wasm') && wasmUrl) {
                return wasmUrl;
            }
            // Otherwise return the default path
            return path;
        }
    });

    //@ts-ignore
    const core = new artk.mod.ARToolKitCore();


    const cameraId = await loadCameraFromUrl(artk.mod as any, core, cameraUrl);
    await core.setup(width, height, cameraId);

    const mod = artk.mod as any;

    const markers = {};

    // @ts-ignore
    return { mod, core, width, height, markers };
}