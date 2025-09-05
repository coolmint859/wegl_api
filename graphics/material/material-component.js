/** Abstract class representing components for a Material */
export default class MaterialComponent {
    static #ID_COUNTER = 0;

    #name;
    #refCount;
    #ID;

    /**
     * This class is meant to be abstract. Instantiate a derived type to use it with a Material instance.
     * @param {string} name the name of the material component.
     */
    constructor(name) {
        this.#name = name;
        this.#ID = MaterialComponent.#ID_COUNTER++;
    }

    /**
     * Get this material component's id.
     */
    get ID() {
        return this.#ID;
    }

    /**
     * Get the name of this material component
     * @returns {string} the name of the material component
     */
    get name() {
        return this.#name;
    }

    /**
     * Set the name of this material component
     * @param newName the new name of the material component
     */
    set name(newName) {
        this.#name = newName;
    }

    /**
     * Acquire this material component for use.
     * @returns {MaterialComponent} a reference to this material component
     */
    acquire() {
        this.#refCount++;
        return this;
    }

    /**
     * Release this material component from use.
     */
    release() {
        this.#refCount--;
    }

    /**
     * Check if this material component is currently referenced by a material.
     * @returns {boolean} true if this component has at least one reference, false otherwise
     */
    isReferenced() {
        return this.#refCount > 0;
    }

    /**
     * Clone this material component
     * @returns {MaterialComponent} a new Material Component with the same properties as this one.
     */
    clone() {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to clone a component.`);
    }

    /**
     * Set the property of this material component.
     * @param {any} property 
     */
    set(property) {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to set the component property.`);
    }

    /**
     * Get the property of this material component.
     * @param {any} property 
     */
    get() {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to get the component property.`);
    }

    /**
     * Check if the provided property is valid for this material component
     * @param {any} property the property to check
     * @returns {boolean} true if the property is a valid type, false otherwise
     */
    validProperty(property) {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to validate properties.`);
    }
}