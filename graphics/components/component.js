/**
 * A generic object used to be composed with or attached to other objects
 */
export default class Component {
    static Modifier = Object.freeze({
        SHADABLE: 'shadable',
        UPDATABLE: 'updatable',
        PHYSICAL: 'physical'
    })

    static #ID_COUNTER = 0;

    #name;
    #refCount;
    #ID;

    #modifiers;

    /**
     * generic object used for being composed into other objects
     * @param {string} name the name of the component
     */
    constructor(name, modifiers=[]) {
        this.#ID = Component.#ID_COUNTER++;
        this.#name = name;
        this.#modifiers = modifiers;
        this.#refCount = 0;
    }

    /**
     * Get the ID of this component
     */
    get ID() {
        return this.#ID;
    }

    /**
     * Get the name of this component
     */
    get name() {
        return this.#name;
    }

    /**
     * Set the name of this component
     */
    set name(newName) {
        this.#name = newName;
    }

    /** 
     * Get the amount of references on this component 
     */
    get refCount() {
        return this.#refCount;
    }

    /**
     * Get the modifiers associated with this component
     */
    get modifiers() {
        return this.#modifiers;
    }

    /**
     * Check if this component has a modifier
     * @param {string} modifier the modifier to check against.
     * @returns {boolean} true if this component has the modifier, false otherwise
     */
    hasModifier(modifier) {
        return this.#modifiers.includes(modifier);
    }

    /** 
     * Acquire this component for use 
     * @returns {Component} a reference to this component
     */
    acquire() {
        this.#refCount++;
        return this;
    }

    /**
     * Release this component from use
     */
    release() {
        this.#refCount--;
    }
    /** 
     * Create an exact copy of this component. This method should be overriden;
     */
    clone() {
        console.error(`[Component] This class is meant to be abstract. Instantiate a derived class to clone.`)
    }
}