import Component from "./component.js";
import TextureManager from "../modeling/texture-manager.js";
import ShaderProgram from "../shading/shader-program.js";

export default class TexComponent extends Component {
    #texturePath = "";
    #configOptions = null;

    /**
     * Create a new texture component
     * @param {string} name the name of the texture component
     * @param {string} texturePath the path to the texture to store in the component
     * @param {object} options webgl texture configuration options (see docs for possible values)
     */
    constructor(name, texturePath, options={}) {
        super(name);
        this.set(texturePath, textureType, options);
    }

    /**
     * Set the path and type of this texture component. 
     * @param {string} texturePath the path to the texture to store in the component
     * @param {Texture2DComponent.Type} textureType the type of this texture.
     * @param {object} options webgl texture configuration options (see docs for possible values)
     */
    set(texturePath, options={}) {
        if (!this.validTexture(texturePath, textureType)) {
            console.warn(`[TexComponent] Expected 'texturePath' to be a non-empty string and 'textureType' to be a valid texture type. Unable to load texture.`)
        } else {
            this.#texturePath = texturePath;
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
     * Release this material component from use.
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
     * Clone this component.
     * @param {boolean} deepCopy Textures are not cloned to save memory.
     * @returns {TexComponent} a new TexComponent with the same value as this one.
     */
    clone(deepCopy = false) {
        return new TexComponent(this.name, this.#texturePath, this.#configOptions);
    }

    /**
     * Apply this material component to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     * @param {number} options.index the index to the glsl array of which this uniform is a value of. If this is not specified, it's assumed the uniform is not an array type.
     */
    applyToShader(shaderProgram, options={}) {
        if (!this._isDirty) return;
        
        const indexToken = typeof options.index === 'number' ? `[${options.index}]` : '';
        const parentToken = typeof options.parentName === 'string' ? options.parentName : '';
        const uniformName = parentToken + this.name + indexToken;

        if (shaderProgram.supports(uniformName)) {
            let glTexture = this.isReady ? 
                            this.glTexture : 
                            TextureManager.getDefault(this.#configOptions.defaultColor);
            shaderProgram.setUniform(uniformName, glTexture);
        }
        this._isDirty = false;
    }
}
