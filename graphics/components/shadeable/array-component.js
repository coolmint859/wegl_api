import Component from '../component.js';
import PrimComponent from './prim-component.js';

/**
 * Represents an array of primitive uniform data.
 */
export default class ArrayComponent extends Component {
    #data;

    /**
     * Represents an array of primitive uniform data.
     * @param {string} name the name of the component (used for shading)
     * @param {Array} data the array of data to save.
     */
    constructor(name, data) {
        super(name, [Component.Modifier.SHADABLE]);
        if (!this.isValid(data)) {
            console.error(`[ArrayComponent] Expected 'data' to be an array of primitives. Assigning empty array as default.`);
            data = [];
        }
        this.#data = data;
    }

    /**
     * Set the data array of this array component.
     * @param {Array<any>} data the data array to set.
     */
    set data(data) {
        if (!this.isValid(data)) {
            console.error(`[ArrayComponent] Expected 'data' to be an array of primitives. Unable to set data.`);
            return;
        }
        this.#data = data;
    }

    /**
     * Get the list of data stored in this array component
     */
    get data() {
        return [...this.#data]; // send a copy
    }

    /**
     * Get the length of the array data in this array component
     */
    get length() {
        return this.#data.length;
    }

    /**
     * Get the value stored at the provided index.
     * @param {number} index the index into the array of data stored
     * @returns {any} the value stored at the index.
     */
    valueAt(index) {
        if (typeof index !== 'number' || index < 0 || index >= this.#data.length) {
            console.error(`[ArrayComponent] Expected 'index' to be a number between 0 and ${this.#data.length}. Cannot get value.`);
            return null;
        }
        return this.#data[index];
    }

    setValue(index, value) {
        if (typeof index !== 'number' || index < 0 || index >= this.#data.length) {
            console.error(`[ArrayComponent] Expected 'index' to be a number between 0 and ${this.#data.length}. Cannot set value.`);
            return;
        }
        this.#data[index] = value;
    }

    /**
     * Check if the provided value is valid for this component
     * @param {any} data the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    isValid(data) {
        const isArray = Array.isArray(data);
        const isValidValues = data.every(element => PrimComponent.isValid(element))

        return isArray && isValidValues;
    }

    /**
     * Clone this array component.
     * @returns {ArrayComponent} a new ArrayComponent with the same data as this one copied over.
     */
    clone() {
        return new ArrayComponent([...this.#data], this.name);
    }

    /**
     * Apply this array component to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     */
    applyToShader(shaderProgram, options={}) {
        for (let i = 0; i < this.length; i++) {
            const parentNameExists = typeof options.parentName === 'string' && options.parentName.trim() !== '';
            const uniformName = parentNameExists ? `${options.parentName}[${i}].${this.name}` : `${this.name}[${i}]`;

            if (shaderProgram.supports(uniformName)) {
                shaderProgram.setUniform(uniformName, this.#data[i]);
            }
        }
    }
}