/**
 * Represents a WebGL texture in the given WebGL context, with the specified path with the given options. Also holds a static registry of the contexts mapped to their glTexture instances. 
 * This allows for multiple Texture instances created with the same WebGL context and texture path to refer to the same underlying glTexture in memory.
 */
class Texture {
    static Type = {
        'DIFFUSE': 'diffuse',
        'SPECULAR': 'specular',
        'NORMAL': 'normal',
        'PARALLAX': 'parallax'
    };
    
    static #TEXTURE_ID = 0;
    static #textureRegistry = new Map();

    #gl;
    #contextName;
    #texturePath;
    #type;
    #id;
    #validType; // signals that the type is valid
    #texOptions;

    /**
     * Create a new Texture instance
     * @param {string} contextName the name of the WebGL context this texture will be created in. This must exist prior to instantiation.
     * @param {string} texturePath the path to the texture on disk
     * @param {string} type the type of texture (e.g. Texture.Type.DIFFUSE)
     * @param {object} options optional parameters to customize this texture. See docs for possible options (unknown ones are ignored)
     */
    constructor(contextName, texturePath, type, options={}) {
        this.#contextName = contextName;
        this.#texturePath = texturePath;
        this.#texOptions = options;
        this.#id = Texture.#TEXTURE_ID++;

        // check if texture type is a known type
        this.#validType = false
        this.#type = type;
        Object.values(Texture.Type).forEach(knownType => {
            if (type == knownType) this.#validType = true;
        });

        // check if the context name maps to a known context
        this.#gl = Graphics3D.getGLContext(contextName);
        let validContext = false;
        if (this.#gl) {
            validContext = true;
        }
        
        // only load texture into GPU memory if the type is valid and the gl context exists
        if (this.#validType && validContext) {
            this.#initializeTexture();
        } else {
            console.warn(`Warning: Either 'contextName' or 'type' are not known. This texture @${this.#texturePath} is considered invalid and cannot be used.\nNote: The given WebGL context must exist before instantiating a Texture.`);
        };
    }

    /**
     * Get the ID of this texture.
     * @returns {number} this texture's id
     */
    getID() {
        return this.#id;
    }

    /**
     * Get the type of this texture, (e.g. DIFFUSE, SPECULAR, etc...)
     * @returns {string} this texture's type
     */
    getType() {
        return this.#type;
    }

    /**
     * Get the WebGL context name that this texture was created with.
     * @returns {string} This texture's webGL context's name
     */
    getGLContextName() {
        return this.#contextName;
    }

    /**
     * Get the path that this texture was created with.
     * @returns {string} This texture's path
     */
    getTexturePath() {
        return this.#texturePath;
    }

