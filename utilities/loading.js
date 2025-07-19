/**
 * ------------------------------------------------------------------
 * Helper function used to load a text-based file from the server
 */
async function loadFileFromServer(filename) {
    let result = await fetch(filename);
    return result.text();
}

/**
 * ------------------------------------------------------------------
 * Helper function used to load a image-based file from the server
 */
async function loadTextureFromServer(filename) {
    try {
        let asset = new Image();
        asset.crossOrigin = "anonymous";
        asset.src = filename;
        await asset.decode();

        return asset;
    } catch (err) {
        throw err;
    }
}
