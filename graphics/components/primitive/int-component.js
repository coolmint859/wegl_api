import { ShaderProgram } from "../../shading/index.js";
import Component from "../component.js";

export default class IntComponent extends Component {
    #value = 1;

    /**
     * Create a new material integer component
     * @param {number} value the number to store in the component
     * @param {string} name the name of the integer component
     */
    constructor(value, name) {
        super(name, [Component.Modifier.SHADEABLE]);
        this.value = value;
    }

    /**
     * Set the value of this int component.
     * @param {number} value the int value to set.
     */
    set value(value) {
        if (!this.validValue(value)) {
            console.warn(`[IntComponent] Expected 'value' to be a number (integer). Unable to set value.`)
        } else {
            this.#value = value;
            this._isDirty = true;
        }
    }

    /**
     * Get the value of this int component.
     * @returns {number} the integer associated with this material component 
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
     * @param {boolean} deepCopy since integers are primitives, their values are always 'cloned'.
     * @returns {IntComponent} a new IntComponent with the same value as this one.
     */
    clone(deepCopy = false) {
        return new IntComponent(this.#value, this.name);
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
            shaderProgram.setUniform(uniformName, this.#value);
        }
    }
}