    /**
     * Retreive a snapshot of the texture data associated with this texture. If the texture is not loaded or is invalid, null is returned.
     * @returns {object} a deep copy of the data associated with this texture, including the path and gl context name. Does not include the glTexture or reference count.
     */
    getTextureData() {
        return Texture.getTextureData(this.#contextName, this.#texturePath);
    }

    /**
     * Checks if the texture's type and webgl context are valid and exist, and that the texture has been loaded
     * @returns {boolean} true if the checks pass and the texture is valid/loaded, false otherwise
     */
    isValid() {
        // check if the type is valid
        if (!this.#validType) return false;

        // check if the gl context exists
        const glContext = Graphics3D.getGLContext(this.#contextName);
        if (!glContext) return false;

        // if the texture has a valid type and the context exists, next check if the image itself is loaded
        return this.isLoaded();
    }

    /** 
     * Checks if this texture was successfully loaded into GPU memory.
     * 
     * Note: a loaded Texture may not be a valid Texture (but, its very likely)
     * @returns {boolean} true if successfully loaded, false otherwise
     * */
    isLoaded() {
        // check if the texture collection exists
        const textureCollection = Texture.#textureRegistry.get(this.#contextName);
        if (!textureCollection) return false;

        // check if the texture data exists
        const textureData = textureCollection.getByName(this.#texturePath);
        if (!textureData || textureData.glTexture === null) return false;

        return textureData.isLoaded;
    }

    /** 
     * Binds this texture to it's WebGL context.
     * @param {number} locationIndex the GPU memory index location to bind the texture to.
     * @returns {boolean} true if this texture was successfully bound, false otherwise
     * */
    bind(locationIndex) {
        if (this.isValid()) {
            const gl = this.#gl;
            // no need to determine if textureData exists/has glTexture because isValid() covers this
            const textureData = Texture.#textureRegistry.get(this.#contextName).getByName(this.#texturePath);
            gl.activeTexture(gl.TEXTURE0 + locationIndex);
            gl.bindTexture(gl.TEXTURE_2D, textureData.glTexture);
            return true;
        } else {
            console.warn(`Warning: Texture @${this.#texturePath} (Context @${this.#contextName}) is not yet loaded or is invalid. Cannot bind this texture to GPU memory.`)
            return false;
        }
    }

    /** 
     * Unbinds this texture from it's WebGL context.
     * @param {number} locationIndex the GPU memory index location that the bound texture is at.
     * @returns {boolean} true if this texture was successfully unbound, false otherwise
     * */
    unbind(locationIndex) {
        if (this.isValid()) {
            const gl = this.#gl;
            gl.activeTexture(gl.TEXTURE0 + locationIndex);
            gl.bindTexture(gl.TEXTURE_2D, null);
            return true;
        } else {
            console.warn(`Warning: Texture @${this.#texturePath} (Context @${this.#contextName}) is not yet loaded or is invalid. Cannot unbind this texture from GPU memory.`);
            return false;
        }
    }

    /**
     * Create an exact replica of this Texture instance, including all preset options.
     * @param {string} contextName optional name for a different gl Context. If the name is valid, the new texture will be created in this context instead.
     * @returns {Texture | null } a copy of this Texture - if not a valid texture, returns null
     */
    clone(contextName = null) {
        if (!this.isValid) {
            console.error(`Error: Texture @${this.#texturePath} (Context @${this.#contextName}) is not yet loaded or is invalid. Cannot create a copy of this Texture.`);
            return null;
        }
        let glContextName;
        if (contextName === null) {
            glContextName = this.#contextName;
        } else if (!Graphics3D.getGLContext(contextName)) {
            console.warn("ValueError: Expected 'contextName' to be a non-empty string, refering to a valid WebGL context. Creating Texture in current context.");
            glContextName = this.#contextName;
        } else {
            glContextName = contextName;
        }

        // this is safe to do memory wise because of the static registry
        return new Texture(glContextName, this.#texturePath, this.#type, this.#texOptions);
    }

    /**
     * Release the texture at the given path with the associated context from memory.
     * @param {string} contextName the name of the WebGL context this texture is associated with
     * @param {string} texturePath the path to the texture
     * @returns {boolean} true if the texture was successfully released, false otherwise
     */
    static release(contextName, texturePath) {
        // check first if the context exists and has any textures defined
        const gl = Graphics3D.getGLContext(contextName);
        const textureCollection = Texture.#textureRegistry.get(contextName);
        if (!(textureCollection && gl)) {
            console.warn(`Warning: The WebGL context @${contextName} either doesn't exist or has no registered textures. Cannot release texture from memory.`);
            return false;
        }
        // then check if the collection has this specific texture defined
        const textureData = textureCollection.getByName(texturePath);
        if (!textureData) {
            console.warn(`Warning: Texture @${texturePath} (Context @${contextName}) was not found in the collection. Cannot release texture from memory.`);
            return false;
        }
        // at this point we know that the texture is defined, we're safe to operate on it
        textureData.refCount--; // decrement reference count

        // if the reference count is <= 0, delete the texture from memory
        if (textureData.refCount <= 0 ) {
            gl.deleteTexture(textureData.glTexture);
            textureCollection.removeByName(texturePath);
        }
        return true;
    }

    /**
     * Release all of the textures associated with the provided context from memory. Note that any Texture instances created with this context will no longer be valid.
     * @param {string} contextName the name of the WebGL context
     * @returns true if all textures associated with the context were released, false otherwise
     */
    static releaseAll(contextName) {
        const gl = Graphics3D.getGLContext(contextName);
        const textureCollection = Texture.#textureRegistry.get(contextName);
        if (!(textureCollection && gl)) {
            console.warn(`Warning: The WebGL context @${contextName} either doesn't exist or has no registered textures. Cannot release textures from memory.`);
            return false;
        }

        let allTexturesReleased = true;
        const texturePathsArray = Array.from(textureCollection.getNames());
        for (const texturePath of texturePathsArray) {
            if (!(Texture.release(contextName, texturePath))) {
                allTexturesReleased = false;
            }
        }
        return allTexturesReleased;
    }

    /**
     * Check if the texture path with the given context has successfully been loaded into GPU memory
     * @param {string} contextName the name of the WebGL context this texture is associated with
     * @param {string} texturePath the path to the texture
     * @returns {boolean} true if the texture is loaded, false otherwise
     */
    static isTextureLoaded(contextName, texturePath) {
        // first check if the registry has the texture collection
        const textureCollection = Texture.#textureRegistry.get(contextName);
        if (!textureCollection) return false;
        
        // then check if the collection has the texture
        const textureData = textureCollection.getByName(texturePath);
        if (!textureData) return false;

        // finally check if the status of the texture is loaded
        return textureData.isLoaded;
    }

    /**
     * Retreive a snapshot of the texture data associated with this texture. If the texture is not loaded or is invalid, null is returned.
     * @returns {object} a deep copy of the data associated with this texture, including the path and gl context name. Does not include the glTexture or reference count.
     */
    static getTextureData(contextName, texturePath) {
        // check first if registry has the texture collection
        const textureCollection = Texture.#textureRegistry.get(contextName);
        if (!textureCollection) {
            console.warn(`Warning: The WebGL context @${contextName} has no registered textures. Cannot get texture data.`);
            return null;
        }
        // then check if the collection has this specific texture defined
        const textureData = textureCollection.getByName(texturePath);
        if (!textureData) {
            console.warn(`Warning: Texture @${texturePath} (Context @${contextName}) was not found. Cannot get texture data.`);
            return null;
        }
        
        const texDataCopy = { 
            texturePath: texturePath,
            contextName: contextName,
            width: textureData.width,
            height: textureData.height,
            options: { ...textureData.options},
            isLoaded: textureData.isLoaded
        };

        // provide read only object
        return Object.freeze(texDataCopy);
    }

    #initializeTexture() {
        // this method is only called if the gl context is valid and the texture type is valid.
        // now we check if the image data was already loaded into memory

        // get textureCollection. If it doesn't exist, create a new one
        const texRegistry = Texture.#textureRegistry;
        if (!texRegistry.has(this.#contextName)) {
            texRegistry.set(this.#contextName, new Collection(`TextureCollection@${this.#contextName}`));
        }
        const textureCollection = texRegistry.get(this.#contextName);

        // if the textureCollection already has the texture, we increment the reference count and return.
        if (textureCollection.contains(this.#texturePath)) {
            textureCollection.getByName(this.#texturePath).refCount++;
            return;
        }

        // texture hasn't been made, so we create a new one
        this.#createNewTexture(textureCollection);
    }

    #createNewTexture(textureCollection) {
        // at this point, a new glTexture object needs to be created
        const textureObj = {
            glTexture: null,
            refCount: 1,
            width: 0,
            height: 0,
            options: this.#texOptions, // this is a js object of primitives
            isLoaded: false
        }
        // add it to the registry collection
        textureCollection.add(this.#texturePath, textureObj, this.#type);

        Texture.#loadTextureFromServer(this.#texturePath)
        .then(texImage => {
            // if the image failed to load, can't define the texture
            if (texImage === null) {
                console.error(`Texture: Failed to create glTexture instance for texture '${this.#texturePath}'. Removing asset from registry.`);
                textureCollection.removeByName(this.#texturePath);
                return;
            }

            // if the context doesn't exist anymore, then we can't define the texture. Log error and return.
            if (!this.#gl) {
                console.error(`Texture: GL context '${this.#contextName}' became unavailable during load of '${this.#texturePath}'. Cannot define texture.`);
                return;
            }
            // context exists image is loaded. Define the texture and update collection
            textureObj.glTexture = this.#defineTexture(texImage);
            textureObj.width = texImage.width;
            textureObj.height = texImage.height;
            textureObj.isLoaded = true;
        })
        .catch(error => { 
            // Catch any errors from #defineTexture or unexpected issues
            console.error(`Texture: Error processing Texture @${this.#texturePath} (Context @${this.#contextName}): `, error);
            textureCollection.removeByName(this.#texturePath);
        });
    }

    #defineTexture(image, options) {
        const gl = this.#gl;
        const options = this.#texOptions;

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

    static async #loadTextureFromServer(texturePath) {
        try {
            let asset = new Image();
            asset.crossOrigin = "anonymous";
            asset.src = texturePath;
            await asset.decode();
            console.log(`Loaded texture file @${texturePath} successfully into main memory.`);

            return asset;
        } catch (err) {
            console.error(`Error: Attempt to load texture file @${texturePath} into main memory was unsuccessful.`);
            return null;
        }
    }
}