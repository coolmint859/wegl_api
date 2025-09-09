import Quaternion from "../../utilities/math/quaternion.js";
import MaterialComponent from "./material-component.js";

export default class QuatComponent extends MaterialComponent {
    #quaternion = new Quaternion();

    /**
     * Create a new material quaternion component
     * @param {string} name the name of the quaternion component
     * @param {Quaternion} vector the quaternion to store in the component
     */
    constructor(name, quaternion) {
        super(name);
        this.value = quaternion;
    }

    /**
     * Set the value of this quaternion component.
     * @param {Quaternion} quaternion the quaternion value to set.
     */
    set value(quaternion) {
        if (!this.validValue(quaternion)) {
            console.warn(`[QuaternionComponent] Expected 'quaternion' to be an instance of Quaternion. Unable to set value.`)
        } else {
            this.#quaternion = quaternion;
            this._isDirty = true;
        }
    }

    /**
     * Get the value of this quaternion component.
     * @returns {Quaternion} a reference to the quaternion instance associated with this component
     */
    get value() {
        return this.#quaternion;
    }

    /**
     * Check if the provided value is valid for this material component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return value instanceof Quaternion;
    }

    /**
     * Create an exact copy of this quaternion component
     * @returns {QuatComponent} a new QuaternionComponent with the same properties as this one.
     */
    clone() {
        return new QuatComponent(this.name, this.#quaternion.clone());
    }

    /**
     * Apply this material's components to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the component was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram) {
        if (!this._isDirty) return;
        shaderProgram.setUniform(this.name, this.#quaternion);
        this._isDirty = false;
    }
}