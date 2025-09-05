import { Matrix2, Matrix3, Matrix4 } from "../../utilities/math/matrix.js";
import MaterialComponent from "./material-component.js";

export default class MatrixComponent extends MaterialComponent {
    #matrix;

    /**
     * Create a new material matrix component
     * @param {string} name the name of the matrix component
     * @param {Matrix2 | Matrix3 | Matrix4} matrix the matrix to store in the component
     */
    constructor(name, matrix) {
        super(name);
        if (!this.validProperty(value)) {
            console.warn(`[MatrixComponent] Expected 'matrix' to be an instance of Matrix2, Matrix3 or Matrix4. Setting default (matrix3.indentity())`)
            this.#matrix = new Matrix3();
        } else {
            this.#matrix = matrix;
        }
    }

    /**
     * Set the property of this matrix component.
     * @param {Matrix2 | Matrix3 | Matrix4} property the matrix property to set.
     */
    set(property) {
        if (!this.validProperty(property)) {
            console.warn(`[MatrixComponent] Expected 'property' to be an instance of Matrix2, Matrix3 or Matrix4. Unable to set property.`)
        } else {
            this.#matrix = property;
        }
    }

    /**
     * Get the property of this matrix component.
     * @param {Matrix2 | Matrix3 | Matrix4} property 
     */
    get() {
        return this.#matrix;
    }

    /**
     * Check if the provided property is valid for this material component
     * @param {any} property the property to check
     * @returns {boolean} true if the property is a valid type, false otherwise
     */
    validProperty(property) {
        const isMatrix2 = property instanceof Matrix2;
        const isMatrix3 = property instanceof Matrix3;
        const isMatrix4 = property instanceof Matrix4;
        return isMatrix2 || isMatrix3 || isMatrix4;
    }

    /**
     * Create an exact copy of this matrix component
     * @returns {MatrixComponent} a new MatrixComponent with the same properties as this one.
     */
    clone() {
        return new MatrixComponent(this.name, this.#matrix);
    }
}