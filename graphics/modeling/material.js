import Color from "../utilities/containers/color.js";
import EventScheduler from "../utilities/scheduler.js";
import ShaderProgram from "../shading/shader-program.js";
import ColorComponent from "../components/color-component.js";
import Component from "../components/component.js";

export default class Material extends Component {
    static #defaultColorName = 'baseColor';
    static #defaultColor = new ColorComponent(Color.WHITE, Material.#defaultColorName);

    #components;

    /**
     * Create a new material instance
     * @param {Array<Component>} components list of initial components that this material should have
     */
    constructor(components=[]) {
        super('material');

        this.#components = new Map();
        components.forEach(comp => this.addComponent(comp));
    }

    /**
     * Add a new material component to this material
     * @param {Component} component the new component
     */
    addComponent(component) {
        if (!(component instanceof Component)) {
            console.error(`[Material @ID${this.ID}] Expected '${component}' to be an instance of MaterialComponent. Cannot add to Material.`);
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
            console.error(`[Material @ID${this.ID}] Expected 'name' to be a string. Cannot remove material component from Material.`);
            return false;
        }
        return this.#components.delete(name);
    }

    /**
     * Get a component attached to this material
     * @param {string} name the name of the component
     * @returns {Component | null} the material component instance. If not found, null is returned.
     */
    getComponent(name) {
        if (typeof name !== 'string') {
            console.error(`[Material @ID${this.ID}] Expected 'name' to be a string. Cannot retreive material component from Material.`);
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
            console.error(`[Material @ID${this.ID}] Expected 'name' to be a string. Cannot check for material component in Material.`);
            return false;
        }
        return this.#components.has(name);
    }

    /**
     * Release this material from use.
     */
    release() {
        super.release();
        if (this.refCount === 0) {
            EventScheduler.schedule('mat-comp-release', 1, () => {
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
        const componentNames = this.#components.keys().map(comp => `${this.name}.${comp.name}`);

        if (componentNames.length === 0) {
            componentNames.push(`${this.name}.${Material.#defaultColorName}`);
        }
        return componentNames;
    }

    /**
     * Get the value of this component.
     * @returns {Array<Component>} a list of the components attached to this material
     */
    get value() {
        return this.#components.values();
    }

    /**
     * Check if a component with the given name is attached to this material
     * @param {string} componentName the name of the component to check against
     * @returns {boolean} true if at least one component with the name exists on this material, false otherwise
     */
    contains(componentName) {
        return this.#components.some(comp => comp.name === componentName);
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
        const materialName = this.name + '.';
        if (this.#components.size === 0) {
            Material.#defaultColor.applyToShader(shaderProgram, { parentName: materialName })
        } else {
            this.#components.values()
            .forEach(comp => comp.applyToShader(shaderProgram, { parentName: materialName }));
        }
        return true;
    }
}