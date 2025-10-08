import { Component } from "../components/index.js";
import { DirectLight, PointLight, Mesh } from "../entities/index.js";
import { Color } from "../utilities/index.js";
import ShaderProgram from "./shader-program.js";

/**
 * Represents an entire renderable scene with lights and models
 */
export default class Scene {
    #models;
    #pointLights;
    #globalUniforms;

    #directLight = null;

    toggles = {
        // webgl state toggles
        depthTest: true,
        depthMask: true,
        cullBackFaces: true,
        blending: true,
        scissorTest: false,
        stencilTest: false,

        // rendering feature toggles
        receiveShadows: true,       // all objects get shadows by default
        castShadow: true,           // all objects cast shadows by default
        useLighting: true,          // all objects are lit by scene lights by default
        wireframe: false,           // all objects are rasterized by default
    }

    /**
     * Create a new Scene instance
     * @param {object} toggles optional toggles for changing how all objects in the scene are rendered.
     */
    constructor(toggles={}) {
        this.#models = new Map();
        this.#pointLights = new Map();

        this.#globalUniforms = new Map();
        this.#globalUniforms.set('ambientColor', new Color(0.1, 0.1, 0.1));

        for (const toggleName in toggles) {
            if (toggleName in this.toggles) {
                this.toggles[toggleName] = toggles[toggleName];
            }
        }
    }

    get models() {
        return this.#models.values();
    }

    get lights() {
        const lights = [...this.#pointLights.values()];
        if (this.#directLight !== null) {
            lights.push(this.#directLight);
        }
        return lights;
    }

    get renderables() {
        const sceneObjects = [...this.models];
        for (const light of this.lights) {
            if (light.debugEnabled) {
                sceneObjects.push(light.debugModel);
            }
        }
        return sceneObjects;
    }

    addModel(alias, model) {
        if (!(model instanceof Mesh)) {
            console.error(`[Scene] Expected 'model' to be an instance of Mesh or Model. Cannot add to scene.`);
            return;
        }
        this.#models.set(alias, model);
    }

    removeModel(alias) {
        if (!this.#models.has(alias)) {
            console.error(`[Scene] Could not find '${alias}' in known models. Cannot remove model from scene.`);
            return;
        }
        this.#models.delete(alias);
    }

    addPointLight(alias, pointLight) {
        if (!(pointLight instanceof PointLight)) {
            console.error(`[Scene] Expected 'pointLight' to be an instance of PointLight. Cannot add to scene.`);
            return;
        }
        this.#pointLights.set(alias, pointLight);
    }

    removePointLight(alias) {
        if (this.#models.has(alias)) {
            console.error(`[Scene] Could not find '${alias}' in known models. Cannot remove model from scene.`);
            return;
        }
        this.#models.delete(alias);
    }

    setDirectLight(directLight) {
        if (!(directLight instanceof DirectLight)) {
            console.error(`[Scene] Expected 'directLight' to be an instance of DirectLight. Cannot add to scene.`);
            return;
        }
        this.#directLight = directLight;
    }

    setGlobalUniform(name, global) {
        if (typeof name !== 'string' || name.trim() === '') {
            console.error(`[Scene] Expected 'name' for global uniform to be a non-empty string. Cannot set uniform.`);
            return;
        }
        this.#globalUniforms.set(name, global);
    }

    update(dt, totalTime) {
        this.#globalUniforms.set('totalTime', totalTime);
        for (const entity of this.#models.values()) {
            entity.update(dt, totalTime);
        }
    }

    /**
     * Apply any global uniforms in this scene to the provided shader program.
     * @param {ShaderProgram} shaderProgram the shader program to apply the uniforms to.
     */
    applyGlobalUniforms(shaderProgram) {
        for (const [name, global] of this.#globalUniforms) {
            if (global instanceof Component) {
                global.applyToShader(shaderProgram);
            } else if (shaderProgram.supports(name)) {
                shaderProgram.setUniform(name, global);
            }
        }
    }

    /**
     * Apply lights in this scene to the provided shader program.
     * @param {ShaderProgram} shaderProgram the shader program to apply the uniforms to.
     */
    applyLights(shaderProgram) {
        // pointlights
        if (shaderProgram.supports('numPointLights')) {
            shaderProgram.setUniform('numPointLights', this.#pointLights.size);
        }

        let i = 0;
        for (const pointLight of this.#pointLights.values()) {
            pointLight.applyToShader(shaderProgram, i);
            i++
        }

        // directional light
        if (this.#directLight !== null) {
            this.#directLight.applyToShader(shaderProgram);
        }
    }
}