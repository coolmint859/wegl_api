import Color from './color.js';
import MathUtils from './utils.js';

/**
 * Represents a 2D mathematical vector.
 */
export class Vector2 {
    /**
     * create a new Vector2 instance
     * @param {number} x the x coordinate
     * @param {number} y the y coordinate
     */
    constructor(x = 0.0, y = 0.0) {
        let shouldWarn = false;

        // Helper to check if a value is a valid number (not NaN)
        const isValidNum = (val) => typeof val === 'number' && !isNaN(val);

        // This section directly checks the *original* arguments provided by the user.
        // If an argument was provided but is not a valid number, set the warning flag and default its value.
        if (arguments.length > 0 && !isValidNum(x)) {
            shouldWarn = true;
            x = 0.0; // Force to 0.0 if invalid input
        }
        if (arguments.length > 1 && !isValidNum(y)) {
            shouldWarn = true;
            y = 0.0; // Force to 0.0 if invalid input
        }

        if (shouldWarn || (arguments.length > 0 && arguments.length < 2)) {
            console.warn("TypeError: Expected 'x', and 'y' to be numbers. One or more components were missing or of the wrong type. Assigning zero vector.");
        }

        // Assign the (potentially corrected or defaulted) values
        this.x = x;
        this.y = y;
    }

    /**
     * Creates a new Vector2 instance with all ones.
     * @returns {Vector2} a new Vector2 instance
     */
    static Ones() {
        return new Vector2(1.0, 1.0);
    }

    /**
     * Interpolates between two Vector2s
     * @param {Vector2} v1 the first vector
     * @param {Vector2} v2 the second vector
     * @param {number} t the blending parameter (clamped to be between 0 and 1)
     * @param {Function} easingFunc the easing function to use in interpolation (default is linear)
     * @returns {Vector2} the interpolated Vector2 instance
     */
    static interpolate(v1, v2, t, easingFunc = (t) => t) {
        if (!(v1 instanceof Vector2 && v2 instanceof Vector2)) {
            console.error(`TypeError: Expected 'v1' and 'v2' to be instances of Vector2. Cannot interpolate.`);
            return v1;
        } else if (typeof t !== 'number') {
            console.error(`TypeError: Expected 't' to be a number. Cannot interpolate.`);
            return v1;
        }
        if (typeof easingFunc !== 'function') {
            console.error(`Expected 'easingFunc' to be a function. Cannot interpolate.`);
            return v1;
        }

        const x = MathUtils.interpolate(v1.x, v2.x, t, easingFunc);
        const y = MathUtils.interpolate(v1.y, v2.y, t, easingFunc);
        return new Vector2(x, y);
    }

