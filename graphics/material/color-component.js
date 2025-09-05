import Color from "../../utilities/containers/color.js";
import MaterialComponent from "./material-component.js";

export default class ColorComponent extends MaterialComponent {
    #color;

    /**
     * Create a new material color component
     * @param {string} name the name of the color component
     * @param {Color} color the color to store in the component
     */
    constructor(name, color) {
        super(name);
        if (!this.validProperty(color)) {
            console.warn(`[ColorComponent] Expected 'color' to be an instance of Color. Setting default (Color.WHITE)`)
            this.#color = Color.WHITE;
        } else {
            this.#color = color;
        }
    }

    /**
     * Set the property of this color component.
     * @param {Color} property the color property to set.
     */
    set(property) {
        if (!this.validProperty(property)) {
            console.warn(`[ColorComponent] Expected 'property' to be an instance of Color. Unable to set property.`)
        } else {
            this.#color = property;
        }
    }

    /**
     * Get the property of this color component.
     * @param {Color} property 
     */
    get() {
        return this.#color;
    }

    /**
     * Check if the provided property is valid for this material component
     * @param {any} property the property to check
     * @returns {boolean} true if the property is a valid type, false otherwise
     */
    validProperty(property) {
        return property instanceof Color;
    }

    /**
     * Create an exact copy of this color component
     * @returns {ColorComponent} a new ColorComponent with the same properties as this one.
     */
    clone() {
        return new ColorComponent(this.name, this.#color);
    }
}