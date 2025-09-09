import { Vector3 } from "../../utilities/math/vector.js";
import MaterialComponent from "./material-component.js";

export default class Vec3Component extends MaterialComponent {
    #vector = new Vector3();

    /**
     * Create a new material vector component
     * @param {string} name the name of the vector component
     * @param {Vector3} vector the vector to store in the component
     */
    constructor(name, vector) {
        super(name);
        this.value = vector;
    }

    /**
     * Set the value of this vector component.
     * @param {Vector3} vector the vector value to set.
     */
    set value(vector) {
        if (!this.validValue(vector)) {
            console.warn(`[Vector3Component] Expected 'vector' to be an instance of Vector3. Unable to set value.`)
        } else {
            this.#vector = vector;
            this._isDirty = true;
        }
    }

    /**
     * Get the property of this vector component.
     * @returns {Vector3} a reference to the vector instance associated with this component
     */
    get value() {
        return this.#vector;
    }

    /**
     * Check if the provided value is valid for this material component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return value instanceof Vector3;
    }

    /**
     * Create an exact copy of this vector component
     * @returns {Vec3Component} a new VectorComponent with the same properties as this one.
     */
    clone() {
        return new Vec3Component(this.name, this.#vector);
    }

    /**
     * Apply this material's components to a shader program.
     * @param {Shader} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram) {
        if (!this._isDirty) return;
        shaderProgram.setUniform(this.name, this.#vector);
        this._isDirty = false;
    }
}