    /**
    * Creates a new Vector2 which is the addition of a Vector2 or number to this Vector2, component wise
    * @param {Vector2 | number} value the value to add
    * @returns {Vector2} the result of the addition
    */
    add(value) {
        if (value instanceof Vector2) {
            return new Vector2(this.x + value.x, this.y + value.y);
        } else if (typeof value === 'number') {
            return new Vector2(this.x + value, this.y + value);
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector2 instance. Cannot add to this vector.`);
            return this;
        }
    }

    /**
    * Creates a new Vector2 which is the subtraction of a Vector2 or number from this Vector2, component wise
    * @param {Vector2 | number} value the value to subtract
    * @returns {Vector2} the result of the subtraction
    */
    sub(value) {
        if (value instanceof Vector2) {
            return new Vector2(this.x - value.x, this.y - value.y);
        } else if (typeof value == 'number'){
            return new Vector2(this.x - value, this.y - value);
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector2 instance. Cannot subtract from this vector.`);
            return this;
        }
    }

    /**
    * Computes the negated form of this vector.
    * @returns {Vector2} the negated vector
    */
    negate() {
        return new Vector2(-this.x, -this.y);
    }

    /**
    * Creates a new Vector2 which is the multiplication of a Vector2 or number to this Vector2, component wise
    * @param {Vector2 | number} value the value to multiply
    * @returns {Vector2} the result of the multiplication
    */
    mult(value) {
        if (value instanceof Vector2) {
            return new Vector2(this.x * value.x, this.y * value.y);
        } else if (typeof value == 'number'){
            return new Vector2(this.x * value, this.y * value);
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector2 instance. Cannot multiply with this vector.`);
            return this;
        }
    }

    /**
    * Computes the dot product of this vector and another vector.
    * @param {Vector2} other the other vector
    * @returns {number} the result of the dot product
    */
    dot(other) {
        if (!(other instanceof Vector2)) {
            console.error(`TypeError: Expected 'other' to be a Vector2 instance. Cannot compute dot product.`);
            return 0;
        }
        return this.x * other.x + this.y * other.y;
    }

    /**
    * Computes the magnitude of this vector
    * @returns {number} the magitude
    */
    magnitude() {
        return Math.sqrt(this.dot(this));
    }

    /**
    * Computes the norm of this vector.
    * @returns {Vector2} the norm of this vector
    */
    normal() {
        let length = this.magnitude();

        // handle case if the vector has 0 length
        if (length === 0) return new Vector2();
        return this.mult(1.0/length);
    }

    /**
     * Computes the Euclidean distance between this vector and another vector
     * @param {Vector2} other the other vector
     * @returns {number} the distance between the vectors
     */
    distance(other) {
        if (!(other instanceof Vector2)) {
            console.error(`TypeError: Expected 'other' to be an instance of Vector2. Cannot compute distance.`);
            return 0;
        }
        return this.sub(other).magnitude();
    }

    /**
     * Compares this vector and another vector for equality within a tolerance.
     * @param {Vector2} other the other vector.
     * @param {number} [EPSILON = 0.00001] the tolerance threshold. Component values within +- this value are considered equal.
     * @returns {boolean} true if they are equal, false otherwise.
     */
    equals(other, EPSILON = 0.00001) {
        if (!(other instanceof Vector2)) return false;
        if (typeof EPSILON !== 'number' || EPSILON < 0) {
            console.warn("ValueError: Expected 'EPSILON' to be a number greater than or equal to 0. Using default tolerance of 0.00001.");
            EPSILON = 0.00001;
        }

        const sameX = Math.abs(this.x - other.x) < EPSILON;
        const sameY = Math.abs(this.y - other.y) < EPSILON;
        return sameX && sameY;
    }

    /**
    * Converts this vector to a string for display.
    * @returns {string} the string representation
    */
    str() {
        let x = Math.trunc(this.x * 100) / 100;
        let y = Math.trunc(this.y * 100) / 100;
        return "Vector2: (" + x + ", " + y + ")";
    }

    /**
     * Converts this vector to a 1-dimensional javascript array.
     * @returns {Array<number>} this vector as an array
     */
    asList() {
        return [this.x, this.y];
    }

    /**
     * Create a copy of this vector
     * @returns {Vector2} a new Vector2 instance with the same values as this one
     */
    clone() {
        return new Vector2(this.x, this.y);
    }
}

/**
 * Represents a 3D mathematical vector.
 */
export class Vector3 {
    /**
     * create a new Vector3 instance
     * @param {number} x the x coordinate
     * @param {number} y the y coordinate
     * @param {number} z the z coordinate
     */
    constructor(x = 0.0, y = 0.0, z = 0.0) {
        let shouldWarn = false;

        // Helper to check if a value is a valid number (not NaN)
        const isValidNum = (val) => typeof val === 'number' && !isNaN(val);

        // This section directly checks the *original* arguments provided by the user.
        // If an argument was provided but is not a valid number, set the warning flag and default its value.
        if (arguments.length > 0 && !isValidNum(x)) {
            shouldWarn = true;
            x = 0.0; // Force to 0.0 if invalid input
        }
        if (arguments.length > 1 && !isValidNum(y)) {
            shouldWarn = true;
            y = 0.0; // Force to 0.0 if invalid input
        }
        if (arguments.length > 2 && !isValidNum(z)) {
            shouldWarn = true;
            z = 0.0; // Force to 0.0 if invalid input
        }

        if (shouldWarn || (arguments.length > 0 && arguments.length < 3)) {
            console.warn("TypeError: Expected 'x', 'y', and 'z' to be numbers. One or more components were missing or of the wrong type. Assigning zero vector.");
        }

        // Assign the (potentially corrected or defaulted) values
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /**
     * Creates a new Vector3 instance with all ones.
     * @returns {Vector3} a new Vector3 instance
     */
    static Ones() {
        return new Vector3(1.0, 1.0, 1.0);
    }

    /**
     * Interpolates between two Vector3s
     * @param {Vector3} v1 the first vector
     * @param {Vector3} v2 the second vector
     * @param {number} t the blending parameter (clamped to be between 0 and 1)
     * @param {Function} easingFunc the easing function to use in interpolation (default is linear)
     * @returns {Vector3} the interpolated Vector3 instance
     */
    static interpolate(v1, v2, t, easingFunc = (t) => t) {
        if (!(v1 instanceof Vector3 && v2 instanceof Vector3)) {
            console.error(`TypeError: Expected 'v1' and 'v2' to be instances of Vector3. Cannot interpolate.`);
            return v1;
        } else if (typeof t !== 'number') {
            console.error(`TypeError: Expected 't' to be a number. Cannot interpolate.`);
            return v1;
        }
        if (typeof easingFunc !== 'function') {
            console.error(`Expected 'easingFunc' to be a function. Cannot interpolate.`);
            return v1;
        }

        const x = MathUtils.interpolate(v1.x, v2.x, t, easingFunc);
        const y = MathUtils.interpolate(v1.y, v2.y, t, easingFunc);
        const z = MathUtils.interpolate(v1.z, v2.z, t, easingFunc);
        return new Vector3(x, y, z);
    }

    /**
    * Creates a new Vector3 which is the addition of a Vector3 or number to this Vector3, component wise
    * @param {Vector3 | number} value the value to add
    * @returns {Vector3} the result of the addition
    */
    add(value) {
        if (value instanceof Vector3) {
            return new Vector3(
                this.x + value.x, 
                this.y + value.y,
                this.z + value.z,
            );
        } else if (typeof value == 'number') {
            return new Vector3(
                this.x + value, 
                this.y + value,
                this.z + value,
            );
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector3 instance. Cannot add to this vector.`);
            return this;
        }
    }

    /**
    * Creates a new Vector3 which is the subtraction of a Vector3 or number from this Vector3, component wise
    * @param {Vector3 | number} value the value to subtract
    * @returns {Vector3} the result of the subtraction
    */
    sub(value) {
        if (value instanceof Vector3) {
            return new Vector3(
                this.x - value.x, 
                this.y - value.y,
                this.z - value.z,
            );
        } else if (typeof value == 'number') {
            return new Vector3(
                this.x - value, 
                this.y - value,
                this.z - value,
            );
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector3 instance. Cannot subtract from this vector.`);
            return this;
        }
    }

    /**
    * Computes the negated form of this vector.
    * @returns {Vector3} the negated vector.
    */
    negate() {
        return new Vector3(-this.x, -this.y, -this.z);
    }

    /**
    * Creates a new Vector3 which is the multiplication of a Vector3 or number to this Vector3, component wise
    * @param {Vector3 | number} value the value to multiply
    * @returns {Vector3} the result of the multiplication
    */
    mult(value) {
        if (value instanceof Vector3) {
            return new Vector3(
                this.x * value.x, 
                this.y * value.y,
                this.z * value.z,
            );
        } else if (typeof value == 'number') {
            return new Vector3(
                this.x * value, 
                this.y * value,
                this.z * value,
            );
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector3 instance. Cannot multiply with this vector.`);
            return this;
        }
    }

    /**
    * Computes the dot product of this vector and another vector.
    * @param {Vector3} other the other vector
    * @returns {number} the result of the dot product
    */
    dot(other) {
        if (!(other instanceof Vector3)) {
            console.error(`TypeError: Expected 'other' to be a Vector3 instance. Cannot compute dot product.`);
            return 0;
        }
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    /**
    * Computes the cross product of this vector and another vector (result = this x other).
    * @param {Vector3} other the other vector
    * @returns {Vector3} the result of the cross product
    */
    cross(other) {
        if (!(other instanceof Vector3)) {
            console.error(`TypeError: Expected 'other' to be an instance of Vector3. Cannot compute cross product.`);
            return this;
        }

        let cx = this.y * other.z - this.z * other.y;
        let cy = this.z * other.x - this.x * other.z;
        let cz = this.x * other.y - this.y * other.x;
        return new Vector3(cx, cy, cz);
    }

    /**
    * Computes the magnitude of this vector
    * @returns {number} the magitude
    */
    magnitude() {
        return Math.sqrt(this.dot(this));
    }

    /**
    * Computes the norm of this vector.
    * @returns {Vector3} the norm of this vector
    */
    normal() {
        let length = this.magnitude();

        // handle case if the vector has 0 length
        if (length === 0) return new Vector3();
        return this.mult(1.0/length);
    }

    /**
     * Computes the Euclidean distance between this vector and another vector
     * @param {Vector3} other the other vector
     * @returns {number} the distance between the vectors
     */
    distance(other) {
        if (!(other instanceof Vector3)) {
            console.error(`TypeError: Expected 'other' to be an instance of Vector3. Cannot compute distance.`);
            return 0;
        }
        return this.sub(other).magnitude();
    }

    /**
     * Compares this vector and another vector for equality within a tolerance.
     * @param {Vector3} other the other vector.
     * @param {number} [EPSILON = 0.00001] the tolerance threshold. Component values within +- this value are considered equal.
     * @returns {boolean} true if they are equal, false otherwise.
     */
    equals(other, EPSILON = 0.00001) {
        if (!(other instanceof Vector3)) return false;
        if (typeof EPSILON !== 'number' || EPSILON < 0) {
            console.warn("ValueError: Expected 'EPSILON' to be a number greater than or equal to 0. Using default tolerance of 0.00001.");
            EPSILON = 0.00001;
        }

        const sameX = Math.abs(this.x - other.x) < EPSILON;
        const sameY = Math.abs(this.y - other.y) < EPSILON;
        const sameZ = Math.abs(this.z - other.z) < EPSILON;
        return sameX && sameY && sameZ;
    }

    /**
    * Converts this vector to a string for display.
    * @returns {string} the string representation
    */
    str() {
        let x = Math.trunc(this.x * 100) / 100;
        let y = Math.trunc(this.y * 100) / 100;
        let z = Math.trunc(this.z * 100) / 100;
        return "Vector3: (" + x + ", " + y + ", " + z + ")";
    }

    /**
     * Converts this vector to a 1-dimensional javascript array.
     * @returns {Array<number>} this vector as an array
     */
    asList() {
        return [this.x, this.y, this.z];
    }

    /**
     * Create a copy of this vector
     * @returns {Vector3} a new Vector3 instance with the same values as this one
     */
    clone() {
        return new Vector3(this.x, this.y, this.z);
    }
}

