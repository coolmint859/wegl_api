import { Vector3 } from "../utilities/math/vector.js";
import Color from "../utilities/containers/color.js";
import Light from "./light.js";
import Graphics3D from "../rendering/renderer.js";
import { generateSphere } from "../modeling/model.js";
import Material from "../modeling/material.js";
import Transform from "../utilities/containers/transform.js";

/**
 * Represents a pointlight
 */
export default class PointLight extends Light {
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

        let positionVector;
        if (!(position instanceof Vector3)) {
            console.error("Expected 'position' to be an instance of Vector3. Assigning default position.");
            positionVector = new Vector3(0, 0, 0); // place at origin
        } else {
            positionVector = position.clone();
        }

        this.#position = positionVector;
        this._debugModel = {
            arrays: generateSphere(20, 20),
            material: new Material({
                diffuseColor: color
            }).acquire(),
            transform: new Transform({ position: this.#position, dimensions: Vector3.Ones() }),
            renderType: Graphics3D.RenderType.BASIC
        }
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
        this._debugModel.transform.dimensions = new Vector3(radius, radius, radius);
        return true;
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
        this._debugModel.transform.setPosition(this.#position);
        return true;
    }

    /**
     * Translates this pointLight by the deltaPosition.
     * @param {Vector3} deltaPosition the translation vector
     * @returns {boolean} true if the position was successfully translated, false otherwise
     */
    translate(deltaPosition) {
        if (!(deltaPosition instanceof Vector3)) {
            console.error("Expected 'deltaPosition' to be an instance of Vector3. Cannot translate position of this PointLight.");
            return false
        }
        this.#position = this.#position.add(deltaPosition);
        this._debugModel.transform.translate(deltaPosition);
        return true;
    }

    /**
     * Retrieve the position of this PointLight
     * @returns {Vector3} the position of this PointLight
     */
    get position() {
        return this.#position.clone();
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
        if (!isValidNumber(attenConstant)) {
            console.error("Expected 'attenConstant' to be a number greater than 0. Cannot set attenuation.");
            return false;
        }
        if (!isValidNumber(attenLinear)) {
            console.error("Expected 'attenLinear' to be a number greater than 0. Cannot set attenuation.");
            return false;
        }
        if (!isValidNumber(attenQuadratic)) {
            console.error("Expected 'attenQuadratic' to be a number greater than 0. Cannot set attenuation.");
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

    applyToShader(shader, index) {
        const currentLightName = "pointLights[" + index + "]";
        shader.setColor(currentLightName + ".emissiveColor", this._color);
        shader.setFloat(currentLightName + ".attenConst", this.#attenConstant);
        shader.setFloat(currentLightName + ".attenLinear", this.#attenLinear);
        shader.setFloat(currentLightName + ".attenQuad", this.#attenQuadratic);
        shader.setVector3(currentLightName + ".position", this.#position);
    }
}