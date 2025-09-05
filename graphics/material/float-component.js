import MaterialComponent from "./material-component.js";

export default class FloatComponent extends MaterialComponent {
    #value;

    /**
     * Create a new material float component
     * @param {string} name the name of the float component
     * @param {number} value the number to store in the component
     */
    constructor(name, value) {
        super(name);
        if (!this.validProperty(value)) {
            console.warn(`[FloatComponent] Expected 'value' to be a number (float). Setting default (1.0)`)
            this.#value = 1.0;
        } else {
            this.#value = value;
        }
    }

    /**
     * Set the property of this float component.
     * @param {number} property the float property to set.
     */
    set(property) {
        if (!this.validProperty(property)) {
            console.warn(`[FloatComponent] Expected 'property' to be a number (float). Unable to set property.`)
        } else {
            this.#value = property;
        }
    }

    /**
     * Get the property of this float component.
     * @param {number} property 
     */
    get() {
        return this.#value;
    }

    /**
     * Check if the provided property is valid for this material component
     * @param {any} property the property to check
     * @returns {boolean} true if the property is a valid type, false otherwise
     */
    validProperty(property) {
        return typeof property === 'number';
    }

    /**
     * Create an exact copy of this float component
     * @returns {FloatComponent} a new FloatComponent with the same properties as this one.
     */
    clone() {
        return new FloatComponent(this.name, this.#value);
    }
}