/**
 * Represents a 4D mathematical vector.
 */
export class Vector4 {
    /**
     * create a new Vector4 instance
     * @param {number} x the x coordinate
     * @param {number} y the y coordinate
     * @param {number} z the z coordinate
     * @param {number} w the w coordinate
     */
    constructor(x = 0.0, y = 0.0, z = 0.0, w = 0.0) {
        let shouldWarn = false;

        // Helper to check if a value is a valid number (not NaN)
        const isValidNum = (val) => typeof val === 'number' && !isNaN(val);

        // This section directly checks the *original* arguments provided by the user.
        // If an argument was provided but is not a valid number, set the warning flag and default its value.
        if (arguments.length > 0 && !isValidNum(x)) {
            shouldWarn = true;
            x = 0.0; // Force to 0.0 if invalid input
        }
        if (arguments.length > 1 && !isValidNum(y)) {
            shouldWarn = true;
            y = 0.0; // Force to 0.0 if invalid input
        }
        if (arguments.length > 2 && !isValidNum(z)) {
            shouldWarn = true;
            z = 0.0; // Force to 0.0 if invalid input
        }
        if (arguments.length > 3 && !isValidNum(w)) {
            shouldWarn = true;
            w = 0.0; // Force to 0.0 if invalid input
        }

        if (shouldWarn || (arguments.length > 0 && arguments.length < 4)) {
            console.warn("TypeError: Expected 'x', 'y', 'z', and 'w' to be numbers. One or more components were missing or of the wrong type. Assigning zero vector.");
        }

        // Assign the (potentially corrected or defaulted) values
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    /**
     * Creates a new Vector4 instance with all ones.
     * @returns {Vector4} a new Vector4 instance
     */
    static Ones() {
        return new Vector4(1.0, 1.0, 1.0, 1.0);
    }

    /**
     * Interpolates between two Vector4s
     * @param {Vector4} v1 the first vector
     * @param {Vector4} v2 the second vector
     * @param {number} t the blending parameter (clamped to be between 0 and 1)
     * @param {Function} easingFunc the easing function to use in interpolation (default is linear)
     * @returns {Vector4} the interpolated Vector4 instance
     */
    static interpolate(v1, v2, t, easingFunc = (t) => t) {
        if (!(v1 instanceof Vector4 && v2 instanceof Vector4)) {
            console.error(`TypeError: Expected 'v1' and 'v2' to be instances of Vector4. Cannot interpolate.`);
            return v1;
        } else if (typeof t !== 'number') {
            console.error(`TypeError: Expected 't' to be a number. Cannot interpolate.`);
            return v1;
        }
        if (typeof easingFunc !== 'function') {
            console.error(`Expected 'easingFunc' to be a function. Cannot interpolate.`);
            return v1;
        }

        const x = MathUtils.interpolate(v1.x, v2.x, t, easingFunc);
        const y = MathUtils.interpolate(v1.y, v2.y, t, easingFunc);
        const z = MathUtils.interpolate(v1.z, v2.z, t, easingFunc);
        const w = MathUtils.interpolate(v1.w, v2.w, t, easingFunc);
        return new Vector4(x, y, z, w);
    }

    /**
    * Creates a new Vector4 which is the addition of a Vector4 or number to this Vector4, component wise
    * @param {Vector4 | number} value the value to add
    * @returns {Vector4} the result of the addition
    */
    add(value) {
        if (value instanceof Vector4) {
            return new Vector4(
                this.x + value.x, 
                this.y + value.y,
                this.z + value.z,
                this.w + value.w
            );
        } else if (typeof value == 'number') {
            return new Vector4(
                this.x + value, 
                this.y + value,
                this.z + value,
                this.w + value
            );
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector4 instance. Cannot add to this vector.`);
            return this;
        }
    }

    /**
    * Creates a new Vector4 which is the subtraction of a Vector4 or number from this Vector4, component wise
    * @param {Vector4 | number} value the value to subtract
    * @returns {Vector4} the result of the subtraction
    */
    sub(value) {
        if (value instanceof Vector4) {
            return new Vector4(
                this.x - value.x, 
                this.y - value.y,
                this.z - value.z,
                this.w - value.w,
            );
        } else if (typeof value == 'number') {
            return new Vector4(
                this.x - value, 
                this.y - value,
                this.z - value,
                this.w - value
            );
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector4 instance. Cannot subtract from this vector.`);
            return this;
        }
    }

