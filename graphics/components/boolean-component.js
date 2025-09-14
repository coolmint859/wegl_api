import ShaderProgram from "../shading/shader-program.js";
import ColorComponent from "./color-component.js";
import Component from "./component.js";

export default class BoolComponent extends Component {
    #boolean = false;

    /**
     * Create a new material boolean component
     * @param {boolean} boolean the number to store in the component
     * @param {string} name the name of the integer component
     */
    constructor(boolean, name) {
        super(name);
        this.value = boolean;
    }

    /**
     * Set the value of this boolean component.
     * @param {boolean} bool the boolean value to set.
     */
    set value(bool) {
        if (!this.validValue(bool)) {
            console.warn(`[BooleanComponent] Expected 'bool' to be a boolean. Unable to set value.`)
        } else {
            this.#boolean = bool;
            this._isDirty = true;
        }
    }

    /**
     * Get the value of this boolean component.
     * @returns {boolean} the boolean associated with this material component 
     */
    get value() {
        return this.#boolean;
    }

    /**
     * Check if the provided value is valid for this component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return typeof value === 'boolean';
    }

    /**
     * Clone this component.
     * @param {boolean} deepCopy since booleans are primitives, their values are always 'cloned'.
     * @returns {BoolComponent} a new BoolComponent with the same value as this one.
     */
    clone(deepCopy = false) {
        return new BoolComponent(this.#boolean, this.name);
    }

    /**
     * Apply this color boolean to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     * @param {number} options.index the index to the glsl array of which this uniform is a value of. If this is not specified, it's assumed the uniform is not an array type.
     */
    applyToShader(shaderProgram, options={}) {
        if (!this._isDirty) return;

        const indexToken = typeof options.index === 'number' ? `[${options.index}]` : '';;
        const parentToken = typeof options.parentName === 'string' ? options.parentName : '';
        const uniformName = parentToken + this.name + indexToken;

        if (shaderProgram.supports(uniformName)) {
            shaderProgram.setUniform(uniformName, this.#boolean);
        }
        this._isDirty = false;
    }
}