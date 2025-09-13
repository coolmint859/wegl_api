import ShaderProgram from "../../shading/shader2.js";
import MaterialComponent from "./material-component.js";

export default class IntComponent extends MaterialComponent {
    #value = 1;

    /**
     * Create a new material integer component
     * @param {number} value the number to store in the component
     * @param {string} name the name of the integer component
     */
    constructor(value, name) {
        super(name);
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
     * Create an exact copy of this integer component
     * @returns {IntComponent} a new IntComponent with the same properties as this one.
     */
    clone() {
        return new IntComponent(this.name, this.#value);
    }

    /**
     * Apply this material's components to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the material to. Should already be in use.
     * @param {string} parentName the name of this component's parent container, default is an empty string
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram, parentName = "") {
        if (!this._isDirty) return;
        shaderProgram.setUniform(parentName + this.name, this.#value);
        this._isDirty = false;
    }
}