    /**
    * Computes the negated form of this vector.
    * @returns {Vector4} the negated vector.
    */
    negate() {
        return new Vector4(-this.x, -this.y, -this.z, -this.w);
    }

    /**
    * Creates a new Vector4 which is the multiplication of a Vector4 or number to this Vector4, component wise
    * @param {Vector4 | number} value the value to multiply
    * @returns {Vector4} the result of the multiplication
    */
    mult(value) {
        if (value instanceof Vector4) {
            return new Vector4(
                this.x * value.x, 
                this.y * value.y,
                this.z * value.z,
                this.w * value.w
            );
        } else if (typeof value == 'number') {
            return new Vector4(
                this.x * value, 
                this.y * value,
                this.z * value,
                this.w * value
            );
        } else {
            console.error(`TypeError: Expected 'value' to be a number or a Vector4 instance. Cannot multiply with this vector.`);
            return this;
        }
    }

    /**
    * Computes the dot product of this vector and another vector.
    * @param {Vector4} other the other vector
    * @returns {number} the result of the dot product
    */
    dot(other) {
        if (!(other instanceof Vector4)) {
            console.error(`TypeError: Expected 'other' to be a Vector4 instance. Cannot compute dot product.`);
            return 0;
        }
        return this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;
    }

    /**
    * Computes the norm of this vector.
    * @returns {Vector4} the norm of this vector
    */
    normal() {
        let length = this.magnitude();

        // handle case if the vector has 0 length
        if (length === 0) return new Vector4();
        return this.mult(1.0/length);
    }

