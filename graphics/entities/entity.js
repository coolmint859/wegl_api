import { Component, Transform } from "../components/index.js";
import { ShaderProgram } from "../systems/index.js";
import { EventDispatcher, Quaternion, Vector3 } from "../utilities/index.js";

/**
 * Represents an object in a scene.
 */
export default class Entity {
    static #ID_COUNTER = 0;

    _id;
    _transform;
    _componentsByClass;
    _componentsByModifier;
    _capabilities;
    _name;

    /**
     * Create a new Entity instance
     * @param {string} name the name of the entity
     */
    constructor(name) {
        this._id = Entity.#ID_COUNTER++;
        this._name = name;

        this._transform = new Transform().acquire();
        this._componentsByClass = new Map();
        this._componentsByModifier = new Map();
        this._capabilities = [];

        this.addComponent(this._transform);
    }

    /**
     * Get the ID of this entity
     */ß
    get ID() {
        return this._id;
    }

    /**
     * Get the name of this entity
     */
    get name() {
        return this._name;
    }

    /** 
     * Get the capabilities of this entity 
     */
    get capabilities() {
        return this._capabilities;
    }

    /** 
     * Get the transform of this entity 
     */
    get transform() {
        return this._transform;
    }

    /**
     * Set the transform of this entity
     * @param {Transform} newTransform the new transform
     */
    set transform(newTransform) {
        if (!(newTransform instanceof Transform)) {
            console.error(`[Entity @${this._name}] Expected 'newTransform' to be an instance of Transform. Cannot set transform.`);
            return;
        }
        this._transform = newTransform;
    }

    /** Get the position of this entity */
    get position() {
        return this._transform.position;
    }

    /**
     * Set the position of this entity
     * @param {Vector3} newPos the new position
     */
    set position(newPos) {
        if (!(newPos instanceof Vector3)) {
            console.error(`[Entity @${this._name}] Expected 'newPos' to be an instance of Vector3. Cannot set position.`);
            return;
        }
        this._transform.position = newPos;
    }

    /** 
     * Get the rotation of this entity 
     * */
    get rotation() {
        return this._transform.rotation;
    }

    /**
     * Set the rotation of this entity
     * @param {Quaternion} newRot the new rotation
     */
    set rotation(newRot) {
        if (!(newRot instanceof Quaternion)) {
            console.error(`[Entity @${this._name}] Expected 'newRot' to be an instance of Quaternion. Cannot set rotation.`);
            return;
        }
        this._transform.rotation = newRot;
    }

    /** Get the dimensions of this entity */
    get dimensions() {
        return this._transform.dimensions;
    }

    /**
     * Set the dimensions of this entity
     * @param {Vector3} newDimen the new dimensions
     */
    set dimensions(newDimen) {
        if (!(newDimen instanceof Vector3)) {
            console.error(`[Entity @${this._name}] Expected 'newDimen' to be an instance of Vector3. Cannot set dimensions.`);
            return;
        }
        this.transform.dimensions = newDimen;
    }

    /** 
     * Get the components of this entity as a map keyed by component name
     */
    get componentMap() {
        return this._componentsByClass;
    }

    /** 
     * Get the components of this entity as a list 
     */
    get componentList() {
        return this._componentsByClass.values();
    }

    /**
     * Add a new component to this entity
     * @param {Component} component the new component to add
     * @returns {boolean} true if the component was added, false otherwise
     */
    addComponent(component) {
        if (!(component instanceof Component)) {
            console.error(`[Entity @${this._name}] Expected 'component' to be an instance of Component. Cannot add component.`);
            return false;
        }
        const compClass = component.constructor.name;
        if (this._componentsByClass.has(compClass)) {
            console.error(`[Entity] Cannot add the same component more than once.`);
            return false;
        }

        for (const mod of component.modifiers) {
            if (!this._componentsByModifier.has(mod)) {
                this._componentsByModifier.set(mod, new Set());
            }
            this._componentsByModifier.get(mod).add(compClass);
        }
        this._componentsByClass.set(component.constructor.name, component.acquire());
        return true;
    }

    /**
     * Remove a component from this entity
     * @param {string} componentClass the class of the component to remove
     */
    removeComponent(componentClass) {
        if (typeof componentClass !== 'string' || componentClass.trim() === '') {
            console.error(`[Entity @${this._name}] Expected 'componentClass' to be a non-empty string. Cannot remove component.`);
            return;
        }
        this.componentMap.delete(componentClass);

        const modifierMap = new Map(this._componentsByModifier);
        for (const [mod, compSet] of modifierMap) {
            if (compSet.has(componentClass)) {
                compSet.delete(componentClass);
            }

            if (compSet.size === 0) {
                this._componentsByModifier.delete(mod);
            }
        }
    }

    /**
     * Check if a component exists on this entity
     * @param {string} componentClass the name of the component
     * @returns {boolean} true if a component with the given name was found, false otherwise
     */
    contains(componentClass) {
        return this._componentsByClass.has(componentClass);
    }

    /**
     * Check if this entity has a component with the given modifier
     * @param {string} modifier the modifier to check against
     * @returns {boolean} true if this entity has a component with the modifier, false otherwise.
     */
    hasComponentModifier(modifier) {
        return this._componentsByModifier.has(modifier);
    }

    /**
     * Get a specific component from this entity, if exists
     * @param {string} componentClass the name of the component
     * @returns {Component | null } the component instance. If none are found, returns null
     */
    getComponent(componentClass) {
        if (this._componentsByClass.has(componentClass)) {
            return this._componentsByClass.get(componentClass);
        }
        return null;
    }

    /**
     * Get all components with the specified modifier
     * @param {string} modifier the modifier of the component
     * @returns {Array<Component>} an array of components with the specified modifier
     */
    getComponentsWithModifier(modifier) {
        const compMods = []
        if (this._componentsByModifier.has(modifier)) {
            const modClasses = Array.from(this._componentsByModifier.get(modifier));
            for (const className of modClasses) {
                compMods.push(this._componentsByClass.get(className))
            }
        }
        return compMods;
    }

    /**
     * Apply this entity to a shader. This method should be overwritten.
     * @param {ShaderProgram} shaderProgram 
     */
    applyToShader(shaderProgram) {
        console.error(`[Entity @${this._name}] This class is meant to be abstract. Instantiate a derived class to apply this to a shader.`);
    }

    /**
     * Update this entity. This method should be overwritten.
     * @param {number} dt the elapsed time in seconds since the last update
     * @param {number} totalTime the total amount of time since the start of the update loop
     */
    update(dt, totalTime) {
        console.error(`[Entity @${this._name}] This class is meant to be abstract. Instantiate a derived class to update this entity.`);
    }

    /**
     * Create a copy of this entity
     * @returns {Entity} a new entity instance with the same components as this one.
     */
    clone() {
        const newEntity = new Entity(this.name);
        for (const component of this.componentList) {
            newEntity.addComponent(component.clone());
        }
        return newEntity;
    }

    /**
     * Get a string representation of this entity
     * @returns {String} A string representation of this entity
     */
    toString() {
        let entityStr = `Entity @${this._name} #${this._id}:\n`;
        for (const [name, component] of this._componentsByClass) {
            entityStr = entityStr.concat(`\tComponent @${name}: ${component.constructor.name}\n`);
        }
        return entityStr;
    }
}