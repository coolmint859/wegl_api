import Color from "../utilities/containers/color.js";
import EventScheduler from "../utilities/scheduler.js";
import ShaderProgram from "../shading/shader2.js";
import ColorComponent from "./components/color-component.js";
import MaterialComponent from "./components/material-component.js";

export default class Material {
    static #ID_COUNTER = 0;
    static #defaultColorName = 'baseColor';
    static #defaultColor = new ColorComponent(Material.#defaultColorName, Color.WHITE);

    #refCount;
    #components;
    #materialID;

    constructor(components=[]) {
        this.#refCount = 0;
        this.#materialID = Material.#ID_COUNTER++;

        this.#components = new Map();
        components.forEach(comp => this.addComponent(comp));
    }

    /**
     * Retreive the ID of this material
     */
    get ID() {
        return this.#materialID;
    }

    /**
     * Retreive the number of references on this material.
     */
    get refCount() {
        return this.#refCount;
    }

    /**
     * Add a new material component to this material
     * @param {MaterialComponent} component the new component
     */
    addComponent(component) {
        if (!(component instanceof MaterialComponent)) {
            console.error(`[Material @ID${this.#materialID}] Expected '${component}' to be an instance of MaterialComponent. Cannot add to Material.`);
            return;
        }
        this.#components.set(component.name, component.acquire());
    }

    /**
     * Remove a component from this material
     * @param {string} name the name of the component
     * @returns {boolean} true if the material was successfully removed, false otherwise
     */
    removeComponent(name) {
        if (typeof name !== 'string') {
            console.error(`[Material @ID${this.#materialID}] Expected 'name' to be a string. Cannot remove material component from Material.`);
            return false;
        }
        return this.#components.delete(name);
    }

    /**
     * Get a component attached to this material
     * @param {string} name the name of the component
     * @returns {MaterialComponent | null} the material component instance. If not found, null is returned.
     */
    getComponent(name) {
        if (typeof name !== 'string') {
            console.error(`[Material @ID${this.#materialID}] Expected 'name' to be a string. Cannot retreive material component from Material.`);
            return null;
        }
        return this.#components.get(name);
    }

    /**
     * Check if this material has a component attached
     * @param {string} name the name of the component
     * @returns true if this material has a component by the given name, false otherwise
     */
    hasComponent(name) {
        if (typeof name !== 'string') {
            console.error(`[Material @ID${this.#materialID}] Expected 'name' to be a string. Cannot check for material component in Material.`);
            return false;
        }
        return this.#components.has(name);
    }

    /**
     * acquire this material for use.
     * @returns {Material} a reference to this material
     */
    acquire() {
        this.#refCount++;
        return this;
    }

    /**
     * Release this material for use.
     */
    release() {
        this.#refCount--;
        if (this.#refCount === 0) {
            EventScheduler.schedule('component-release', 1, () => {
                this.#components.values().forEach(comp => comp.release());
                this.#components.clear();
            });
        }
    }

    /**
     * Get the capabilities of this material in the form of a list of material names.
     * @returns {Array<string>} an array of the names of the components.
     */
    get capabilities() {
        const componentNames = [];
        this.#components.values().forEach(comp => {componentNames.push(comp.name)});

        if (componentNames.length === 0) {
            componentNames.push(Material.#defaultColorName);
        }
        return componentNames;
    }

    get components() {
        return this.#components;
    }

    /**
     * create a copy of this material
     * @param {boolean} deepCopy if true, will create copies of the material's components
     */
    clone(deepCopy = false) {
        const newMaterial = new Material();
        this.#components.values().forEach(comp => {
            const newComp = deepCopy ? comp.clone() : comp;
            newMaterial.addComponent(newComp.acquire());
        })
    }

    /**
     * Apply this material's components to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram) {
        if (!(shaderProgram instanceof ShaderProgram)) {
            console.error(`[Material] Expected 'shaderProgram' to be an instance of Shader. Cannot apply material components to shader.`);
            return false;
        }
        // if there are no components attached, then send the default
        if (this.#components.size === 0) {
            Material.#defaultColor.applyToShader(shaderProgram)
        } else {
            this.#components.values().forEach(comp => comp.applyToShader(shaderProgram));
        }
        return true;
    } 
}