    /**
    * Computes the magnitude of this vector
    * @returns {number} the magitude
    */
    magnitude() {
        return Math.sqrt(this.dot(this));
    }

    /**
     * Computes the Euclidean distance between this vector and another vector
     * @param {Vector4} other the other vector
     * @returns {number} the distance between the vectors
     */
    distance(other) {
        if (!(other instanceof Vector4)) {
            console.error(`TypeError: Expected 'other' to be an instance of Vector4. Cannot compute distance.`);
            return 0;
        }
        return this.sub(other).magnitude();
    }

    /**
     * Compares this vector and another vector for equality within a tolerance.
     * @param {Vector4} other the other vector.
     * @param {number} [EPSILON = 0.00001] the tolerance threshold. Component values within +- this value are considered equal.
     * @returns {boolean} true if they are equal, false otherwise.
     */
    equals(other, EPSILON = 0.00001) {
        if (!(other instanceof Vector4) || !(other instanceof Color)) {
            return false;
        }
        if (typeof EPSILON !== 'number' || EPSILON < 0) {
            console.warn("ValueError: Expected 'EPSILON' to be a number greater than or equal to 0. Using default tolerance of 0.00001.");
            EPSILON = 0.00001;
        }

        const sameX = Math.abs(this.x - other.x) < EPSILON;
        const sameY = Math.abs(this.y - other.y) < EPSILON;
        const sameZ = Math.abs(this.z - other.z) < EPSILON;
        const sameW = Math.abs(this.w - other.w) < EPSILON;
        return sameX && sameY && sameZ && sameW;
    }

    /**
    * Converts this vector to a string for display.
    * @returns {string} the string representation
    */
    str() {
        let x = Math.trunc(this.x * 100) / 100;
        let y = Math.trunc(this.y * 100) / 100;
        let z = Math.trunc(this.z * 100) / 100;
        let w = Math.trunc(this.w * 100) / 100;
        return "Vector4: (" + x + ", " + y + ", " + z + ", " + w + ")";
    }

    /**
     * Converts this vector to a 1-dimensional javascript array.
     * @returns {Array<number>} this vector as an array
     */
    asList() {
        return [this.x, this.y, this.z, this.w];
    }

    /**
     * Create a copy of this vector
     * @returns {Vector4} a new Vector4 instance with the same values as this one
     */
    clone() {
        return new Vector4(this.x, this.y, this.z, this.w);
    }
}
