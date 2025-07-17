class DirectLight extends Light {
    #direction;

    /**
     * Create a new DirectionalLight instance
     * @param {Color} color the emissive color of the light
     * @param {number} intensity the intensity of the light
     * @param {Vector3} direction the direction of the light
     */
    constructor(color, intensity, direction) {
        super(color, intensity);

        let directionVector;
        if (!(direction instanceof Vector3)) {
            console.error("Expected 'direction' to be an instance of Vector3. Assigning default direction.");
            directionVector = new Vector3(0, -1, 0); // point straight down
        } else {
            directionVector = direction.clone();
        }

        this.#direction = directionVector.normal();
        this._lightType = Light.DIRECTIONAL;
    }

    /**
     * Get this DirectionalLight's current direction vector
     * @returns {Vector3} the direction vector
     */
    getDirection() {
        return this.#direction.clone();
    }

    /**
     * Set this DirectionalLight's direction vector. Is normalized before storing.
     * @param {Vector3} direction the new direction vector
     * @returns {boolean} true if the direction vector was successfully set, false otherwise.
     */
    setDirection(direction) {
        if (!(direction instanceof Vector3)) {
            console.error("Expected 'direction' to be an instance of Vector3. Assigning default direction.");
            return false;
        }
        this.#direction = direction.clone().normal();
        return true;
    }
}