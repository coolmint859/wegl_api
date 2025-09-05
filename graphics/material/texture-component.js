import { Vector2, Vector3, Vector4 } from "../../utilities/math/vector.js";
import MaterialComponent from "./material-component.js";

export default class VectorComponent extends MaterialComponent {
    #vector;

    /**
     * Create a new material vector component
     * @param {string} name the name of the vector component
     * @param {Vector2 | Vector3 | Vector4} vector the vector to store in the component
     */
    constructor(name, texturePath) {
        super(name);
        if (!this.validProperty(value)) {
            console.warn(`[VectorComponent] Expected 'vector' to be an instance of Vector2, Vector3 or Vector4. Setting default (Vector3(0, 0, 0))`)
            this.#vector = new Vector3();
        } else {
            this.#vector = vector;
        }
    }

    /**
     * Set the property of this vector component.
     * @param {Vector2 | Vector3 | Vector4} property the vector property to set.
     */
    set(property) {
        if (!this.validProperty(property)) {
            console.warn(`[VectorComponent] Expected 'property' to be an instance of Vector2, Vector3 or Vector4. Unable to set property.`)
        } else {
            this.#vector = property;
        }
    }

    /**
     * Get the property of this vector component.
     * @param {Vector2 | Vector3 | Vector4} property 
     */
    get() {
        return this.#vector;
    }

    /**
     * Check if the provided property is valid for this material component
     * @param {any} property the property to check
     * @returns {boolean} true if the property is a valid type, false otherwise
     */
    validProperty(property) {
        const isVector2 = property instanceof Vector2;
        const isVector3 = property instanceof Vector3;
        const isVector4 = property instanceof Vector4;
        return isVector2 || isVector3 || isVector4;
    }
}