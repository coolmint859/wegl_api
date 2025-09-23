import { ShaderProgram } from "../../shading/index.js";
import { Quaternion } from "../../utilities/index.js";
import Component from "../component.js";

export default class QuatComponent extends Component {
    #quaternion = new Quaternion();

    /**
     * Create a new material quaternion component
     * @param {Quaternion} vector the quaternion to store in the component
     * @param {string} name the name of the quaternion component
     */
    constructor(quaternion, name) {
        super(name, [Component.Modifier.SHADEABLE]);
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
     * Clone this component.
     * @param {boolean} deepCopy if true, will clone the quaternion of this component, otherwise only the component itself will be cloned.
     * @returns {QuatComponent} a new QuatComponent with the same value as this one.
     */
    clone(deepCopy = false) {
        const quaternion = deepCopy ? this.#quaternion.clone() : this.#quaternion;
        return new QuatComponent(quaternion, this.name);
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
            shaderProgram.setUniform(uniformName, this.#quaternion);
        }
    }
}