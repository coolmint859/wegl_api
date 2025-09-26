/** Abstract class representing components */
export default class Component {
    static #ID_COUNTER = 0;

    static Modifier = Object.freeze({
        SHADEABLE: 'shadeable',
        UPDATABLE: 'updatable'
    })

    #name;
    #refCount;
    #ID;

    _parent;
    _modifiers;

    /**
     * This class is meant to be abstract. Instantiate a derived type to use it.
     * @param {string} name the name of the component.
     */
    constructor(name, modifiers=[]) {
        this.#ID = Component.#ID_COUNTER++;
        this.#name = name;
        this.#refCount = 0;
        this._modifiers = modifiers;
    }

    /**
     * Get this component's id.
     */
    get ID() {
        return this.#ID;
    }

    /**
     * Get the name of this component
     * @returns {string} the name of the component
     */
    get name() {
        return this.#name;
    }

    /**
     * Set the name of this component
     * @param newName the new name of the component
     */
    set name(newName) {
        this.#name = newName;
    }

    /**
     * Retreive the number of references on this component
     */
    get refCount() {
        return this.#refCount;
    }
    
     /**
     * Set the value of this component. This method should be overriden.
     * @param {any} value 
     */
    set value(value) {
        throw new Error(`[Component] This is an abstract class. Use a derived class to set the component value.`);
    }

    /**
     * Get the value of this component. This method should be overriden.
     * @returns {any} the value associated with this component 
     */
    get value() {
        throw new Error(`[Component] This is an abstract class. Use a derived class to get the component value.`);
    }

    /**
     * Set the parent container for this component
     * @param {any} parent the parent object.
     */
    set parentContainer(parent) {
        this._parent = parent;
    }

    /**
     * Get the parent container for this component
     * @param {any} parent the parent object.
     */
    get parentContainer() {
        return this._parent
    }

    /**
     * Check if this component has an modifier and therefore is capable of that modifier's behavior
     * @param {Component.Modifier} modifier the modifier type to check for
     * @returns {boolean} true if the component has the modifier, false otherwise
     */
    hasModifier(modifier) {
        return this._modifiers.includes(modifier);
    }

    /**
     * Get a list of the supporting modifiers of this component
     * @returns {Array<string>} a list of modifiers of this component
     */
    getModifiers() {
        return this._modifiers;
    }

    /**
     * Acquire this component for use.
     * @returns {Component} a reference to this component
     */
    acquire() {
        this.#refCount++;
        return this;
    }

    /**
     * Release this component from use.
     */
    release() {
        this.#refCount--;
    }

    /**
     * Clone this component. This method should be overriden.
     * @param {boolean} deepCopy if true, will duplicated the data stored in the original component. Does not apply to textures.
     * @returns {Component} a new Component with the same value as this one.
     */
    clone(deepCopy=false) {
        throw new Error(`[Component] This is an abstract class. Use a derived class to clone a component.`);
    }

    /**
     * Check if the provided value is valid for this component. This method should be overriden.
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    static validValue(value) {
        throw new Error(`[Component] This is an abstract class. Use a derived class to validate component values.`);
    }
}