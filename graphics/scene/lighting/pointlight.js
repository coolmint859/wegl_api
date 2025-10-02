import { Color, Vector3 } from "../../utilities/index.js";
import { Geometry, Material } from "../../modeling/index.js";
import Mesh from "../mesh.js";
import Light from "./light.js";

/**
 * Represents a point light source
 */
export default class PointLight extends Light {
    #name;

    #attenConstant = 1;
    #attenLinear = 0;
    #attenQuadratic = 0;
    #position;

    /**
     * Create a new PointLight instance
     * @param {Color} color the emmissive color of this light
     * @param {number} intensity the intensity of this light
     * @param {Vector3} position the position of this PointLight in world space
     */
    constructor(color, intensity, position) {
        super(color, intensity);
        this.#name = 'pointLights';

        let positionVector;
        if (!(position instanceof Vector3)) {
            console.error("Expected 'position' to be an instance of Vector3. Assigning default position.");
            positionVector = new Vector3(0, 0, 0); // place at origin
        } else {
            positionVector = position.clone();
        }

        this.#position = positionVector;


        const debugGeometry = Geometry.sphere(20, 20);
        const debugMaterial = Material.BasicMaterial({ color: this._color });
        
        this._debugModel = new Mesh(debugGeometry, debugMaterial);
        this._debugModel.dimensions = new Vector3(0.1, 0.1, 0.1);
        this._debugModel.position = this.#position;
        this._debugModel.currentShader = 'basic';

        this._lightType = Light.Type.POINTLIGHT;
    }
    
    /**
     * Set the debug model radius for this PointLight
     * @param {number} radius the new radius
     * @returns {boolean} true if the debug model radius was successfully set, false otherwise
     */
    set debugModelRadius(radius) {
        if (typeof radius !== 'number' || isNaN(radius) || radius <= 0) {
            console.error("Expected 'radius' to be a number greater than 0. Cannot set debug model radius.");
            return false;
        }
        this._debugModel.dimensions = new Vector3(radius, radius, radius);
        return true;
    }

    /**
     * Retrieve the position of this PointLight
     * @returns {Vector3} the position of this PointLight
     */
    get position() {
        return this.#position;
    }

    /**
     * Set the absolute position of this PointLight
     * @param {Vector3} position the new position vector
     * @returns {boolean} true if the position was successfully set, false otherwise
     */
    set position(position) {
        if (!(position instanceof Vector3)) {
            console.error("Expected 'position' to be an instance of Vector3. Cannot set position of this PointLight.");
            return false
        }
        this.#position = position.clone();
        this._debugModel.position = this.#position;
        return true;
    }

    /**
     * Sets the attenuation of this PointLight
     * @param {number} attenConstant the constant term.
     * @param {number} attenLinear the linear term.
     * @param {number} attenQuadratic the quadratic term.
     * @returns {boolean} true if the attenuation was successfully set, false otherwise.
     */
    setAttenuation(attenConstant, attenLinear, attenQuadratic) {
        const isValidNumber = (val) => typeof val === 'number' && !isNaN(val) && val >= 0;
        if (!isValidNumber(attenConstant) || !isValidNumber(attenLinear) || !isValidNumber(attenQuadratic)) {
            console.error("Expected attenuation factors to be numbers greater than 0. Cannot set attenuation.");
            return false;
        }
        this.#attenConstant = attenConstant;
        this.#attenLinear = attenLinear;
        this.#attenQuadratic = attenQuadratic;
        return true;
    }

    /**
     * retrieve the attenuation of this PointLight
     * @returns {object} the attenuation (const, linear, quad)
     */
    get attenuation() {
        return {
            const: this.#attenConstant,
            linear: this.#attenLinear,
            quad: this.#attenQuadratic 
        }
    }

    /**
     * Apply this pointlight to a shader
     * @param {ShaderProgram} shaderProgram the shader program instance to apply this light to
     * @param {number} index the index location of the pointlight
     */
    applyToShader(shaderProgram, index) {
        const elementPrefix = "pointLights[" + index + "].";
        if (shaderProgram.supports(elementPrefix + "position")) {
            shaderProgram.setUniform(elementPrefix + "position", this.#position);
        }
        if (shaderProgram.supports(elementPrefix + "emissiveColor")) {
            shaderProgram.setUniform(elementPrefix + "emissiveColor", this._color);
        }
        if (shaderProgram.supports(elementPrefix + "attenConst")) {
            shaderProgram.setUniform(elementPrefix + "attenConst", this.#attenConstant);
        }
        if (shaderProgram.supports(elementPrefix + "attenLinear")) {
            shaderProgram.setUniform(elementPrefix + "attenLinear", this.#attenLinear);
        }
        if (shaderProgram.supports(elementPrefix + "attenQuad")) {
            shaderProgram.setUniform(elementPrefix + "attenQuad", this.#attenQuadratic);
        }
    }
}