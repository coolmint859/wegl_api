import { ResourceCollector, Color } from "../../utilities/index.js";

/**
 * Handles creating texture buffers used by texture components
 */
export default class TextureHandler {
    static #gl;

    /**
     * Initialize the texture handler
     * @param {WebGL2RenderingContext} gl the currently active rendering context
     */
    static init(gl) {
        if (!gl instanceof WebGL2RenderingContext) {
            console.error(`[TextureHandler] Cannot initialize handler as 'gl' is not a valid rendering context.`);
            return;
        }
        TextureHandler.#gl = gl;
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
            texturePath, TextureHandler.#loadTexture,
            { 
                maxRetries: options.maxRetries ?? 3,
                disposalCallback: TextureHandler.#deleteTexture,
                disposalDelay: options.disposalDelay ?? 0.5,
                category: 'texture',
                loadData: options
            }
        )
        return textureInfo;
    }

    /**
     * Get the texture info associated with the given path
     * @param {string} texturePath the path to the texture
     * @returns {object | null} an object containing the texture info, if it loaded successfully. null is returned otherwise
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
    static getDefault(color) {
        const colorHex = color.hexCode();
        if (ResourceCollector.contains(colorHex)) {
            return ResourceCollector.get(colorHex);
        }
        return TextureHandler.#createDefault(color);
    }

    /** Load a texture using the resource collector */
    static async #loadTexture(texturePath, options) {
        try {
            const imageData = await ResourceCollector.fetchImageFile(texturePath, options);
            return {
                glTexture: TextureHandler.#defineTexture(texturePath, imageData, options),
                name: texturePath,
                width: imageData.width,
                height: imageData.height,
            }
        } catch (error) {
            console.error(`[TextureHandler] An error occurred attempting to load texture ${texturePath}: ${error}`);
            throw error;
        }
    }

    /** create a new default color and store it in the resource collector */
    static #createDefault(color) {
        const hexCode = color.hexCode();
        const width = 64, height = 64;
        const imageData = new Uint8Array(width * height * 4)

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                
                const topLeft = x < width / 2 && y < height / 2;
                const bottomRight = x > width / 2 - 1 && y > height / 2 - 1;
                const coloredCorner = topLeft || bottomRight;

                const colorInts = color.getInts();
                imageData[index+0] = coloredCorner ? colorInts.r : 30;
                imageData[index+1] = coloredCorner ? colorInts.g : 30;
                imageData[index+2] = coloredCorner ? colorInts.b : 30;
                imageData[index+3] = colorInts.a;
            }
        }

        const gl = TextureHandler.#gl;
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
            glTexture: TextureHandler.#defineTexture(hexCode, imageData, imageOptions),
            name: hexCode,
            width: width,
            height: height,
        }
        ResourceCollector.store(
            hexCode, textureInfo,
            { 
                disposalCallback: TextureHandler.#deleteTexture,
                disposalDelay: 0.5,
                category: 'texture',
            }
        );
        return textureInfo;
    }

    /** define a new webgl texture */
    static #defineTexture(path, image, options) {
        const gl = TextureHandler.#gl;
        let glTexture = null;
        try {
            glTexture = gl.createTexture();
            if (!glTexture) throw new Error(`[TextureHandler] Creation of new WebGL texture failed for image '${path}'.`)

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
            
            console.log(`[TextureHandler] Successfully created WebGL texture for image '${path}'.`);
            return glTexture;
        } catch (error) {
            console.error(`[TextureHandler] An error occurred when attempting to create WebGL texture from image '${path}': ${error}`);

            if (gl.isTexture(glTexture)) {
                gl.deleteTexture(glTexture);
            }

            throw error;s
        }
    }

    /** delete a webgl texture if exists */
    static #deleteTexture(textureInfo) {
        if (TextureHandler.#gl.isTexture(textureInfo.glTexture)) {
            TextureHandler.#gl.deleteTexture(textureInfo.glTexture);
        }
    }
}