import ShaderProgram from "../../shading/shader2.js";

/** Abstract class representing components for a Material */
export default class MaterialComponent {
    static #ID_COUNTER = 0;

    #name;
    #refCount;
    #ID;
    _isDirty;

    /**
     * This class is meant to be abstract. Instantiate a derived type to use it with a Material instance.
     * @param {string} name the name of the material component.
     */
    constructor(name) {
        this.#name = name;
        this.#refCount = 0;
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
     * Retreive the number of references on this material component
     */
    get refCount() {
        return this.#refCount;
    }
     /**
     * Set the value of this material component. This method should be overriden.
     * @param {any} value 
     */
    set value(value) {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to set the component value.`);
    }

    /**
     * Get the value of this material component. This method should be overriden.
     * @returns {any} the value associated with this material component 
     */
    get value() {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to get the component value.`);
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
     * Clone this material component. This method should be overriden.
     * @returns {MaterialComponent} a new Material Component with the same properties as this one.
     */
    clone() {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to clone a component.`);
    }

    /**
     * Check if the provided property is valid for this material component. This method should be overriden.
     * @param {any} property the property to check
     * @returns {boolean} true if the property is a valid type, false otherwise
     */
    validProperty(property) {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to validate component values.`);
    }

    /**
     * Apply this material component to a shader program. This method should be overidden.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {string} parentName the name of this component's parent container, default is an empty string
     * @returns {boolean} true if the component was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram, parentName = "") {
        throw new Error(`[MaterialComponent] This is an abstract class. Use a derived class to apply components to shaders.`);
    }
}