import MaterialComponent from "./material-component.js";

export default class IntComponent extends MaterialComponent {
    #value;

    /**
     * Create a new material integer component
     * @param {string} name the name of the integer component
     * @param {number} value the number to store in the component
     */
    constructor(name, value) {
        super(name);
        if (!this.validProperty(value)) {
            console.warn(`[IntComponent] Expected 'value' to be a number (integer). Setting default (1)`)
            this.#value = 1;
        } else {
            this.#value = value;
        }
    }

    /**
     * Set the property of this int component.
     * @param {number} property the int property to set.
     */
    set(property) {
        if (!this.validProperty(property)) {
            console.warn(`[IntComponent] Expected 'property' to be a number (integer). Unable to set property.`)
        } else {
            this.#value = property;
        }
    }

    /**
     * Get the property of this int component.
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
     * Create an exact copy of this integer component
     * @returns {IntComponent} a new IntComponent with the same properties as this one.
     */
    clone() {
        return new IntComponent(this.name, this.#value);
    }
}