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
    _dispatcher;
    _components;
    _capabilities;
    _name;

    /**
     * Create a new Entity instance
     * @param {string} name the name of the entity
     */
    constructor(name) {
        this._id = Entity.#ID_COUNTER++;
        this._name = name;

        this._transform = new Transform();
        this._dispatcher = new EventDispatcher();
        this._components = new Map();
        this._capabilities = [];
    }

    /**
     * Get the ID of this entity
     */
    get ID() {
        return this._id;
    }

    /**
     * Get the name of this entity
     */
    get name() {
        return this._name;
    }

    /** Get the event dispatcher of this entity */
    get dispatcher() {
        return this._dispatcher;
    }

    /** Get the capabilities of this entity */
    get capabilities() {
        return this._capabilities;
    }

    /** Get the transform of this entity */
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
        return this.transform.position;
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
        this.transform.position = newPos;
    }

    /** Get the rotation of this entity */
    get rotation() {
        return this.transform.rotation;
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
        this.transform.rotation = newRot;
    }

    /** Get the dimensions of this entity */
    get dimensions() {
        return this.transform.rotation;
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

    /** Get the components of this entity as a map keyed by component name */
    get componentMap() {
        return this._components;
    }

    /** Get the components of this entity as a list */
    get componentList() {
        return this._components.values();
    }

    /**
     * Add a new component to this entity
     * @param {Component} component the new component to add
     */
    addComponent(component) {
        if (!(component instanceof Component)) {
            console.error(`[Entity @${this._name}] Expected 'component' to be an instance of Component. Cannot add component.`);
            return;
        }
        this.componentMap.set(component.name, component);
    }

    /**
     * Remove a component from this entity
     * @param {string} componentName the name of the component to remove
     */
    removeComponent(componentName) {
        if (typeof componentName !== 'string' || componentName.trim() === '') {
            console.error(`[Entity @${this._name}] Expected 'componentName' to be a non-empty string. Cannot remove component.`);
            return;
        }
        this.componentMap.delete(componentName);
    }

    /**
     * Check if a component exists on this entity
     * @param {string} componentName the name of the component
     * @returns {boolean} true if a component with the given name was found, false otherwise
     */
    contains(componentName) {
        return this._components.has(componentName);
    }

    /**
     * Get a specific component from this entity, if exists
     * @param {string} componentName the name of the component
     * @returns {Component || null } the component instance. If none are found, returns null
     */
    getComponent(componentName) {
        if (this._components.has(componentName)) {
            return this._components.get(componentName);
        }
        return null;
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
     */
    update(dt) {
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
        for (const [name, component] of this._components) {
            entityStr = entityStr.concat(`\tComponent @${name}: ${component.constructor.name}\n`);
        }
        return entityStr;
    }
}