import ShaderProgram from "../../shading/shader2.js";
import Color from "../../utilities/containers/color.js";
import MaterialComponent from "./material-component.js";

export default class ColorComponent extends MaterialComponent {
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
     * Create an exact copy of this color component
     * @returns {ColorComponent} a new ColorComponent with the same properties as this one.
     */
    clone() {
        return new ColorComponent(this.name, this.#color);
    }

    /**
     * Apply this material's components to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the material to. Should already be in use.
     * @param {string} parentName the name of this component's parent container, default is an empty string
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram, parentName) {
        if (!this._isDirty) return;
        shaderProgram.setUniform(parentName + this.name, this.#color);
        this._isDirty = false;
    } 
}