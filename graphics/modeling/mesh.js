import Component from "../components/component.js";
import ShaderProgram from "../shading/shader-program.js";
import Geometry from "./geometry/geometry.js";
import Material from "./materials/material.js";
import Transform from "./transform.js";
import { BPBasicMaterial } from "./materials/default-materials.js";

/**
 * Represents a renderable entity
 */
export default class Mesh {
    static #ID_COUNTER = 0;
    #ID;

    #geometry;
    #material;
    transform;

    #components; // components are additional abilities a mesh can have to affect it's behavior

    currentShader = '';

    /**
     * Create a new Mesh instance
     * @param {Geometry} geometry a geometry instance specifying the vertex data of this mesh
     * @param {Material} material a material instance specifying the 'look' of this mesh
     * @param {Transform} transform optional transform instance specifying the orientation of this mesh.
     */
    constructor(geometry, material, transform) {
        if (!(geometry instanceof Geometry)) {
            console.error(`[Mesh ID#${this.#ID}] Expected 'geometry' to be an instance of Geometry.`);
            return;
        }

        if (!(material instanceof Material)) {
            console.error(`[Mesh ID#${this.#ID}] Expected 'material' to be an instance of Material.`);
            this.material = BPBasicMaterial();
        } else {
            this.#material = material;
        }

        if (!(transform instanceof Transform)) {
            console.error(`[Mesh ID#${this.#ID}] Expected 'transform' to be an instance of Transform.`);
            this.transform = new Transform();
        } else {
            this.transform = transform;
        }
        this.#ID = Mesh.#ID_COUNTER++;

        this.#geometry = geometry;
        this.#material.parentContainer = this;
        this.#components = new Map();
    }

    get ID() {
        return this.#ID;
    }

    /**
     * Get the capabilities of this mesh
     * @returns {Array<string>} an array of strings representing the capabilities of this mesh
     */
    get capabilities() {
        const capabilities = [];
        capabilities.push(...this.#geometry.capabilities);
        capabilities.push(...this.#material.capabilities);
        capabilities.push(...this.transform.capabilities);

        for (const component of this.#components.values()) {
            if (component.hasModifer(Component.Modifier.SHADEABLE)) {
                capabilities.push(...component.capabilities);
            }
        }
        return capabilities;
    }

    /**
     * Attach a component to this mesh.
     * @param {string} alias an indentifier for the component
     * @param {Component} component the component instance to attach
     */
    addComponent(component) {
        if (!component instanceof Component) {
            console.error(`[Mesh ID#${this.#ID}] Expected 'component' to be an instance of Component. Cannot add component to mesh.`);
            return;
        }
        this.#components.set(component.name, component);
        component.parentContainer = this;
    }

    /**
     * remove a component from this mesh
     * @param {string} name the identifier for the component
     */
    removeComponent(componentName) {
        if (typeof componentName !== 'string' || componentName.trim() === '') {
            console.error(`[Mesh ID#${this.#ID}] Expected 'componentName' to be a non-empty string. Cannot remove component from mesh.`);
            return;
        }
        this.#components.delete(componentName);
    }

    /**
     * Check if a component with the given name is attached to this mesh
     * @param {string} componentName the name of the component to check against
     * @returns {boolean} true if at least one component with the name exists on this material, false otherwise
     */
    contains(componentName) {
        return this.#components.some(comp => comp.name === componentName);
    }

    /**
     * Check if the VAO for the given shader name has been created.
     * @param {string} shaderName 
     * @returns 
     */
    isReadyFor(shaderName) {
        const geometryReady = this.#geometry && this.#geometry.isReadyFor(shaderName);
        const materialReady = this.#material && this.#material.isReady();

        return geometryReady && materialReady;
    }

    /**
     * Prepare this mesh for rendering by creating a VAO.
     * @param {ShaderProgram} shaderProgram the shader program instance the mesh should be prepared for
     * @param {object} options options for generating and storing the VAO. See docs for possible properties.
     */
    prepareForShader(shaderProgram, options={}) {
        if (this.#geometry && !this.#geometry.isReadyFor(shaderProgram)) {
            this.#geometry.generateVAO(shaderProgram, options);
        }
    }

    getDataFor(shaderName) {
        if (!this.isReadyFor(shaderName)) return null;
        return this.#geometry.getDataFor(shaderName);
    }

    geometryIsBuilding(shaderName) {
        return this.#geometry.isBuilding(shaderName);
    }

    /**
     * Update any updateable components attached to this mesh
     * @param {number} dt the elapsed time in seconds since the last update
     */
    updateComponents(dt) {
        const updatableComps = this.#components.values().filter(comp => {
            comp.hasModifer(Component.Modifier.UPDATABLE);
        })

        for (const component of updatableComps) {
            component.update(dt);
        }
    }

    /**
     * Get the raw vertex data and VAO from this mesh's geometry
     * @param {string} shaderName the name of the shader
     * @returns {object} as object containing the vertex data and VAO as properties, if ready. Returns null otherwise.
     */
    getGeometryData(shaderName) {
        if (this.isReadyFor(shaderName)) {
            return this.#geometry.getDataFor(shaderName);
        }
        return null;
    }

    /**
     * 
     * @param {string} canvasID optional id to change the context for which the new mesh is bound to
     * @returns {Mesh} a new mesh instance
     */
    clone(canvasID='') {
        const newGeometry = this.#geometry.clone(canvasID);
        const newMaterial = this.material.clone(canvasID);
        const newTransform = this.transform.clone();
        const newMesh = new Mesh(newGeometry, newMaterial, newTransform);

        for (const component of this.#components.values()) {
            newMesh.addComponent(component);
        }
        return newMesh;
    }

    /**
     * Apply this mesh to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the mesh to. Should already be in use.
     */
    applyToShader(shaderProgram) {
        this.transform.applyToShader(shaderProgram);
        this.#material.applyToShader(shaderProgram);

        const shadeableComponents = this.#components.values().filter(comp => {
            comp.hasModifer(Component.Modifier.SHADEABLE);
        })

        for (const component of shadeableComponents) {
            component.applyToShader(shaderProgram);
        }
    }
}