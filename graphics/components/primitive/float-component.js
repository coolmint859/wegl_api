import { ShaderProgram } from "../../shading/index.js";
import Component from "../component.js";

export default class FloatComponent extends Component {
    #value = 1.0;

    /**
     * Create a new material float component
     * @param {number} value the number to store in the component
     * @param {string} name the name of the float component
     */
    constructor(value, name) {
        super(name, [Component.Modifier.SHADEABLE]);
        this.value = value;
    }

    /**
     * Set the value of this float component.
     * @param {number} property the float property to set.
     */
    set value(value) {
        if (!this.validValue(value)) {
            console.warn(`[FloatComponent] Expected 'value' to be a number (float). Unable to set value.`)
        } else {
            this.#value = value;
            this._isDirty = true;
        }
    }

    /**
     * Get the value of this float component.
     * @returns {number} the float associated with this material component 
     */
    get value() {
        return this.#value;
    }

    /**
     * Check if the provided value is valid for this material component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return typeof value === 'number';
    }

    /**
     * Clone this component.
     * @param {boolean} deepCopy since floats are primitives, their values are always 'cloned'.
     * @returns {FloatComponent} a new FloatComponent with the same value as this one.
     */
    clone(deepCopy = false) {
        return new FloatComponent(this.#value, this.name);
    }

    /**
     * Apply this material component to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     * @param {number} options.index the index to the glsl array of which this uniform is a value of. If this is not specified, it's assumed the uniform is not an array type.
     */
    applyToShader(shaderProgram, options={}) {
        const indexToken = typeof options.index === 'number' ? `[${options.index}]` : '';
        const parentToken = typeof options.parentName === 'string' && 
                            options.parentName.trim() !== '' ? 
                            `${options.parentName}.` : '';
        const uniformName = parentToken + this.name + indexToken;

        if (shaderProgram.supports(uniformName)) {
            // console.log(shaderProgram.name, uniformName, this.#value);
            shaderProgram.setUniform(uniformName, this.#value);
        }
    } 
}