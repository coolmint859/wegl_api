import ShaderProgram from "../../shading/shader2.js";
import MaterialComponent from "./material-component.js";

export default class BoolComponent extends MaterialComponent {
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
     * Check if the provided value is valid for this material component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return typeof value === 'boolean';
    }

    /**
     * Apply this material's components to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the material to. Should already be in use.
     * @param {string} parentName the name of this component's parent container, default is an empty string
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram, parentName = "") {
        if (!this._isDirty) return;
        shaderProgram.setUniform(parentName + this.name, this.#boolean);
        this._isDirty = false;
    } 
}