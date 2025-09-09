import ResourceCollector from "../utilities/containers/collector.js";
import Color from "../utilities/containers/color.js";
import Graphics3D from "../rendering/renderer.js";

export default class TextureManager {
    static #gl;

    /**
     * Initialize the texture manager for use.
     */
    static init() {
        if (TextureManager.#gl === null)  {
            TextureManager.#gl = Graphics3D.getGLContext()
        }
    }

    /**
     * load an image from the server and create a webgl texture from it
     * @param {string} texturePath the path to the texture
     * @param {object} options options for texture creation (wrapS, wrapT, etc...);
     * @returns {Promise<object>} a Promise that resolves with an object containing the path (under name), image width and height, and the glTexture handle.
     */
    static async load(texturePath, options={}) {
        if (ResourceCollector.contains(texturePath)) {
            const textureInfo = await ResourceCollector.getWhenLoaded(
                texturePath, { pollInterval: 0.2, pollTimeout: 3 }
            );
            return textureInfo;
        }

        const textureInfo = await ResourceCollector.load(
            texturePath, TextureManager.#loadTexture,
            { 
                maxRetries: 3,
                disposalCallback: TextureManager.#deleteTexture,
                disposalDelay: 0.5,
                category: 'texture',
                loadData: options 
            }
        )
        return textureInfo;
    }

    /**
     * Get the texture info associated with the given path
     * @param {string} texturePath the path to the texture
     * @returns {object | null} an object containing the texture info
     */
    static get(texturePath) {
        if (ResourceCollector.isLoaded(texturePath)) {
            return ResourceCollector.get(texturePath);
        }
        return null;
    }

    /**
     * check if the given texture has loaded/ is loading
     * @param {string} texturePath the path to the texture
     * @returns {boolean} true if the texture has already started loading/isloaded, false otherwise
     */
    static contains(texturePath) {
        return ResourceCollector.contains(texturePath);
    }

    /**
     * Acquire the given texture for use
     * @param {string} texturePath the path to the texture
     */
    static acquire(texturePath) {
        ResourceCollector.acquire(texturePath);
    }

    /**
     * Release the given texture from use.
     * @param {string} texturePath the path to the texture
     */
    static release(texturePath) {
        ResourceCollector.release(texturePath);
    }

    /**
     * Check if the given texture has finished loading
     * @param {string} texturePath the path to the texture
     * @returns {boolean} true if the texture has finished loading, false otherwise
     */
    static isLoaded(texturePath) {
        return ResourceCollector.isLoaded(texturePath);
    }

    /**
     * create a default texture with the given color in a checkerboard pattern
     * @param {Color} color the color of the texture.
     * @returns {object} an object that contains the hexcode (under name), image width and height, and glTexture.
     */
    static createDefault(color) {
        const colorHex = color.hexCode();
        if (ResourceCollector.contains(colorHex)) {
            return ResourceCollector.get(colorHex);
        }
        return TextureManager.#createDefault(color);
    }

    /** Load a texture using the resource collector */
    static async #loadTexture(texturePath, options) {
        try {
            const imageData = await ResourceCollector.fetchImageFile(texturePath, options);
            return {
                glTexture: TextureManager.#defineTexture(imageData, options.loadData),
                name: texturePath,
                width: imageData.width,
                height: imageData.height,
            }
        } catch (error) {
            console.error(`[TextureManager] An error occurred attempting to load texture ${texturePath}: ${error}`);
            throw error;
        }
    }

    /** create a new default color and store it in the resource collector */
    static #createDefault(color) {
        const width = 64;
        const height = 64;
        const imageData = new Uint8Array(width * height * 4)

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                
                const topLeft = x < width / 2 && y < height / 2;
                const bottomRight = x > width / 2 - 1 && y > height / 2 - 1;
                let r, g, b;
                if (topLeft || bottomRight) {
                    r = color.r, g = 0, b = color.b;
                } else {
                    r = 0, g = 0, b = 0;
                }

                imageData[index] = r;
                imageData[index + 1] = g;
                imageData[index + 2] = b;
                imageData[index + 3] = 255;
            }
        }

        const gl = TextureManager.#gl;
        const imageOptions = { 
            wrapT: gl.CLAMP_TO_EDGE, 
            wrapS: gl.CLAMP_TO_EDGE,
            magFilter: gl.NEAREST,
            minFilter: gl.NEAREST,
            generateMipmaps: true,
            width: width,
            height: height
        }
        const textureInfo = {
            glTexture: TextureManager.#defineTexture(imageData, imageOptions),
            name: color.hexCode(),
            width: imageData.width,
            height: imageData.height,
        }
        ResourceCollector.store(color.hexCode(), textureInfo);
        return textureInfo;
    }

    /** define a new webgl texture */
    static #defineTexture(image, options) {
        const gl = TextureManager.#gl;
        let glTexture = null;
        try {
            glTexture = gl.createTexture();
            if (!glTexture) throw new Error(`[Texture @${path}] Creation of new WebGL texture failed.`)

            gl.bindTexture(gl.TEXTURE_2D, glTexture);

            if (image instanceof ImageBitmap) {
                // this is for server loaded images 
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
            } else {
                // this is for the default image, it's represented as a Uint8Array
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, options.width, options.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image)
            }
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

            // Apply texture parameters - if the options object doesn't have it, apply a default.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, options.wrapS || gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, options.wrapT || gl.REPEAT);
            // generate mipmap if requested
            if (options.generateMipmaps) {
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.minFilter || gl.LINEAR_MIPMAP_LINEAR);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.minFilter || gl.LINEAR);
            }
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, options.magFilter || gl.LINEAR);

            gl.bindTexture(gl.TEXTURE_2D, null);
            
            console.log(`[Texture @${path}] Successfully created WebGL texture for image '${path}'.`);
            return glTexture;
        } catch (error) {
            console.error(`[Texture @${path}] An error occurred when attempting to create WebGL texture from image '${path}': ${error}`);

            if (gl.isTexture(glTexture)) {
                gl.deleteTexture(glTexture);
            }

            throw error;
        }
    }

    /** delete a webgl texture */
    static #deleteTexture(textureInfo) {
        TextureManager.#gl.deleteTexture(textureInfo.glTexture);
    }
}