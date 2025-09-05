import MaterialComponent from "./material-component.js";

export default class BooleanComponent extends MaterialComponent {
    #boolean;

    /**
     * Create a new material boolean component
     * @param {string} name the name of the integer component
     * @param {boolean} boolean the number to store in the component
     */
    constructor(name, boolean) {
        super(name);
        if (!this.validProperty(boolean)) {
            console.warn(`[BooleanComponent] Expected 'boolean' to be a boolean value. Setting default (false)`)
            this.#boolean = false;
        } else {
            this.#boolean = boolean;
        }
    }

    /**
     * Set the property of this boolean component.
     * @param {number} property the boolean property to set.
     */
    set(property) {
        if (!this.validProperty(property)) {
            console.warn(`[BooleanComponent] Expected 'property' to be a boolean. Unable to set property.`)
        } else {
            this.#boolean = property;
        }
    }

    /**
     * Get the property of this boolean component.
     * @param {number} property 
     */
    get() {
        return this.#boolean;
    }

    /**
     * Check if the provided property is valid for this material component
     * @param {any} property the property to check
     * @returns {boolean} true if the property is a valid type, false otherwise
     */
    validProperty(property) {
        return typeof property === 'boolean';
    }
}