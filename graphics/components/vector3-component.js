import ShaderProgram from "../shading/shader-program.js";
import { Vector3 } from "../utilities/math/vector.js";
import Component from "./component.js";

export default class Vec3Component extends Component {
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
     * Clone this component.
     * @param {boolean} deepCopy if true, will clone the matrix of this component, otherwise only the component itself will be cloned.
     * @returns {Vec3Component} a new Vec3Component with the same value as this one.
     */
    clone(deepCopy = false) {
        const vector = deepCopy ? this.#vector.clone() : this.#vector;
        return new Vec3Component(vector, this.name);
    }

    /**
     * Apply this material component to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     * @param {number} options.index the index to the glsl array of which this uniform is a value of. If this is not specified, it's assumed the uniform is not an array type.
     */
    applyToShader(shaderProgram, options={}) {
        if (!this._isDirty) return;

        const indexToken = typeof options.index === 'number' ? `[${options.index}]` : '';
        const parentToken = typeof options.parentName === 'string' ? options.parentName : '';
        const uniformName = parentToken + this.name + indexToken;

        if (shaderProgram.supports(uniformName)) {
            shaderProgram.setUniform(uniformName, this.#vector);
        }
        this._isDirty = false;
    }
}