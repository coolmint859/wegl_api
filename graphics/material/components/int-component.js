import MaterialComponent from "./material-component.js";

export default class IntComponent extends MaterialComponent {
    #value = 1;

    /**
     * Create a new material integer component
     * @param {string} name the name of the integer component
     * @param {number} value the number to store in the component
     */
    constructor(name, value) {
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
     * @param {Shader} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram) {
        if (!this._isDirty) return;
        shaderProgram.setUniform(this.name, this.#value);
        this._isDirty = false;
    }
}