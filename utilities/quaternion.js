import { Vector3 } from './vector.js';
import { Matrix4 } from './matrix.js';

/** Used for converting euler angles into quaternions and vice versa */
export const EulerOrder = Object.freeze({
    XYZ: 'XYZ',
    XZY: 'XZY',
    YXZ: 'YXZ',
    YZX: 'YZX',
    ZXY: 'ZXY',
    ZYX: 'ZYX'
});

/** 
 * Representes a 4D complex number, useful for 3D rotations 
 * */
export default class Quaternion {
    /**
     * create a new Quaternion instance
     * @param {number} w the scalar coordinate
     * @param {number} x the i-hat coordinate
     * @param {number} y the j-hat coordinate
     * @param {number} z the k-hat coordinate
     */
    constructor(w = 1.0, x = 0.0, y = 0.0, z = 0.0) {
        let shouldWarn = false;

        const isValidNum = (val) => typeof val === 'number' && !isNaN(val);

        // This section directly checks the *original* arguments provided by the user.
        // If an argument was provided but is not a valid number, set the warning flag and default its value.
        if (arguments.length > 0 && !isValidNum(w)) {
            shouldWarn = true;
            w = 1.0; // Force to 1.0 if invalid input
        }
        if (arguments.length > 1 && !isValidNum(x)) {
            shouldWarn = true;
            x = 0.0; // Force to 0.0 if invalid inputz
        }
        if (arguments.length > 2 && !isValidNum(y)) {
            shouldWarn = true;
            y = 0.0; // Force to 0.0 if invalid input
        }
        if (arguments.length > 3 && !isValidNum(z)) {
            shouldWarn = true;
            z = 0.0; // Force to 0.0 if invalid input
        }

        if (shouldWarn || (arguments.length > 0 && arguments.length < 4)) {
            console.warn("TypeError: Expected 'x', 'y', 'z', and 'w' to be numbers. One or more components were missing or of the wrong type. Assigning unit quaternion.");
        }

        // Assign the (potentially corrected or defaulted) values
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /** 
     * Creates a Quaternion from a rotation axis and an angle.
     * @param {Vector3} axis the axis to rotate about
     * @param {number} angle the angle to rotate in radians
     * @returns {Quaternion} a new Quaternion instance.
     */
    static fromAxisAngle(axis, angle) {
        if (!(axis instanceof Vector3 && typeof angle === 'number')) {
            console.error("Either 'axis' is not of type Vector3 or 'angle' is not a number. Cannot create Quaternion from provided values.");
            return new Quaternion(); // return identity quaternion.
        }
        const halfAngle = angle/2.0;
        const norm_axis = axis.clone().normal();

        const w = Math.cos(halfAngle);
        const dir = norm_axis.mult(Math.sin(halfAngle));

        return new Quaternion(w, dir.x, dir.y, dir.z);
    }

    /**
     * Create a Quaternion from Euler angles
     * @param {number} pitch the x-axis rotation angle in radians
     * @param {number} yaw the y-axis rotation angle in radians
     * @param {number} roll the z-axis rotation angle in radians
     * @param {EulerOrder} order the order of rotations to apply
     * @returns {Quaternion} a new Quaternion instance
     */
    static fromEulerAngles(pitch, yaw, roll, order = EulerOrder.XYZ) {
        if (typeof pitch != 'number' || typeof yaw != 'number' || typeof roll != 'number') {
            console.error("TypeError: Expected pitch, yaw, and roll to be numbers, but one of them isn't. Cannot create Quaternion from provided values.");
            return new Quaternion(); // return identity quaternion.
        }
        const halfPitch = pitch/2.0;
        const halfYaw = yaw/2.0;
        const halfRoll = roll/2.0;

        // calculate basis quaternions
        const xQuat = new Quaternion(Math.cos(halfPitch), Math.sin(halfPitch), 0, 0);
        const yQuat = new Quaternion(Math.cos(halfYaw), 0, Math.sin(halfYaw), 0);
        const zQuat = new Quaternion(Math.cos(halfRoll), 0, 0, Math.sin(halfRoll));

        // return the combined rotation depending on the order
        switch (order) {
            case EulerOrder.XZY:
                return xQuat.mult(zQuat).mult(yQuat);
            case EulerOrder.YXZ:
                return yQuat.mult(xQuat).mult(zQuat);
            case EulerOrder.YZX:
                return yQuat.mult(zQuat).mult(xQuat);
            case EulerOrder.ZXY:
                return zQuat.mult(xQuat).mult(yQuat);
            case EulerOrder.ZYX:
                return zQuat.mult(yQuat).mult(xQuat);
            default:
                return xQuat.mult(yQuat).mult(zQuat);
        }
    }

    /**
     * Creates a Quaternion from a forward and up vector (RHS)
     * @param {Vector3} forward a vector that represents the forward direction
     * @param {Vector3} up the world space up vector (typically (0, 1, 0))
     * @returns {Quaternion} A new Quaternion instance
     */
    static fromForwardUp(forward, up) {
        if (!(forward instanceof Vector3 && up instanceof Vector3)) {
            console.error("TypeError: Expected 'forward' and 'up' to be instances of Vector3, but one of them isn't. Cannot create Quaternion from provided values.");
            return new Quaternion(); // return identity quaternion.
        }
        
        // Ensure input vectors are normalized
        const forward_norm = forward.clone().normal();
        const up_norm = up.clone().normal();

        // Calculate the camera's right and up vectors
        const right = up_norm.cross(forward_norm).normal();
        const trueUp = forward_norm.cross(right).normal();

        // construct rotation matrix
        const rotationMatrix = new Matrix3([
            right.x, trueUp.x, forward_norm.x,
            right.y, trueUp.y, forward_norm.y,
            right.z, trueUp.z, forward_norm.z
        ])

        // convert matrix into quaternion
        return this.fromRotationMatrix(rotationMatrix);
    }

    /** 
     * Creates a Quaternion from a 3x3 or 4x4 rotation matrix
     * @param {Matrix3 | Matrix4} matrix The 3x3 or 4x4 rotation matrix to convert into a quaternion. If 4x4 matrix, the last row and column are ignored.
     * @returns A new Quaternion instance
     */
    static fromRotationMatrix(matrix) {
        let m00, m01, m02, m10, m11, m12, m20, m21, m22;
        if (matrix instanceof Matrix3) {
            let values = matrix.asList();
            m00 = values[0]; m01 = values[1]; m02 = values[2]; 
            m10 = values[3]; m11 = values[4]; m12 = values[5]; 
            m20 = values[6]; m21 = values[7]; m22 = values[8];
        } else if (matrix instanceof Matrix4) {
            let values = matrix.asList();
            m00 = values[0]; m01 = values[1]; m02 = values[2];
            m10 = values[4]; m11 = values[5]; m12 = values[6];
            m20 = values[8]; m21 = values[9]; m22 = values[10];
        } else {
            console.error("'matrix' is not of type Matrix3 or Matrix4. Cannot create Quaternion from provided value.");
            return new Quaternion(); // return identity quaternion.
        }

        let x, y, z, w; // Quaternion components

        // Calculate the trace of the 3x3 rotation sub-matrix.
        const trace = m00 + m11 + m22;

        // Case 1: If the trace is positive, the W component (scalar part) is the largest.
        if (trace > 0) {
            const s = 0.5 / Math.sqrt(trace + 1.0);
            w = 0.25 / s;
            x = (m21 - m12) * s;
            y = (m02 - m20) * s;
            z = (m10 - m01) * s;
        }
        // If the trace is not positive, one of the diagonal elements (m00, m11, m22)
        else if (m00 > m11 && m00 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
            x = 0.25 * s;
            y = (m01 + m10) / s;
            z = (m02 + m20) / s;
            w = (m21 - m12) / s;
        }
        // Check if m11 is the largest diagonal element.
        else if (m11 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
            y = 0.25 * s;
            x = (m01 + m10) / s;
            z = (m12 + m21) / s;
            w = (m02 - m20) / s;
        }
        // If neither m00 nor m11 is the largest, then m22 must be the largest.
        else {
            const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
            z = 0.25 * s;
            x = (m02 + m20) / s;
            y = (m12 + m21) / s;
            w = (m10 - m01) / s;
        }

        // create new quaternion from components.
        return new Quaternion(w, x, y, z);
    }

    /**
    * Computes the norm of this quaternion.
    * @returns {Quaternion} the norm of this quaternion
    */
    normal() {
        const length = this.magnitude();

        // handle case if the length is 0 (unlikely, but possible)
        if (length === 0) return new Quaternion(0, 0, 0, 0);

        // otherwise return new quaternion
        return new Quaternion(
            this.w / length,
            this.x / length,
            this.y / length,
            this.z / length
        )
    }

    /**
    * Computes the magnitude of this quaternion
    * @returns {number} the magitude
    */
    magnitude() {
        return Math.sqrt(this.dot(this));
    }

    /**
     * Calculates the conjugate of this quaternion. 
     * @returns {Quaternion} the conjugate
     */
    conjugate() {
        return new Quaternion(this.w, -this.x, -this.y, -this.z);
    }

    /**
     * Calculates the inverse of this quaternion.
     * @returns {Quaternion} this quaternion but inverted.
     */
    inverse() {
        const squareMag = this.dot(this);
        if (squareMag === 0) {
            console.warn("ValueError: Attempted to invert a zero-magnitude quaternion. Aborting.");
            return new Quaternion();
        }

        const conjugate = this.conjugate()
        return new Quaternion(
            conjugate.w / squareMag,
            conjugate.x / squareMag,
            conjugate.y / squareMag,
            conjugate.z / squareMag
        )
    }

    /**
    * Multiplies this quaternion by another quaternion (result = this * other).
    * @returns {Quaternion} the result of the multiplication.
    */
    mult(other) {
        if (other instanceof Quaternion) {
            const w = this.w * other.w - this.x * other.x - this.y * other.y - this.z * other.z;
            const x = this.w * other.x + this.x * other.w + this.y * other.z - this.z * other.y;
            const y = this.w * other.y - this.x * other.z + this.y * other.w + this.z * other.x;
            const z = this.w * other.z + this.x * other.y - this.y * other.x + this.z * other.w;
            return new Quaternion(w, x, y, z);
        } else {
            console.error(`TypeError: ${other} is not a Quaternion. Cannot multiply with this quaternion.`);
            return this;
        }
    }

    /**
     * Rotates the given vector using this quaternion.
     * @returns {Vector3} the original vector rotated by this quaternion, not in place
     */
    rotateVector(vector) {
        if (!(vector instanceof Vector3)) {
            console.error(`TypeError: ${vector} is not an instance of Vector3, cannot rotate.`);
            return new Vector3(); // Return identity or throw
        }

        // Create a pure quaternion from the vector
        const vPure = new Quaternion(0.0, vector.x, vector.y, vector.z);

        // Apply rotation: q * v_pure * q_inverse
        const rotatedQPure = this.mult(vPure).mult(this.inverse());

        // Extract the vector part from the resulting quaternion
        return new Vector3(rotatedQPure.x, rotatedQPure.y, rotatedQPure.z);
    }

    /**
    * Computes the dot product of this quaternion and another quaternion.
    * @param {Quaternion} other the other quaternion
    * @returns {number} the result of the dot product
    */
    dot(other) {
        if (!(other instanceof Quaternion)) {
            console.error(`TypeError: ${other} is not an instance of Quaternion, cannot compute dot product.`);
            return 0.0;
        }

        return this.w * other.w + this.x * other.x + this.y * other.y + this.z * other.z;
    }

    /**
     * Compares this quaternion and another quaternion for equality within a tolerance.
     * @param {Quaternion} other the other quaternion.
     * @param {number} [EPSILON = 0.00001] the tolerance threshold. Component values within +- this value are considered equal.
     * @returns {boolean} true if they are equal, false otherwise.
     */
    equals(other, EPSILON = 0.00001) {
        if (!(other instanceof Quaternion)) return false;
        if (typeof EPSILON !== 'number' || EPSILON < 0) {
            console.warn("ValueError: Expected 'EPSILON' to be a number greater than or equal to 0. Using default tolerance of 0.00001.");
            EPSILON = 0.00001;
        }

        const sameW = Math.abs(this.w - other.w) < EPSILON;
        const sameX = Math.abs(this.x - other.x) < EPSILON;
        const sameY = Math.abs(this.y - other.y) < EPSILON;
        const sameZ = Math.abs(this.z - other.z) < EPSILON;

        if (sameX && sameY && sameZ && sameW) {
            return true;
        }

        // negated quaternions are equivalent rotations in 3D space
        const negSameW = Math.abs(this.w + other.w) < EPSILON;
        const negSameX = Math.abs(this.x + other.x) < EPSILON;
        const negSameY = Math.abs(this.y + other.y) < EPSILON;
        const negSameZ = Math.abs(this.z + other.z) < EPSILON;

        if (negSameW && negSameX && negSameY && negSameZ) {
            return true;
        }

        // if not same regardless of negation, return false
        return false;
    }

    /**
     * Create a copy of this quaternion
     * @returns {Quaternion} a new Quaternion instance with the same values as this one
     */
    clone() {
        return new Quaternion(this.w, this.x, this.y, this.z);
    }

    /**
    * Converts this quaternion to a string for display.
    * @returns {string} the string representation
    */
    str() {
        let x = Math.trunc(this.x * 100) / 100;
        let y = Math.trunc(this.y * 100) / 100;
        let z = Math.trunc(this.z * 100) / 100;
        let w = Math.trunc(this.w * 100) / 100;
        return "Quaternion: (" + w + ", " + x + "i, " + y + "j, " + z + "k)";
    }

    /**
     * Spherically interpolate between two quaternions
     * @param {Quaternion} v1 the first quaternion
     * @param {Quaternion} v2 the second quaternion
     * @param {number} t the blending parameter (clamped to be between 0 and 1)
     * @param {EasingFunc} easingFunc the easing function to interpolate with
     * @returns {Quaternion} the interpolated Quaternion instance
     */
    static slerp(q1, q2, t, easingFunc = EasingFunc.LINEAR) {
        if (!(q1 instanceof Quaternion && q2 instanceof Quaternion)) {
            console.error(`TypeError: Expected 'q1' and 'q2' to be instances of Quaternion. Cannot interpolate.`);
            return new Quaternion();
        } else if (typeof t !== 'number') {
            console.error(`TypeError: Expected 't' to be a number. Cannot interpolate.`);
            return q1;
        }
        // calculate the eased p parameter
        const p = interpolate(0, 1, t, easingFunc);

        let dot = q1.dot(q2);

        // Ensure the shortest path (handle double cover)
        if (dot < 0) {
            q2 = new Quaternion(-q2.w, -q2.x, -q2.y, -q2.z);
            dot = -dot;
        }

        const EPSILON = 0.000001; // Small epsilon to handle nearly identical quaternions
        if (dot > 1.0 - EPSILON) {
            // If quaternions are very close, just linearly interpolate
            return new Quaternion(
                lerp(q1.w, q2.w, p),
                lerp(q1.x, q2.x, p),
                lerp(q1.y, q2.y, p),
                lerp(q1.z, q2.z, p),
            ).normal();
        }

        // otherwise apply spherical interpolation
        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);

        const scale0 = Math.sin((1 - p) * theta) / sinTheta;
        const scale1 = Math.sin(p * theta) / sinTheta;

        return new Quaternion(
            scale0 * q1.w + scale1 * q2.w,
            scale0 * q1.x + scale1 * q2.x,
            scale0 * q1.y + scale1 * q2.y,
            scale0 * q1.z + scale1 * q2.z
        );
    }
}