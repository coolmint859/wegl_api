import PrimComponent from "./prim-component.js";
import TexComponent from "./texture-component.js";
import Component from "../component.js";
import { ShaderProgram } from '../../systems/index.js';
import { Color, EventScheduler } from "../../utilities/index.js";

/**
 * Provides the 'look' for a Mesh instance. The components attached predominantly determines which shader the mesh uses.
 */
export default class Material extends Component {
    static #defaultColorName = 'baseColor';
    static #defaultColor;

    #components;

    /**
     * Create a new material instance
     * @param {Array<Component>} components list of initial components that this material should have
     */
    constructor(components=[]) {
        super('material');
        Material.#defaultColor = new PrimComponent(Color.WHITE, Material.#defaultColorName);

        this.#components = new Map();
        components.forEach(comp => this.addComponent(comp));
    }

    /**
     * Add a new material component to this material
     * @param {Component} component the new component
     */
    addComponent(component) {
        if (!(component instanceof Component)) {
            console.error(`[Material @ID${this.ID}] Expected '${component}' to be an instance of Component. Cannot add to Material.`);
            return;
        }
        component.parentContainer = this;
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

    isReady() {
        for (const comp of this.#components) {
            // only texture components are ones we need to worry about for 'readiness'
            if (comp instanceof TexComponent){
                if (!comp.isReady()) return false;
            }
        }
        return true;
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
        const matName = this.name !== '' ? `${this.name}.` : '';

        const componentIterator = this.#components.values().map(comp => {
            return `${matName}${comp.name}`;
        });
        const componentNames = Array.from(componentIterator);

        if (componentNames.length === 0) {
            componentNames.push(`${matName}${Material.#defaultColorName}`);
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
     * create a exact replica of this material
     * @param {string} canvasID optionally change the context the material components are bound to.
     */
    clone(canvasID='') {
        const newMaterial = new Material();
        this.#components.values().forEach(comp => {
            newMaterial.addComponent(comp.clone(canvasID));
        })
        return newMaterial;
    }

    /**
     * Apply this material's components to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the material to. Should already be in use.
     * @returns {boolean} true if the material was applied to the shader, false otherwise.
     */
    applyToShader(shaderProgram, options={}) {
        if (!(shaderProgram instanceof ShaderProgram)) {
            console.error(`[Material] Expected 'shaderProgram' to be an instance of Shader. Cannot apply material components to shader.`);
            return false;
        }
        // if there are no components attached, then send the default
        if (this.#components.size === 0) {
            Material.#defaultColor.applyToShader(shaderProgram, { parentName: this.name })
        } else {
            const shadeableComponents = this.#components.values().filter(comp => {
                return comp.hasModifier(Component.Modifier.SHADEABLE);
            })
            for (const comp of shadeableComponents) {
                comp.applyToShader(shaderProgram, { parentName: this.name })
            }
        }
        return true;
    }

    /** -------------------- Material Factory Methods -------------------- */

    /**
     * Creates a simple material with a single color component.
     * @param {object} params values to set the characteristics of this material
     * @param {object} params.color the color of the material (default is white)
     * @returns {Material} a new material instance with components matching the specification
     */
    static BasicMaterial(params={}) {
        const baseColor = (params.color instanceof Color) ? params.color : Color.WHITE;
        const material = new Material([new PrimComponent(baseColor, 'baseColor')]);
        material.name = '';

        return material;
    }

    /**
     * Creates a material usable with a blinn phong shader.
     * @param {object} params values to set the characteristics of this material
     * @param {object} params.diffColor the diffuse color of the material (default is off-white)
     * @param {object} params.specColor the specular color of the material (default is white)
     * @param {object} params.diffMap the path to a diffuse map texture for the material (overrides params.diffColor)
     * @param {object} params.diffMapOptions options for how to create the glTexture for the diffuse map
     * @param {object} params.specMap the path to a specular map texture for the material (overrides params.specColor)
     * @param {object} params.specMapOptions options for how to create the glTexture for the specular map
     * @returns {Material} a new material instance with components matching the specification
     */
    static BlinnPhongMaterial(params={}) {
        const matComponents = [];

        // determine diffuse color/map
        if (typeof params.diffMap === 'string') {
            if (!params.diffMapOptions) params.diffMapOptions = {};
            params.diffMapOptions.defaultColor = Color.ORANGE;
            matComponents.push(new TexComponent(params.diffMap, 'diffuseMap', params.diffMapOptions));
        } else {
            const diffColor = (params.diffColor instanceof Color) ? params.diffColor : new Color(0.9, 0.9, 0.9);
            matComponents.push(new PrimComponent(diffColor, 'diffuseColor'));
        }

        // determine specular color/map
        if (typeof params.specMap === 'string') {
            if (!params.specMapOptions) params.specMapOptions = {};
            params.specMapOptions.defaultColor = Color.BLUE;
            matComponents.push(new TexComponent(params.specMap, 'specularMap', params.specMapOptions));
        } else {
            const specColor = (params.specColor instanceof Color) ? params.specColor : Color.WHITE;
            matComponents.push(new PrimComponent(specColor, 'specularColor'));
        }

        // determine shininess
        const shininess = (typeof params.shininess === 'number') ? params.shininess : 1.0;
        matComponents.push(new PrimComponent(shininess, 'shininess'));

        return new Material(matComponents);
    }
}