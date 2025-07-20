import Color from "../../utilities/color.js";

export default class Light {
    static Type = Object.freeze({
        POINTLIGHT: 'point',
        SPOTLIGHT: 'spot',
        DIRECTIONAL: 'directional'
    })
    static #ID_COUNTER = 0;

    // general light properties
    #color;
    #intensity;
    #lightID;
    #debugEnabled;

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

        this.#color = lightColor;
        this.#intensity = lightIntensity;
        this.#debugEnabled = false;

        // subclass specific attributes
        this._debugModel = null;
        this._lightType = null;

        this.#lightID = Light.#ID_COUNTER++;
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
    getID() {
        return this.#lightID;
    }

    /**
     * Set the emissive color of this light.
     * @param {Color} color the light's new color
     * @returns {boolean} true if the light's color was successfully set, false otherwise
     */
    setColor(color) {
        if (!(color instanceof Color)) {
            console.error("TypeError: Expected 'color' to be an instance of Color. Cannot change color of this light.");
            return false;
        }
        this.#color = color;
        return true;
    }

    /**
     * Set the intensity of this light.
     * @param {number} intensity the light's new intensity - must be a value greater than 0.
     * @returns {boolean} true if the light's color was successfully set, false otherwise.
     */
    setIntensity(intensity) {
        if (typeof intensity !== 'number' || isNaN(intensity) || intensity < 0) {
            console.error("TypeError: Expected 'intensity' to be an number greater than 0. Cannot change intensity of this light.");
            return false;
        }
        this.#intensity = intensity;
        return true;
    }

    /**
     * Get this light's current emissive color
     * @returns {Color} this light's emissive color
     */
    getColor() {
        return this.#color.clone();
    }

    /**
     * Get this light's current intensity - a value between 0 and 1
     * @returns {number} this light's intensity
     */
    getIntensity() {
        return this.#intensity;
    }

    /**
     * Check if this light casts shadows
     * @returns {boolean} true if the light casts shadows, false otherwise
     */
    castsShadows() {
        return this.#castsShadows;
    }

    /**
     * Set whether this light casts shadows.
     * @param {boolean} castsShadows true if this light casts shadows, false otherwise
     */
    setCastShadowsEnabled(castsShadows) {
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
        this.#shadowMapResolution = new Vector2(width, height);
        return true;
    }

    /**
     * Retrieve this light's shadow map's current resolution
     * @returns {Vector2} a Vector2 istance where x is the width, and y is the height
     */
    getShadowMapResolution() {
        return this.#shadowMapResolution.clone();
    }

    /**
     * Retrieve this light's shadow map's bias
     * @param {number} bias the new shadow bias
     * @returns true if the shadow bias was successfully set, false otherwise
     */
    setShadowMapBias(bias) {
        if (typeof bias !== 'number' || isNaN(bias)) {
            console.error("TypeError: Expected 'bias' for shadow map to be a number. Cannot change bias of the shadow map for this light.");
            return false;
        }
        this.#shadowMapBias = bias;
        return true;
    }

    /**
     * Retrieve this light's shadow normal bias
     * @param {number} normalBias the new shadow normal bias
     * @returns true if the shadow normal bias was successfully set, false otherwise
     */
    setShadowNormalBias(normalBias) {
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
    getShadowMapBias() {
        return this.#shadowMapBias;
    }

    /**
     * Retrieve this light's shadow normal bias
     * @returns {number} the shadow normal bias
     */
    getShadowNormalBias() {
        return this.#shadowNormalBias;
    }

    /**
     * Retrieve the debug model of this light
     * @returns {Model} the debug model of this light
     */
    getDebugModel() {
        if (this._debugModel) {
            return this._debugModel; // TODO: need to implement clone method in Model class
        }
        console.error("Cannot retrieve debug model of abstract Light instance. Please instatiate a subclass to get the Light debug model. If this light is of type DIRECTIONAL, no model exists.");
        return null;
    }

    /**
     * Sets the debug model for this light.
     * @param {Model} debugModel the new debug model
     * @returns {boolean} true if the debug model was successfully set, false otherwise.
     */
    setDebugModel(debugModel) {
        if (!(debugModel instanceof Model)) {
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
    debugEnabled() {
        return this.#debugEnabled && this._lightType !== Light.DIRECTIONAL;
    }

    /**
     * Enable/disable this light's debug mode
     * @param {boolean} debug set to true to enable debug, false otherwise
     */
    setDebugEnabled(debug) {
        this.#debugEnabled = debug;
    }

    /**
     * Get the type of this light.
     * @returns {string} the light type.
     */
    getType() {
        if (this._lightType) {
            return this._lightType;
        }
        console.error("Cannot retrieve type of abstract Light instance. Please instatiate a subclass to get the Light type.");
        return '';
    }
}