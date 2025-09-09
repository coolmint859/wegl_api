import Color from "../../utilities/containers/color.js";
import MaterialComponent from "./material-component.js";

export default class ColorComponent extends MaterialComponent {
    #color = new Color(0, 0, 0); // default is black

    /**
     * Create a new material color component
     * @param {string} name the name of the color component
     * @param {Color} color the color to store in the component (default = black)
     */
    constructor(name, color) {
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
     * @param {Shader} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram) {
        if (!this._isDirty) return;
        shaderProgram.setUniform(this.name, this.#color);
        this._isDirty = false;
    } 
}