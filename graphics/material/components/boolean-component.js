import MaterialComponent from "./material-component.js";

export default class BoolComponent extends MaterialComponent {
    #boolean = false;

    /**
     * Create a new material boolean component
     * @param {string} name the name of the integer component
     * @param {boolean} boolean the number to store in the component
     */
    constructor(name, boolean) {
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
     * Check if the provided value is valid for this material component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return typeof value === 'boolean';
    }

    /**
     * Apply this material's components to a shader program.
     * @param {Shader} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram) {
        if (!this._isDirty) return;
        shaderProgram.setUniform(this.name, this.#boolean);
        this._isDirty = false;
    } 
}