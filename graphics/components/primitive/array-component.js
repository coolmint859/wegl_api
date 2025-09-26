import Component from '../component.js';

/**
 * Represents an array of primitive uniform data.
 */
export default class ArrayComponent extends Component {
    #data = [];

    /**
     * Create a new data array component
     * @param {Array<any>} data the array of data to send to the shader.
     * @param {string} name the name of the data
     */
    constructor(data, name) {
        super(name, [Component.Modifier.SHADEABLE]);
        this.value = data;
    }

    /**
     * Set the data array of this array component.
     * @param {boolean} data the data array to set.
     */
    set value(data) {
        if (!this.validValue(data)) {
            console.warn(`[ArrayComponent] Expected 'data' to be an array of primitives. Unable to set value.`)
        } else {
            this.#data = data;
            this._isDirty = true;
        }
    }

    /**
     * Get the value of this boolean component.
     * @returns {boolean} the boolean associated with this material component 
     */
    get value() {
        return this.#data;
    }

    /**
     * Get the length of the array data in this array component
     */
    get length() {
        return this.#data.length;
    }

    /**
     * Check if the provided value is valid for this component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return Array.isArray(value);
    }

    /**
     * Clone this component.
     * @param {boolean} deepCopy since booleans are primitives, their values are always 'cloned'.
     * @returns {BoolComponent} a new BoolComponent with the same value as this one.
     */
    clone(deepCopy = false) {
        const data = deepCopy ? [...this.#data] : this.#data;
        return new ArrayComponent(data, this.name);
    }

    /**
     * Apply this array component to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     */
    applyToShader(shaderProgram, options={}) {
        for (let i = 0; i < this.#data.length; i++) {
            let uniformName;
            if (typeof options.parentName === 'string' && options.parentName.trim() !== '') {
                uniformName = options.parentName + `[${i}].` + this.name;
            } else {
                uniformName = this.name + `[${i}]`;
            }

            // console.log(uniformName, this.#data[i]);

            if (shaderProgram.supports(uniformName)) {
                shaderProgram.setUniform(uniformName, this.#data[i]);
            }
        }
    }
}