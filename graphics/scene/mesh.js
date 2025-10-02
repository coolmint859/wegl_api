import { ShaderProgram } from "../rendering/index.js";
import { Geometry, Material, Component } from "../modeling/index.js";
import Transform from "./transform.js";
import { Vector3 } from "../utilities/index.js";

/**
 * Represents a renderable entity
 */
export default class Mesh {
    static #ID_COUNTER = 0;
    #ID;

    #geometry;
    #material;
    #transform;

    // components are additional abilities a mesh can have to affect it's behavior
    #shadeableComponents;
    #updatableComponents;

    currentShader = '';
    toggles;

    /**
     * Create a new Mesh instance
     * @param {Geometry} geometry a geometry instance specifying the vertex data of this mesh
     * @param {Material} material a material instance specifying the 'look' of this mesh
     * @param {object} toggles optional rendering toggles (wireframe mode, disable depth mask etc..)
     */
    constructor(geometry, material, toggles={}) {
        if (!(geometry instanceof Geometry)) {
            console.error(`[Mesh ID#${this.#ID}] Expected 'geometry' to be an instance of Geometry.`);
            return;
        }

        if (!(material instanceof Material)) {
            console.error(`[Mesh ID#${this.#ID}] Expected 'material' to be an instance of Material. Setting default 'BasicMaterial'`);
            this.#material = Material.BasicMaterial();
        } else {
            this.#material = material;
        }

        this.#ID = Mesh.#ID_COUNTER++;

        this.#geometry = geometry;
        this.#transform = new Transform();
        this.#material.parentContainer = this;
        this.toggles = toggles;

        this.#shadeableComponents = new Map();
        this.#updatableComponents = new Map();
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
        capabilities.push(...this.#transform.capabilities);

        for (const component of this.#shadeableComponents.values()) {
            capabilities.push(...component.capabilities);
        }
        return capabilities;
    }

    /**
     * Get the position vector of this mesh
     */
    get position() {
        return this.#transform.position;
    }

    /**
     * Set the position vector of this mesh
     * @param {Vector3} newPos the new position vector
     */
    set position(newPos) {
        this.#transform.position = newPos;
    } 

    /**
     * Get the rotation quaternion of this mesh
     */
    get rotation() {
        return this.#transform.rotation;
    }

    /**
     * Set the rotation quaternion of this mesh
     * @param {Vector3} newRot the new rotation quaternion
     */
    set rotation(newRot) {
        this.#transform.rotation = newRot;
    }

    /**
     * Get the dimension vector of this mesh
     */
    get dimensions() {
        return this.#transform.dimensions;
    }

    /**
     * Set the dimension vector of this mesh
     * @param {Vector3} newDim the new dimension vector
     */
    set dimensions(newDim) {
        this.#transform.dimensions = newDim;
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
        if (component.hasModifier(Component.Modifier.SHADEABLE)) {
            this.#shadeableComponents.set(component.name, component);
            component.parentContainer = this;
        } else if (component.hasModifier(Component.Modifier.UPDATABLE)) {
            this.#updatableComponents.set(component.name, component);
            component.parentContainer = this;
        } else {
            console.error(`[Mesh ID#${this.#ID}] Component '${component.name}' does not have a supported modifier. Cannot add component to mesh.`);
            return;
        }
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
        if (this.#shadeableComponents.has(componentName)) {
            this.#shadeableComponents.delete(componentName);
        } else if (this.#updatableComponents.has(componentName)) {
            this.#updatableComponents.delete(componentName);
        }
    }

    /**
     * Check if a component with the given name is attached to this mesh
     * @param {string} componentName the name of the component to check against
     * @returns {boolean} true if at least one component with the name exists on this material, false otherwise
     */
    contains(componentName) {
        const isShadeable = this.#shadeableComponents.some(comp => comp.name === componentName);
        const isUpdatable = this.#updatableComponents.some(comp => comp.name === componentName);

        return isShadeable || isUpdatable;
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
     * Update any updateable components attached to this mesh
     * @param {number} dt the elapsed time in seconds since the last update
     */
    updateComponents(dt, totalTime) {
        for (const component of this.#updatableComponents.values()) {
            component.update(dt, totalTime);
        }
    }

    /**
     * 
     * @param {string} canvasID optional id to change the context for which the new mesh is bound to
     * @returns {Mesh} a new mesh instance
     */
    clone(canvasID='') {
        const newGeometry = this.#geometry.clone(canvasID);
        const newMaterial = this.material.clone(canvasID);
        const newTransform = this.#transform.clone();
        const newMesh = new Mesh(newGeometry, newMaterial, newTransform);

        for (const component of this.#shadeableComponents.values()) {
            newMesh.addComponent(component);
        }
        for (const component of this.#updatableComponents.values()) {
            newMesh.addComponent(component);
        }
        return newMesh;
    }

    /**
     * Apply this mesh to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the mesh to. Should already be in use.
     */
    applyToShader(shaderProgram) {
        this.#transform.applyToShader(shaderProgram);
        this.#material.applyToShader(shaderProgram);

        for (const component of this.#shadeableComponents.values()) {
            component.applyToShader(shaderProgram);
        }
    }
}