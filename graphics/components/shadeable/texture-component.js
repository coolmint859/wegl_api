import { ShaderProgram, TextureHandler } from "../../systems/index.js"
import { Color } from "../../utilities/index.js";
import Component from "../component.js";

/**
 * Represents a glsl sampler uniform and accompanying texture data
 */
export default class TexComponent extends Component {
    #texturePath = "";
    #textureOptions = null;

    /**
     * Create a new texture component
     * @param {string} texturePath the path to the texture to store in the component
     * @param {string} name the name of the texture component
     * @param {object} options webgl texture configuration options (see docs for possible values)
     */
    constructor(texturePath, name, options={}) {
        super(name, [Component.Modifier.SHADEABLE]);
        this.set(texturePath, options);
    }

    /**
     * Set the path and type of this texture component. 
     * @param {string} texturePath the path to the texture to store in the component
     * @param {Texture2DComponent.Type} textureType the type of this texture.
     * @param {object} options webgl texture configuration options (see docs for possible values)
     */
    set(texturePath, options={}) {
        if (!this.validValue(texturePath)) {
            console.warn(`[TexComponent] Expected 'texturePath' to be a non-empty string and 'textureType' to be a valid texture type. Unable to load texture.`)
        } else {
            this.#texturePath = texturePath;
            this.#textureOptions = options;

            if (!this.#textureOptions.defaultColor) {
                this.#textureOptions.defaultColor = Color.RED;
            }
            
            if (TextureHandler.contains(this.#texturePath)) {
                TextureHandler.acquire(this.#texturePath);
            } else {
                TextureHandler.load(this.#texturePath, options)
            }
        }
    }

    /**
     * Get the gl texture of this texture component.
     * @returns {WebGLTexture | null} the webgl texture instance if loaded. If not yet loaded, null is returned.
     */
    get glTexture() {
        if (TextureHandler.isLoaded(this.#texturePath)) {
            return TextureHandler.get(this.#texturePath).glTexture;
        }
        return null;
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
        return TextureHandler.isLoaded(this.#texturePath);
    }

    /**
     * Release this material component from use.
     */
    release() {
        super.release();
        
        // only release the texture from the manager if the ref count is 0.
        if (this.refCount === 0) {
            TextureHandler.release(this.#texturePath);
        }
    }

    /**
     * Check if the provided texture path is valid
     * @param {string} texturePath the texture path to check
     * @returns {boolean} true if the path is valid, false otherwise
     */
    validValue(texturePath) {
        return typeof texturePath === 'string' && texturePath.trim() !== '';
    }

    /**
     * Clone this component.
     * @returns {TexComponent} a new TexComponent with the same value as this one.
     */
    clone() {
        return new TexComponent(this.name, this.#texturePath, this.#textureOptions);
    }

    /**
     * Apply this texture component to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     * @param {number} options.index the index to the glsl array of which this uniform is a value of. If this is not specified, it's assumed the uniform is not an array type.
     */
    applyToShader(shaderProgram, options={}) {
        const indexToken = typeof options.index === 'number' ? `[${options.index}]` : '';
        const parentToken = typeof options.parentName === 'string' ? `${options.parentName}.` : '';
        const uniformName = parentToken + this.name + indexToken;

        if (shaderProgram.supports(uniformName)) {
            let glTexture = this.isReady ? 
                            this.glTexture : 
                            TextureHandler.getDefault(this.#textureOptions.defaultColor);
            shaderProgram.setSampler(uniformName, glTexture);
        }
    }
}
