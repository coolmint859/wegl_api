import { ShaderProgram } from "../../systems/index.js"
import { Color, Vector3 } from "../../utilities/index.js";
import Light from "./light.js";

/**
 * Represents a directional light source.
 */
export default class DirectLight extends Light {
    #direction;
    #name;

    /**
     * Create a new DirectionalLight instance
     * @param {Color} color the emissive color of the light
     * @param {number} intensity the intensity of the light
     * @param {Vector3} direction the direction of the light
     */
    constructor(color, intensity, direction) {
        super(color, intensity);
        this.#name = 'directLight';

        let directionVector;
        if (!(direction instanceof Vector3)) {
            console.error("Expected 'direction' to be an instance of Vector3. Assigning default direction.");
            directionVector = new Vector3(0, -1, 0); // point straight down
        } else {
            directionVector = direction.clone();
        }

        this.#direction = directionVector.normal();
        this._lightType = Light.Type.DIRECTIONAL;
    }

    /**
     * Get the name of this directional light;
     */
    get name() {
        return this.#name;
    }

    /**
     * Set the name of this directional light. This will be used as the uniform name for DirectLight structs in GLSL.
     * @param {string} name the new name for this direct light
     */
    set name(name) {
        this.#name = name;
    }

    /**
     * Get this DirectionalLight's current direction vector
     * @returns {Vector3} the direction vector
     */
    get direction() {
        return this.#direction.clone();
    }

    /**
     * Set this DirectionalLight's direction vector. Is normalized before storing.
     * @param {Vector3} direction the new direction vector
     * @returns {boolean} true if the direction vector was successfully set, false otherwise.
     */
    set direction(direction) {
        if (!(direction instanceof Vector3)) {
            console.error("Expected 'direction' to be an instance of Vector3. Assigning default direction.");
            return false;
        }
        this.#direction = direction.clone().normal();
        return true;
    }

    /**
     * apply this point light to a shader instance.
     * @param {ShaderProgram} shaderProgram the shader program instance to apply this direct light to.
     * @param {number} index if this direct light in an array, the index can be used to specify the location. If negative, this as treated as standalone.
     */
    applyToShader(shaderProgram, index = -1) {
        const elementPrefix = index >= 0 ? `${this.#name}[${index}].` : `${this.name}.`;
        
        if (shaderProgram.supports(elementPrefix + 'direction')) {
            shaderProgram.setUniform(elementPrefix + 'direction', this.#direction);
        }

        if (shaderProgram.supports(elementPrefix + 'emissiveColor')) {
            shaderProgram.setUniform(elementPrefix + 'emissiveColor', this._color);
        }

        if (shaderProgram.supports(elementPrefix + 'intensity')) {
            shaderProgram.setUniform(elementPrefix + 'intensity', this._intensity);
        }
    }
}