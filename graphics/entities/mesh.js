import { ShaderProgram } from "../systems/index.js";
import { Material, Component } from "../components/index.js";
import Geometry from "./geometry/geometry.js";
import Entity from "./entity.js";
import { EventDispatcher } from "../utilities/index.js";

/**
 * Represents a renderable entity
 */
export default class Mesh extends Entity {
    #geometry;
    #material;

    currentShader = '';
    toggles;

    /**
     * Create a new Mesh instance
     * @param {Geometry} geometry a geometry instance specifying the vertex data of this mesh
     * @param {Material} material a material instance specifying the 'look' of this mesh
     * @param {object} toggles optional rendering toggles (wireframe mode, disable depth mask etc..)
     */
    constructor(geometry, material, toggles={}) {
        super('mesh');
        if (!(geometry instanceof Geometry)) {
            console.error(`[Mesh ID#${this.ID}] Expected 'geometry' to be an instance of Geometry.`);
            return;
        }
        if (!(material instanceof Material)) {
            console.error(`[Mesh ID#${this.ID}] Expected 'material' to be an instance of Material. Setting default 'BasicMaterial'`);
            this.#material = Material.BasicMaterial();
        } else {
            this.#material = material;
        }

        this.#geometry = geometry;
        this.#material.parentContainer = this;
        this.toggles = { rayCast: true, ...toggles };

        this.dispatcher.subscribe(EventDispatcher.EventType.POSITION_CHANGE, (event) => this.position = event.position);
        this.dispatcher.subscribe(EventDispatcher.EventType.ROTATION_CHANGE, (event) => this.rotation = event.rotation);

        this.#populateCapabilities();
    }

    /** populates the capability list of this mesh */
    #populateCapabilities() {
        this._capabilities.push(...this.#geometry.capabilities);
        this._capabilities.push(...this.#material.capabilities);
        this._capabilities.push(...this._transform.capabilities);

        for (const component of this.componentList) {
            if (component.hasModifier(Component.Modifier.SHADEABLE)) {
                this._capabilities.push(...component.capabilities);
            }
        }
    }

    /**
     * Check if mesh is ready for rendering with a given shader
     * @param {string} shaderName the name of the shader that would be rendering the mesh
     * @returns {boolean} true if the mesh is ready to be rendered, false otherwise
     */
    isReady() {
        return this.#material && this.#material.isReady();
    }

    /**
     * Checks if a VAO for this mesh has been created for the given shader
     * @param {string} shaderName the name of the shader to check for
     * @returns {boolean} true if the VAO has been created, false otherwise;
     */
    hasVAOfor(shaderName) {
        return this.#geometry.hasVAOFor(shaderName);
    }

    /**
     * Generate a VAO for the given shader program from this mesh
     * @param {ShaderProgram} shaderProgram the shader program instance the mesh should be prepared for
     * @param {object} options options for generating and storing the VAO. See docs for possible properties.
     */
    generateVAOfor(shaderProgram, options={}) {
        if (!this.isReady()) return null;
        this.#geometry.generateVAO(shaderProgram, options);
    }

    /**
     * Get the geometry data associated with this mesh for the given shader
     * @param {string} shaderName the name of the shader
     * @returns {object} an object containing the VAO, geometry arrays, and buffers
     */
    getDataFor(shaderName) {
        if (!this.isReady()) return null;
        return this.#geometry.getDataFor(shaderName);
    }

    /**
     * Update the components attached to this mesh
     * @param {number} dt the elapsed time in seconds since the last update
     */
    update(dt, totalTime) {
        for (const component of this.componentList) {
            if (component.hasModifier(Component.Modifier.UPDATABLE)) {
                component.update(this, dt, totalTime);
            }
        }
    }

    /**
     * 
     * @param {string} canvasID optional id to change the context for which the new mesh is bound to
     * @returns {Mesh} a new mesh instance
     */
    clone(canvasID='') {
        const newGeometry = this.#geometry.clone(canvasID);
        const newMaterial = this.#material.clone(canvasID);
        const newTransform = this._transform.clone();
        const newMesh = new Mesh(newGeometry, newMaterial, newTransform);

        for (const component of this.componentList) {
            newMesh.addComponent(component.clone());
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

        for (const component of this.componentList) {
            if (component.hasModifier(Component.Modifier.SHADEABLE)) {
                component.applyToShader(shaderProgram);
            }
        }
    }
}