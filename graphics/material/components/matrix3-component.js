import { Matrix3 } from "../../utilities/math/matrix.js";
import MaterialComponent from "./material-component.js";

export default class Mat3Component extends MaterialComponent {
    #matrix = new Matrix3();

    /**
     * Create a new material matrix component
     * @param {string} name the name of the matrix component
     * @param {Matrix3} matrix the matrix to store in the component
     */
    constructor(name, matrix) {
        super(name);
        this.value = matrix;
    }

    /**
     * Set the value of this matrix component.
     * @param {Matrix3} matrix the matrix value to set.
     */
    set value(matrix) {
        if (!this.validValue(matrix)) {
            console.warn(`[Matrix3Component] Expected 'value' to be an instance of Matrix3. Unable to set value.`)
        } else {
            this.#matrix = matrix;
            this._isDirty = true;
        }
    }

    /**
     * Get the value of this matrix component.
     * @returns {Matrix3} a reference to the matrix instance associated with this component
     */
    get value() {
        return this.#matrix;
    }

    /**
     * Check if the provided value is valid for this material component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return value instanceof Matrix3;
    }

    /**
     * Create an exact copy of this matrix component
     * @returns {Mat3Component} a new MatrixComponent with the same properties as this one.
     */
    clone() {
        return new Mat3Component(this.name, this.#matrix);
    }

    /**
     * Apply this material's components to a shader program.
     * @param {Shader} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram) {
        if (!this._isDirty) return;
        shaderProgram.setUniform(this.name, this.#matrix);
        this._isDirty = false;
    }
}