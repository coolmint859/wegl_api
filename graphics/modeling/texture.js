import Graphics3D from '../rendering/renderer.js';
import AssetRegistry from '../../utilities/registry.js';

/**
 * Represents a WebGL texture in the given WebGL context, with the specified path with the given options. Also holds a static registry of the contexts mapped to their glTexture instances. 
 * This allows for multiple Texture instances created with the same WebGL context and texture path to refer to the same underlying glTexture in memory.
 */
export default class Texture {
    static Type = Object.freeze({
        'DIFFUSE': 'diffuse',
        'SPECULAR': 'specular',
        'NORMAL': 'normal',
        'PARALLAX': 'parallax'
    });
    
    static #TEXTURE_ID = 0;
    static #gl;

    #texturePath;
    #textureID;
    #texOptions;

    /**
     * Create a new Texture instance
     * @param {string} texturePath the path to the texture on disk
     * @param {string} type the type of texture (e.g. Texture.Type.DIFFUSE)
     * @param {object} options optional parameters to customize this texture. See docs for possible options (unknown ones are ignored)
     */
    constructor(texturePath, options={}) {
        this.#texturePath = texturePath;
        this.#texOptions = options;
        this.#textureID = Texture.#TEXTURE_ID++;
        Texture.#gl = Graphics3D.getGLContext();

        if (typeof texturePath === 'string' && texturePath.trim() !== '') {
            AssetRegistry.load(texturePath, this.#loadTexture.bind(this), this.#disposeTexture.bind(this))
            .then(assetData => {
                console.log(`[Texture ID#${this.#textureID}] Created new texture '${texturePath}'.`);
            }).catch(error => {
                console.error(`[Texture ID#${this.#textureID}] Failed to create texture '${texturePath}': ${error}`)
            });
        } else {
            console.error(`[Texture ID#${this.#textureID}] TypeError: Expected 'texturePath' to be a non-empty string. Cannot load texture into memory.`)
        }
    }

    /**
     * Get the ID of this texture.
     * @returns {number} this texture's id
     */
    getID() {
        return this.#textureID;
    }

    /**
     * Get the path that this texture was created with.
     * @returns {string} This texture's path
     */
    getTexturePath() {
        return this.#texturePath;
    }

    /** 
     * Checks if this texture was successfully loaded into memory.
     * @returns {boolean} true if successfully loaded, false otherwise
     * */
    loadSuccess() {
        return AssetRegistry.isLoaded(this.#texturePath);
    }

    /** 
     * Checks if this texture failed to load successfully into memory.
     * @returns {boolean} true if failed to load, false otherwise
     * */
    loadFailure() {
        return AssetRegistry.isFailed(this.#texturePath);
    }

    async reload() {
        try {
            reloadedData = await AssetRegistry.reload(this.#texturePath);
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
        if (AssetRegistry.isLoaded(this.#texturePath)) {
            const gl = Texture.#gl;

            const textureData = AssetRegistry.getAssetData(this.#texturePath);
            gl.activeTexture(gl.TEXTURE0 + locationIndex);
            gl.bindTexture(gl.TEXTURE_2D, textureData.glTexture);
            return true;
        } else {
            console.warn(`[Texture ID#${this.#textureID}] Warning: Texture '${this.#texturePath}' is not yet loaded or is invalid. Cannot bind this texture to GPU memory.`)
            return false;
        }
    }

    /** 
     * Unbinds this texture from it's WebGL context.
     * @param {number} locationIndex the GPU memory index location that the bound texture is at.
     * @returns {boolean} true if this texture was successfully unbound, false otherwise
     * */
    unbind(locationIndex) {
        if (AssetRegistry.isLoaded(this.#texturePath)) {
            const gl = Texture.#gl;

            gl.activeTexture(gl.TEXTURE0 + locationIndex);
            gl.bindTexture(gl.TEXTURE_2D, null);
            return true;
        } else {
            console.warn(`[Texture ID#${this.#textureID}] Warning: Texture '${this.#texturePath}' is not yet loaded or is invalid. Cannot unbind this texture from GPU memory.`);
            return false;
        }
    }

    /**
     * Create an exact replica of this Texture instance, including all preset options.
     * @returns {Texture | null } a copy of this Texture - if not a valid texture, returns null
     */
    clone() {
        if (!AssetRegistry.isLoaded(this.#texturePath)) {
            console.error(`[Texture ID#${this.#textureID}] Error: Texture '${this.#texturePath}' is not yet loaded or is invalid. Cannot create a copy of this Texture.`);
            return null;
        }
        return new Texture(this.#texturePath, this.#texOptions);
    }

    /**
     * Release this texture from memory.
     * @returns {boolean} true if the texture was successfully released, false otherwise
     */
    release() {
        return AssetRegistry.release(this.#texturePath);
    }

    /**
     * Retreive a snapshot of the texture data associated with this texture. If the texture is not loaded or is invalid, null is returned.
     * @param {string} texturePath the path to the texture
     * @returns {object} a deep copy of the data associated with this texture, including the path. Does not include the glTexture or reference count.
     */
    getTextureData() {
        // check if the collection has this specific texture defined
        const textureData = AssetRegistry.getAssetData(this.#texturePath);
        if (!textureData) {
            console.warn(`Warning: Texture '${this.#texturePath}' was not found. Cannot get texture data.`);
            return null;
        }
        
        const texDataCopy = { 
            texturePath: this.#texturePath,
            width: textureData.width,
            height: textureData.height,
            options: { ...this.#texOptions}
        };

        // provide read only object
        return Object.freeze(texDataCopy);
    }

    /** Called when a new texture should be loaded into memory for the first time */
    async #loadTexture(texturePath) {
        const imageData = await AssetRegistry.loadImage(texturePath);
        return {
            glTexture: Texture.#defineTexture(imageData, this.#texOptions),
            width: imageData.width,
            height: imageData.height,
        }
    }

    /** called when a texture should be removed from memory */
    #disposeTexture(textureData) {
        Texture.#gl.deleteTexture(textureData.glTexture);
    }

    /** create a webgl texture from the given image */
    static #defineTexture(image, options) {
        const gl = Texture.#gl;
        let glTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, glTexture); // bind texture
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

        gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture

        return glTexture;
    }
}