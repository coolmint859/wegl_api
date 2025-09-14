import ShaderProgram from "../shading/shader-program.js";
import Color from "../utilities/containers/color.js";
import Component from "./component.js";

export default class ColorComponent extends Component {
    #color = new Color(0, 0, 0); // default is black

    /**
     * Create a new material color component
     * @param {Color} color the color to store in the component (default = black)
     * @param {string} name the name of the color component
     */
    constructor(color, name) {
        super(name);
        this.value = color;
    }

    /**
     * Set the value of this color component.
     * @param {Color} color the color value to set.
     */
    set value(color) {
        if (!this.validValue(color)) {
            console.warn(`[ColorComponent] Expected 'color' to be an instance of Color. Unable to set value.`)
        } else {
            this.#color = color;
            this._isDirty = true;
        }
    }

    /**
     * Get the value of this color component.
     * @returns {Color} a reference to the color instance associated with this color component 
     */
    get value() {
        return this.#color;
    }

    /**
     * Check if the provided value is valid for this material component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        return value instanceof Color;
    }

    /**
     * Clone this component.
     * @param {boolean} deepCopy if true, will clone the color of this component, otherwise only the component itself will be cloned.
     * @returns {ColorComponent} a new ColorComponent with the same value as this one.
     */
    clone(deepCopy = false) {
        const color = deepCopy ? this.#color.clone() : this.#color;
        return new ColorComponent(color, this.name);
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
            shaderProgram.setUniform(uniformName, this.#color);
        }
        this._isDirty = false;
    } 
}