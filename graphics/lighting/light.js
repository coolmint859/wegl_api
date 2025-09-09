import Color from "../../utilities/containers/color.js";
import { Vector2 } from "../../utilities/math/vector.js";
import Graphics3D from "../rendering/renderer.js";

/**
 * Abstract class, representing a light source.
 */
export default class Light {
    static Type = Object.freeze({
        POINTLIGHT: 'point',
        SPOTLIGHT: 'spot',
        DIRECTIONAL: 'directional'
    })
    static #ID_COUNTER = 0;

    // general light properties
    _color;
    _intensity;
    _lightID;
    _debugEnabled;

    // shadow map properties
    #castsShadows = true;
    #shadowMapResolution = new Vector2(1024, 1024);
    #shadowMapBias = 0.005;
    #shadowNormalBias = 0.01;

    constructor(color, intensity) {
        let lightColor, lightIntensity;
        if (!(color instanceof Color)) {
            console.warn("TypeError: Expected 'color' to be an instance of Color. Assigning default color (white) to light.");
            lightColor = Color.WHITE;
        } else { lightColor = color.clone(); }
        if (typeof intensity !== 'number' || intensity < 0) {
            console.warn("TypeError: Expected 'intensity' to be a number greater than 0. Assigning default intensity (1) to light.");
            lightIntensity = 1;
        } else { lightIntensity = intensity; }

        this._color = lightColor;
        this._intensity = lightIntensity;
        this._debugEnabled = false;

        // subclass specific attributes
        this._debugModel = null;
        this._lightType = null;

        this._lightID = Light.#ID_COUNTER++;
    }

    /**
     * Checks if the given value is a valid light type.
     * @param {string} typeString the value to test against.
     * @returns true if the value is a valid light type, false otherwise
     */
    static isValidType(typeString) {
        let validType = false;
        Object.values(Light.Type).forEach(lightType => {
            if (lightType === typeString) validType = true;
        });
        return validType;
    }

    /**
     * Get this light's ID
     * @returns {number} the light ID.
     */
    get ID() {
        return this._lightID;
    }

    /**
     * Set the emissive color of this light.
     * @param {Color} color the light's new color
     * @returns {boolean} true if the light's color was successfully set, false otherwise
     */
    set color(color) {
        if (!(color instanceof Color)) {
            console.error("TypeError: Expected 'color' to be an instance of Color. Cannot change color of this light.");
            return false;
        }
        this._color = color;
        return true;
    }

    /**
     * Set the intensity of this light.
     * @param {number} intensity the light's new intensity - must be a value greater than 0.
     * @returns {boolean} true if the light's color was successfully set, false otherwise.
     */
    set intensity(intensity) {
        if (typeof intensity !== 'number' || isNaN(intensity) || intensity < 0) {
            console.error("TypeError: Expected 'intensity' to be an number greater than 0. Cannot change intensity of this light.");
            return false;
        }
        this._intensity = intensity;
        return true;
    }

    /**
     * Get this light's current emissive color
     * @returns {Color} this light's emissive color
     */
    get color() {
        return this._color.clone();
    }

    /**
     * Get this light's current intensity - a value between 0 and 1
     * @returns {number} this light's intensity
     */
    get intensity() {
        return this._intensity;
    }

    /**
     * Check if this light casts shadows
     * @returns {boolean} true if the light casts shadows, false otherwise
     */
    get castsShadows() {
        return this.#castsShadows;
    }

    /**
     * Set whether this light casts shadows.
     * @param {boolean} castsShadows true if this light casts shadows, false otherwise
     */
    set castsShadows(castsShadows) {
        this.#castsShadows = castsShadows;
    }

    /**
     * Set the resolution of the shadow map used by this light
     * @param {number} width the width of the map in pixels
     * @param {number} height the height of the map in pixels
     * @returns {boolean} true if the resolution was successfully updated, false otherwise
     */
    setShadowMapResolution(width, height) {
        const isValidNumber = (val) => typeof val === 'number' && !isNaN(val) && val > 0;
        if (!(isValidNumber(width) && isValidNumber(height))) {
            console.error("TypeError: Expected 'width' and 'height' to be numbers greater than 0. Cannot change resolution of the shadow map for this light.");
            return false;
        }
        this.#shadowMapResolution.x = width;
        this.#shadowMapResolution.y = height;
        return true;
    }

    /**
     * Retrieve this light's shadow map's current resolution
     * @returns {Vector2} a Vector2 istance where x is the width, and y is the height
     */
    get shadowMapResolution() {
        return this.#shadowMapResolution.clone();
    }

    /**
     * Set this light's shadow map's bias
     * @param {number} bias the new shadow bias
     * @returns true if the shadow bias was successfully set, false otherwise
     */
    set shadowMapBias(bias) {
        if (typeof bias !== 'number' || isNaN(bias)) {
            console.error("TypeError: Expected 'bias' for shadow map to be a number. Cannot change bias of the shadow map for this light.");
            return false;
        }
        this.#shadowMapBias = bias;
        return true;
    }

    /**
     * Set this light's shadow normal bias
     * @param {number} normalBias the new shadow normal bias
     * @returns true if the shadow normal bias was successfully set, false otherwise
     */
    set shadowNormalBias(normalBias) {
        if (typeof normalBias !== 'number' || isNaN(normalBias)) {
            console.error("TypeError: Expected 'normalBias' to be a number. Cannot change normal bias of the shadow map for this light.");
            return false;
        }
        this.#shadowNormalBias = normalBias;
        return true;
    }

    /**
     * Retrieve this light's shadow map's bias
     * @returns {number} the shadow map bias
     */
    get shadowMapBias() {
        return this.#shadowMapBias;
    }

    /**
     * Retrieve this light's shadow normal bias
     * @returns {number} the shadow normal bias
     */
    get shadowNormalBias() {
        return this.#shadowNormalBias;
    }

    /**
     * Retrieve the debug model of this light
     * @returns {Mesh} the debug model of this light
     */
    get debugModel() {
        if (this._debugModel) {
            return this._debugModel;
        }
        console.error("Cannot retrieve debug model of abstract Light instance. Please instatiate a subclass to get the Light debug model. If this light is of type DIRECTIONAL, no model exists.");
        return null;
    }

    /**
     * Sets the debug model for this light.
     * @param {Mesh} debugModel the new debug model
     * @returns {boolean} true if the debug model was successfully set, false otherwise.
     */
    set debugModel(debugModel) {
        if (!(debugModel instanceof Mesh)) {
            console.error("Expected 'debugModel' to be an instance of Model. Cannot set debug model for this Light instance.");
            return false;
        }
        this._debugModel = debugModel;
        return true;
    }

    /**
     * Checks if debug view is enabled with this light. If the light is directional, debug is always disabled.
     * @returns {boolean} true if the debug is enabled and the light is not directional, false otherwise
     */
    get debugEnabled() {
        return this._debugEnabled && this._lightType !== Light.DIRECTIONAL;
    }

    /**
     * Enable/disable this light's debug mode
     * @param {boolean} debug set to true to enable debug, false otherwise
     */
    set debugEnabled(debug) {
        this._debugEnabled = debug;
    }

    /**
     * Get the type of this light.
     * @returns {string} the light type.
     */
    get type() {
        if (this._lightType) {
            return this._lightType;
        }
        console.error("Cannot retrieve type of abstract Light instance. Please instatiate a subclass to get the Light type.");
        return '';
    }

    applyToShader(shader) {
        console.error(`[Light] Unable to apply light attributes for abstract light class. Create a concrete subclass to apply attributes.`);
    }
}