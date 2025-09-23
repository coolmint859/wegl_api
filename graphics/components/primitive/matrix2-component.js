import { ShaderProgram } from "../../shading/index.js";
import { Matrix2 } from "../../utilities/index.js";
import Component from "../component.js";

export default class Mat2Component extends Component {
    #matrix = new Matrix2();

    /**
     * Create a new material matrix component
     * @param {Matrix2} matrix the matrix to store in the component
     * @param {string} name the name of the matrix component
     */
    constructor(matrix, name) {
        super(name, [Component.Modifier.SHADEABLE]);
        this.value = matrix;
    }

    /**
     * Set the value of this matrix component.
     * @param {Matrix2} matrix the matrix value to set.
     */
    set value(matrix) {
        if (!this.validValue(matrix)) {
            console.warn(`[Matrix2Component] Expected 'matrix' to be an instance of Matrix2. Unable to set value.`)
        } else {
            this.#matrix = matrix;
            this._isDirty = true;
        }
    }

    /**
     * Get the value of this matrix component.
     * @returns {Matrix2} a reference to the matrix instance associated with this component
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
        return value instanceof Matrix2;
    }

    /**
     * Clone this component.
     * @param {boolean} deepCopy if true, will clone the matrix of this component, otherwise only the component itself will be cloned.
     * @returns {Mat2Component} a new Mat2Component with the same value as this one.
     */
    clone(deepCopy = false) {
        const matrix = deepCopy ? this.#matrix.clone() : this.#matrix;
        return new Mat2Component(matrix, this.name);
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
            shaderProgram.setUniform(uniformName, this.#matrix);
        }
    }
}