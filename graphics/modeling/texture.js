import Graphics3D from '../rendering/renderer.js';
import ResourceCollector from '../../utilities/containers/collector.js';

/**
 * Represents a WebGL texture with the specified path and options.
 * Capable of being used by multiple consumers. Texture instances created with the same texture path will use the same underlying image data in memory.
 * 
 * @interface Proxy - classes that implement this are proxies to underlying resources, typically managed by ResourceCollector
 * @method acquire - acquire the underlying resource for use - returns a promise
 * @method release - release the underlying resource from use
 * @method reload - reload the underlying resource - returns a promise
 * @method snapshot - get a snapshot of the metadata associated with the underlying resource
 */
export default class Texture {
    static Type = Object.freeze({
        'DIFFUSE': 'diffuse',
        'SPECULAR': 'specular',
        'NORMAL': 'normal',
        'PARALLAX': 'parallax'
    });
    
    static #TEXTURE_ID = 0;
    static #defaultTexture = null;
    static #defaultTextureName = 'default-texture';
    static #defaultCategory = 'texture';
    static #gl;

    #textureID;
    #refCount;
    #texturePath;
    #activeTexture;
    #texOptions;
    #textureCategory;
    #disposalDelay;

    /**
     * Create a new Texture instance
     * @param {string} texturePath the path to the texture on disk
     * @param {string} options.category an optional category for the texture, allowing for aggregate texture operations through ResourceCollector/ResourceDisposer.
     * @param {number} options.disposalDelay the delay time in seconds before the texture is disposed of if no consumers use it. Default is 0.5 seconds
     * 
     * See docs for other optional parameters9
     */
    constructor(texturePath, options={}) {
        this.#textureID = Texture.#TEXTURE_ID++;
        if (typeof texturePath !== 'string' || texturePath.trim() === '') {
            console.error(`[Texture ID#${this.#textureID}] TypeError: Expected 'texturePath' to be a non-empty string. Applying default texture.`);
            this.#texturePath = null;
        } else {
            this.#texturePath = texturePath;
        }
        this.#activeTexture = Texture.#defaultTextureName; // set to default until image is loaded
        this.#texOptions = options;
        this.#textureCategory = options.category ? options.category : Texture.#defaultCategory;
        this.#disposalDelay = options.disposalDelay ? options.disposalDelay : 0.5;
        this.#refCount = 0;

        if (!Texture.#gl) Texture.#gl = Graphics3D.getGLContext();
        Texture.#createDefaultTexture();
    }

    /**
     * Get the ID of this texture.
     * @returns {number} this texture's id
     */
    get id() {
        return this.#textureID;
    }

    /**
     * Get the currently active texture image (the image that will be used when bind() is called)
     * @returns {string} This texture's path
     */
    get activeImage() {
        return this.#activeTexture;
    }

    /**
     * Get the assigned texture image (the image that was given at initialization)
     * @returns {string} This texture's path
     */
    get assignedImage() {
        if (this.#texturePath === null) return '';
        return this.#texturePath;
    }

    /** 
     * Checks if this texture was successfully loaded into memory.
     * @returns {boolean} true if successfully loaded, false otherwise
     * */
    get isLoaded() {
        if (this.#texturePath === null) return true;
        return ResourceCollector.isLoaded(this.#texturePath);
    }

    /** 
     * Checks if this texture failed to load successfully into memory.
     * @returns {boolean} true if failed to load, false otherwise
     * */
    get loadFailed() {
        if (this.#texturePath === null) return false;
        return ResourceCollector.isFailed(this.#texturePath);
    }

    /**
     * Acquire this texture for use. If this was the first time it was acquired, this loads the image data into memory.
     * @param {number | null} maxRetries the maximum number of retry attempts for loading if the first load fails - ignored if texture already loaded
     * @returns {Promise} a promise indicating success or failure on acquiring the texture.
     */
    async acquire(maxRetries = 3) {
        // if the texture image doesn't exist in the cache, then it must be loaded in
        if (this.#texturePath !== null) {
            if (!ResourceCollector.contains(this.#texturePath)) {
                console.log(`[Texture ID#${this.#textureID}] First time load of texture ${this.#texturePath}!`)
                return this.#loadTextureResource(maxRetries);
            // if ref count is 0 and texture exists, simply acquire it
            } else if (this.#refCount === 0) {
                console.log(`[Texture ID#${this.#textureID}] Using existing texture ${this.#texturePath}.`)
                ResourceCollector.acquire(this.#texturePath);
            }
        }
        // always increase texture reference count on acquire.
        this.#refCount++;
    }

    /**
     * Release this texture from use if it was previously acquired. If there is no more consumers using this texture, then the image data is scheduled for disposal.
     * @returns {boolean} true if the texture was successfully released, false otherwise
     */
    release() {
        if (this.#refCount === 0) {
            console.error(`[Texture ID#${this.#textureID}] Cannot release texture '${this.#activeTexture}' as it has no active consumers.`);
            return false;
        }
        this.#refCount--;
        // release the image if no more references on this texture (the given image, as the active one might be the default)
        if (this.#refCount === 0) {
            if (this.#texturePath !== null) {
                ResourceCollector.release(this.#texturePath);
            }
            this.#activeTexture = Texture.#defaultTextureName;
        }
        return true;
    }

    /**
     * Reload the image data this texture represents.
     * @param {number | null} maxRetries the maximum number of retry attempts for loading if the first reload fails
     * @returns {Promise} a promise indicating success or failure on reloading the texture.
     */
    async reload(maxRetries = 3) {
        if (this.#texturePath === null) {
            console.error(`[Texture ID#${this.#textureID}]: Cannot Attempt reload of invalid texture path.`);
            return Promise.reject("Cannot reload invalid texture.");
        }
        if (ResourceCollector.isLoaded(this.#texturePath) || ResourceCollector.isFailed(this.#texturePath)) {
            try {
                reloadedData = await ResourceCollector.reload(this.#texturePath, { maxRetries });
                console.log(`[Texture ID#${this.#textureID}]: Successfully reloaded '${this.#texturePath}'.`);
                return reloadedData;
            } catch (error) {
                console.log(`[Texture ID#${this.#textureID}]: Failed to reload '${this.#texturePath}'.`);
                throw error;
            }
        } else {
            console.error(`[Texture ID#${this.#textureID}]: Cannot reload '${this.#texturePath}' because it has not yet been acquired or is currently loading.`);
            return Promise.reject("Cannot reload unacquired/currently loading texture.");
        }
    }

    /**
     * Retreive a snapshot of the texture metadata associated with this texture. If the texture is not loaded or is invalid, null is returned.
     * @returns {object} a copy of the metadata associated with this texture, including the active and assigned paths.
     */
    get snapshot() {
        // check if the collection has this specific texture defined
        const textureData = ResourceCollector.get(this.#activeTexture);
        if (!textureData) {
            console.warn(`Warning: Texture '${this.#activeTexture}' has not yet loaded or has not been acquired. Cannot get texture data.`);
            return null;
        }
        
        const texDataCopy = { 
            assignedPath: this.#texturePath,
            activePath: this.#activeTexture,
            width: textureData.width,
            height: textureData.height,
            options: { ...this.#texOptions}
        };

        // provide read only object
        return Object.freeze(texDataCopy);
    }

    /** 
     * Binds this texture to it's WebGL context.
     * @param {number} locationIndex the GPU memory index location to bind the texture to.
     * @returns {boolean} true if this texture was successfully bound, false otherwise
     * */
    bind(locationIndex) {
        const gl = Texture.#gl;
        if (this.#activeTexture === Texture.#defaultTextureName) {
            gl.activeTexture(gl.TEXTURE0 + locationIndex);
            gl.bindTexture(gl.TEXTURE_2D, Texture.#defaultTexture);
            return true;
        } else if (ResourceCollector.isLoaded(this.#activeTexture)) {
            const textureData = ResourceCollector.get(this.#activeTexture);
            gl.activeTexture(gl.TEXTURE0 + locationIndex);
            gl.bindTexture(gl.TEXTURE_2D, textureData.glTexture);
            return true;
        } else {
            console.warn(`[Texture ID#${this.#textureID}] Warning: Texture '${this.#activeTexture}' is not yet loaded or is invalid. Cannot bind this texture to GPU memory.`)
            return false;
        }
    }

    /** 
     * Unbinds this texture from it's WebGL context.
     * @param {number} locationIndex the GPU memory index location that the bound texture is at.
     * @returns {boolean} true if this texture was successfully unbound, false otherwise
     * */
    unbind(locationIndex) {
        if (this.#activeTexture === Texture.#defaultTextureName || ResourceCollector.isLoaded(this.#activeTexture)) {
            const gl = Texture.#gl;

            gl.activeTexture(gl.TEXTURE0 + locationIndex);
            gl.bindTexture(gl.TEXTURE_2D, null);
            return true;
        } else {
            console.warn(`[Texture ID#${this.#textureID}] Warning: Texture '${this.#activeTexture}' is not yet loaded or is invalid. Cannot unbind this texture from GPU memory.`);
            return false;
        }
    }

    /**
     * Create an exact replica of this Texture instance, including all preset options.
     * @returns {Texture | null } a copy of this Texture - if the texture image hasn't loaded yet, this returns null
     */
    clone() {
        if (!ResourceCollector.isLoaded(this.#activeTexture)) {
            console.error(`[Texture ID#${this.#textureID}] Error: Texture '${this.#activeTexture}' is not yet loaded or is invalid. Cannot create a copy of this Texture.`);
            return null;
        }
        return new Texture(this.#texturePath, this.#texOptions);
    }

    /** called if a texture was newly acquired and the texture image hasn't been loaded yet */
    async #loadTextureResource(maxRetries) {
        try {
            await ResourceCollector.load(
                this.#texturePath, 
                this.#loadTexture.bind(this), 
                {
                    maxRetries,
                    disposalDelay: this.#disposalDelay, 
                    disposalCallback: this.#deleteTexture.bind(this),
                    category: this.#textureCategory
                }
            )
            this.#activeTexture = this.#texturePath;
            console.log(`[Texture ID#${this.#textureID}] Successfully loaded texture ${this.#activeTexture}.`)
            return Promise.resolve(this);
        } catch (error) {
            console.error(`[Texture ID#${this.#textureID}] Attempt to load and acquire texture '${this.#texturePath}' failed: ${error}`);
            throw error;
        }
    }

    /** Called when a new texture should be loaded into memory for the first time */
    async #loadTexture(texturePath, loadOptions) {
        try {
            const imageData = await ResourceCollector.fetchImageFile(texturePath, loadOptions);
            return {
                glTexture: Texture.#defineTexture(texturePath, imageData, this.#texOptions),
                width: imageData.width,
                height: imageData.height,
            }
        } catch (error) {
            console.error(`[Texture ID${this.#textureID}] An error occurred attempting to load texture data: ${error}`);
            throw error;
        }
    }

    /** called when a texture should be removed from memory */
    #deleteTexture(textureData) {
        Texture.#gl.deleteTexture(textureData.glTexture);
    }

    static #createDefaultTexture() {
        if (Texture.#defaultTexture !== null) {
            return; // default texture already created
        }

        const gl = Texture.#gl;

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
                    r = 255, g = 0, b = 255;
                } else {
                    r = 0, g = 0, b = 0;
                }

                imageData[index] = r;
                imageData[index + 1] = g;
                imageData[index + 2] = b;
                imageData[index + 3] = 255;
            }
        }
        const imageOptions = { 
            wrapT: gl.CLAMP_TO_EDGE, 
            wrapS: gl.CLAMP_TO_EDGE,
            magFilter: gl.NEAREST,
            minFilter: gl.NEAREST,
            generateMipmaps: true,
            width: width,
            height: height
        }
        Texture.#defaultTexture = Texture.#defineTexture(Texture.#defaultTextureName, imageData, imageOptions);
    }

    /** create a webgl texture from the given image */
    static #defineTexture(path, image, options) {
        const gl = Texture.#gl;
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
}