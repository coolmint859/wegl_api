import MaterialComponent from "./material-component.js";
import TextureManager from "../texture-manager.js";

export default class TexComponent extends MaterialComponent {
    static Type = Object.freeze({
        'DIFFUSE': 'diffuse',
        'SPECULAR': 'specular',
        'NORMAL': 'normal',
        'PARALLAX': 'parallax'
    });
    #texturePath = "";
    #textureType = "";
    #configOptions = null;

    /**
     * Create a new material texture component
     * @param {string} name the name of the texture component
     * @param {string} texturePath the path to the texture to store in the component
     * @param {Texture2DComponent.Type} textureType the type of this texture.
     * @param {object} options webgl texture configuration options (see docs for possible values)
     */
    constructor(name, texturePath, textureType, options={}) {
        super(name);
        this.set(texturePath, textureType, options);
    }

    /**
     * Set the path and type of this texture component. 
     * @param {string} texturePath the path to the texture to store in the component
     * @param {Texture2DComponent.Type} textureType the type of this texture.
     * @param {object} options webgl texture configuration options (see docs for possible values)
     */
    set(texturePath, textureType, options={}) {
        if (!this.validTexture(texturePath, textureType)) {
            console.warn(`[TexComponent] Expected 'texturePath' to be a non-empty string and 'textureType' to be a valid texture type. Unable to load texture.`)
        } else {
            this.#texturePath = texturePath;
            this.#textureType = textureType;
            this.#configOptions = options;
            
            if (TextureManager.contains(this.#texturePath)) {
                TextureManager.acquire(this.#texturePath);
                this._isDirty = true;
            } else {
                TextureManager.load(this.#texturePath, options)
                .then(textureInfo => this._isDirty = true);
            }

            this._isDirty = true; // this makes sure the default texture is used at first
        }
    }

    /**
     * Get the gl texture of this texture component.
     * @returns {WebGLTexture | null} the webgl texture instance if loaded. If not yet loaded, null is returned.
     */
    get glTexture() {
        if (this.#texturePath.trim() === "") return null;
        return TextureManager.get(this.#texturePath).glTexture;
    }

    /**
     * Get the path of this texture component.
     * @returns {string} the path to the image file asssociated with this texture component
     */
    get path() {
        return this.#texturePath;
    }

    /**
     * Check if this texture has been loaded into memory and ready to send to the gpu
     * @returns {boolean} true if the texture is ready, false otherwise
     */
    get isReady() {
        return TextureManager.isLoaded(this.#texturePath);
    }

    /**
     * Acquire this texture for use.
     * @returns {TexComponent} a reference to this texture component
     */
    acquire() {
        super.acquire();
        return this;
    }

    /**
     * Release this texture from use.
     */
    release() {
        super.release();
        
        // only release the texture from the manager if the ref count is 0.
        if (this.refCount === 0) {
            TextureManager.release(this.#texturePath);
        }
    }

    /**
     * Check if the provided texture path and type are valid for this texture component
     * @param {string} texturePath the texture path to check
     * @param {string} textureType the texture type to check
     * @returns {boolean} true if the path and type are valid, false otherwise
     */
    validTexture(texturePath, textureType) {
        const validPath = typeof texturePath === 'string' && texturePath.trim() !== '';
        const validType = Object.values(TexComponent.Type).some(type => type === textureType);
        return validPath && validType;
    }

    /**
     * Create an exact copy of this texture component
     * @returns {TexComponent} a new Texture2DComponent with the same properties as this one.
     */
    clone() {
        return new TexComponent(
            this.name, 
            this.#texturePath, 
            this.#textureType, 
            this.#configOptions
        );
    }

    /**
     * Apply the texture to a shader program. If the texture has not yet loaded, a default is applied instead.
     * @param {ShaderProgram} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram) {
        if (!this._isDirty) return;

        let glTexture;
        if (this.isReady) {
            glTexture = this.glTexture;
        } else {
            glTexture = TextureManager.createDefault(this.#configOptions.defaultColor);
        }

        shaderProgram.setSampler2D(this.name, glTexture);
        this._isDirty = false;
    }
}
