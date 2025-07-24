import Graphics3D from '../rendering/renderer.js';
import ResourceCollector from '../../utilities/collector.js';

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
    static #defaultTextureName = "defaultTexture"
    static #gl;

    #textureID;
    #texturePath;
    #activeTexture;
    #texOptions;
    #textureLoadPromise;
    #textureCategory;
    #disposalDelay;

    /**
     * Create a new Texture instance
     * @param {string} texturePath the path to the texture on disk
     * @param {string} type the type of texture (e.g. Texture.Type.DIFFUSE)
     * @param {string} options.category an optional category for the texture, allowing for aggregate texture operations through ResourceCollector/ResourceDisposer.
     * @param {number} options.disposalDelay the delay time in seconds before the texture is disposed of if no materials use it. Default is 0.5 seconds
     * 
     * See docs for other optional parameters9
     */
    constructor(texturePath, options={}) {
        this.#textureID = Texture.#TEXTURE_ID++;
        if (typeof texturePath !== 'string' || texturePath.trim() === '') {
            console.error(`[Texture ID#${this.#textureID}] TypeError: Expected 'texturePath' to be a non-empty string. Applying default Texture.`);
            this.#texturePath = Texture.#defaultTextureName;
        } else {
            this.#texturePath = texturePath;
        }
        this.#activeTexture = Texture.#defaultTextureName; // set to default until image is loaded
        this.#texOptions = options;
        this.#textureLoadPromise = null;
        this.#textureCategory = options.category ? options.category : 'texture';
        this.#disposalDelay = options.disposalDelay ? options.disposalDelay : 0.5;

        if (!Texture.#gl) Texture.#gl = Graphics3D.getGLContext();
        this.#createDefaultTexture();
    }

    /**
     * Get the ID of this texture.
     * @returns {number} this texture's id
     */
    getID() {
        return this.#textureID;
    }

    /**
     * Get the currently active texture path
     * @returns {string} This texture's path
     */
    getActiveTexture() {
        return this.#activeTexture;
    }

    /** 
     * Checks if this texture was successfully loaded into memory.
     * @returns {boolean} true if successfully loaded, false otherwise
     * */
    isLoaded() {
        return ResourceCollector.isLoaded(this.#texturePath);
    }

    /** 
     * Checks if this texture failed to load successfully into memory.
     * @returns {boolean} true if failed to load, false otherwise
     * */
    loadFailed() {
        return ResourceCollector.isFailed(this.#texturePath);
    }

    /**
     * Acquire this texture for use. If this was the first time is was acquired, it loads the image data into memory.
     * @param {number | null} maxRetries the maximum number of retry attempts for loading if the first load fails - ignored if texture already loaded
     * @returns {Promise} a promise indicating success or failure on acquiring the texture.
     */
    async acquire(maxRetries = 3) {
        // first time acquisition, load texture into memory and set as active
        if (this.#textureLoadPromise === null) {
            try {
                this.#textureLoadPromise = ResourceCollector.load(
                    this.#texturePath, 
                    this.#loadTexture.bind(this), 
                    {
                        maxRetries,
                        disposalDelay: this.#disposalDelay, 
                        disposeCallback: this.#deleteTexture.bind(this),
                        category: this.#textureCategory
                    }
                )
                await this.#textureLoadPromise;
                this.#activeTexture = this.#texturePath;
                return Promise.resolve(this);
            } catch (error) {
                console.error(`[Texture ID#${this.#textureID}] Attempt to acquire texture '${this.#texturePath}' failed: ${error}`);
                throw error;
            }
        // subsequent acquisitions
        } else {
            if (ResourceCollector.acquire(this.#activeTexture)) {
                return this.#textureLoadPromise.then(() => this);  
            } else {
                console.error(`[Texture ID#${this.#textureID}] Failed to acquire additional reference for texture '${this.#activeTexture}'. Resource not found in cache.`);
                // If the previous promise was rejected, re-throw that rejection
                if (this.#textureLoadPromise && this.#textureLoadPromise.then) {
                    await this.#textureLoadPromise; 
                }
                throw new Error(`[Texture ID#${this.#textureID}] Attempt to acquire texture '${this.#activeTexture}' failed.`);
            }
        }
    }

    /**
     * Release this texture from use if it was previously acquired.
     * @returns {boolean} true if the texture was successfully released, false otherwise
     */
    release() {
        if (this.#textureLoadPromise !== null) {
            return ResourceCollector.release(this.#activeTexture);
        }
        console.warn(`[Texture ID#${this.#textureID}] Cannot release texture '${this.#activeTexture}' that has not yet been acquired.`);
        return false;
    }

    /**
     * Reload the image data this texture represents.
     * @param {number | null} maxRetries the maximum number of retry attempts for loading if the first reload fails
     * @returns {Promise} a promise indicating success or failure on reloading the texture.
     */
    async reload(maxRetries = 3) {
        try {
            reloadedData = await ResourceCollector.reload(this.#texturePath, { maxRetries });
            console.log(`[Texture ID#${this.#textureID}]: Successfully reloaded '${this.#texturePath}'.`);
            return reloadedData;
        } catch (error) {
            console.log(`[Texture ID#${this.#textureID}]: Failed to reload '${this.#texturePath}'.`);
            throw error;
        }
    }

    /** 
     * Binds this texture to it's WebGL context.
     * @param {number} locationIndex the GPU memory index location to bind the texture to.
     * @returns {boolean} true if this texture was successfully bound, false otherwise
     * */
    bind(locationIndex) {
        if (ResourceCollector.isLoaded(this.#activeTexture)) {
            const gl = Texture.#gl;

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
        if (ResourceCollector.isLoaded(this.#activeTexture)) {
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
     * @returns {Texture | null } a copy of this Texture - if not a valid texture, returns null
     */
    clone() {
        if (!ResourceCollector.isLoaded(this.#activeTexture)) {
            console.error(`[Texture ID#${this.#textureID}] Error: Texture '${this.#activeTexture}' is not yet loaded or is invalid. Cannot create a copy of this Texture.`);
            return null;
        }
        return new Texture(this.#texturePath, this.#texOptions);
    }

    /**
     * Retreive a snapshot of the texture metadata associated with this texture. If the texture is not loaded or is invalid, null is returned.
     * @param {string} texturePath the path to the texture
     * @returns {object} a copy of the metadata associated with this texture, including the path.
     */
    snapshot() {
        // check if the collection has this specific texture defined
        const textureData = ResourceCollector.get(this.#activeTexture);
        if (!textureData) {
            console.warn(`Warning: Texture '${this.#activeTexture}' was not found. Cannot get texture data.`);
            return null;
        }
        
        const texDataCopy = { 
            texturePath: this.#activeTexture,
            width: textureData.width,
            height: textureData.height,
            options: { ...this.#texOptions}
        };

        // provide read only object
        return Object.freeze(texDataCopy);
    }

    /** Called when a new texture should be loaded into memory for the first time */
    async #loadTexture(texturePath, loadOptions) {
        try {
            const imageData = await ResourceCollector.loadImageFile(texturePath, loadOptions);
            return {
                glTexture: this.#defineTexture(imageData, this.#texOptions),
                width: imageData.width,
                height: imageData.height,
                crossOrigin: imageData.crossOrigin,
            }
        } catch (error) {
            console.error(`[Texture ID${this.#textureID}] An error occurred attempting to load texture data: ${error}`);
            this.#textureLoadPromise = null;
            this.#activeTexture = Texture.#defaultTextureName;
            throw error;
        }
    }

    /** called when a texture should be removed from memory */
    #deleteTexture(textureData) {
        Texture.#gl.deleteTexture(textureData.glTexture);
        this.#textureLoadPromise = null;
        this.#activeTexture = Texture.#defaultTextureName;
    }

    #createDefaultTexture() {
        // create default here
    }

    /** create a webgl texture from the given image */
    #defineTexture(image, options) {
        const gl = Texture.#gl;
        let glTexture = null;
        try {
            glTexture = gl.createTexture();
            if (!glTexture) throw new Error('Creation of new WebGL texture instance failed.')

            gl.bindTexture(gl.TEXTURE_2D, glTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            // Apply texture parameters - if the options object doesn't have it, apply a default.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, options.wrapS || gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, options.wrapT || gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.minFilter || gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, options.magFilter || gl.LINEAR);

            // generate mipmap if requested
            if (options.generateMipmaps !== false) {
                gl.generateMipmap(gl.TEXTURE_2D);
            }

            gl.bindTexture(gl.TEXTURE_2D, null);

            return glTexture;
        } catch (error) {
            console.error(`[Texture ID${this.#textureID}] An error occurred when attempting to create WebGL texture from image: ${error}`);

            if (gl.isTexture(glTexture)) {
                gl.deleteTexture(glTexture);
            }

            throw error;
        }
    }
}