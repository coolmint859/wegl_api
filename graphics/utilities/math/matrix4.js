import { Matrix3 } from "./matrix.js";
import Quaternion from "./quaternion.js";
import { Vector3, Vector4 } from "./vector.js";

/**
 * Represents a 4x4 mathematical matrix, row-major order
 */
export default class Matrix4 {
    #values;
    #size;

    constructor(values) {
        if (values === undefined) {
            this.#values = [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
            ];
        } else {
            this.#values = values.slice();
        }
        this.#size = 4;
    }

    /** 
     * Create a new Matrix4 from row vectors.
     */
    static fromRowVectors(row1, row2, row3, row4) {
        if (!(row1 instanceof Vector4 && row2 instanceof Vector4 && row3 instanceof Vector4 && row4 instanceof Vector4)) {
            console.error("One or more of the given values are not instances of Vector4. Cannot create matrix.");
            return new Matrix4();
        }

        let values = [
            row1.x, row1.y, row1.z, row1.w,
            row2.x, row2.y, row2.z, row2.w,
            row3.x, row3.y, row3.z, row3.w,
            row4.x, row4.y, row4.z, row4.w,
        ]
        return new Matrix4(values);
    }

    /** 
     * Create a new Matrix4 from column vectors.
     */
    static fromColumnVectors(col1, col2, col3, col4) {
        if (!(col1 instanceof Vector4 && col2 instanceof Vector4 && col3 instanceof Vector4 && col4 instanceof Vector4)) {
            console.error("One or more of the given values are not instances of Vector4. Cannot create matrix.");
            return new Matrix4();
        }

        let values = [
            col1.x, col2.x, col3.x, col4.x,
            col1.y, col2.y, col3.y, col4.y,
            col1.z, col2.z, col3.z, col4.z,
            col1.w, col2.w, col3.w, col4.w,
        ]
        return new Matrix4(values);
    }

    /**
     * "Promotes" a Matrix3 instance to a Matrix4 instance. All new values are zero except for last, which is 1.
     */
    static promoteFromMatrix3(matrix3) {
        if (!(matrix3 instanceof Matrix3)) {
            console.error(`${matrix3} is not an instance of Matrix3. Cannot promote matrix.`);
            return new Matrix4();
        }

        const m = matrix3.asList();
        return new Matrix4([
            m[0], m[1], m[2], 0,
            m[3], m[4], m[5], 0,
            m[6], m[7], m[8], 0,
            0, 0, 0, 1
        ]);
    }

    /**
     * Calculates a view matrix given an eye, target, and up vector.
     * @param {Vector3} eye the position of the viewer in world space
     * @param {Vector3} target the position of the object the viewer should look at
     * @param {Vector3} up the world space up vector (typically (0, 1, 0));
     * @returns a 4x4 matrix that converts world space coordinates into view space
     */
    static lookAt(eye, target, up) {
        // calculate viewer's x y and z axis
        const viewF = target.sub(eye).normal();
        const viewR = up.cross(viewF).normal();
        const viewU = viewF.cross(viewR);

        console.log({viewF, viewR, viewU})

        // Calculate the translation components of the view matrix.
        const tx = -viewR.dot(eye);
        const ty = -viewU.dot(eye);
        const tz = -viewF.dot(eye);

        // Construct the view matrix with the axis and position
        return new Matrix4([
            viewR.x, viewR.y, viewR.z, tx,
            viewU.x, viewU.y, viewU.z, ty,
            viewF.x, viewF.y, viewF.z, tz,
            0, 0, 0, 1
        ]);
    }

    /** 
     * Set the value at the given row and column to the given value.
     */
    set(row, col, value) {
        if (row < 0 || row >= this.#size || col < 0 || col >= this.#size) {
            console.error(`IndexError: Out of bounds row or column index. Cannot set value.`);
            return;
        } else if (typeof value != 'number') {
            console.error(`TypeError: ${value} is not a number type. Cannot set value.`);
            return;
        }
        this.#values[row * this.#size + col] = value;
    }

    /** 
     * Set the values for this matrix.
     */
    setAll(values) {
        if (!(values instanceof Array && values.length === 16)) {
            console.error(`Values are not a 16-component javascript Array, cannot set matrix values.`);
        }

        const newValues = values.slice();
        for (let i = 0; i < this.#size * this.#size; i++) {
            this.#values[i] = newValues[i];
        }
        return this;
    }

    /** 
     * Obtain the value in this matrix at the specified row and column.
     */
    valueAt(row, col) {
        return this.#values[row * this.#size + col];
    }

    /** 
     * Obtain the transpose of this matrix. If inPlace is true (false by default), then sets this
     * matrix as the resulting matrix.
     */
    transpose(inPlace = false) {
        let m = this.#values;
        let t = [
            m[0], m[4], m[8], m[12],
            m[1], m[5], m[9], m[13],
            m[2], m[6], m[10], m[14],
            m[3], m[7], m[11], m[15]
        ];

        if (inPlace) {
            this.setAll(t);
        } else {
            return new Matrix4(t);
        }
    }

    /**
     * Multiply this matrix with another. If inPlace is true (false by default), then sets this
     * matrix as the resulting matrix.
     */
    multiply(other, inPlace = false) {
        if (!(other instanceof Matrix4)) {
            console.error('Other is not of type \'Matrix4\'. Aborting multiplication.');
            return this;
        }

        let m1 = this.#values;
        let m2 = other.#values;
        let m3 = [
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0
        ];

        // "Optimized" manual multiplication
        m3[0] = m1[0] * m2[0] + m1[1] * m2[4] + m1[2] * m2[8] + m1[3] * m2[12];
        m3[1] = m1[0] * m2[1] + m1[1] * m2[5] + m1[2] * m2[9] + m1[3] * m2[13];
        m3[2] = m1[0] * m2[2] + m1[1] * m2[6] + m1[2] * m2[10] + m1[3] * m2[14];
        m3[3] = m1[0] * m2[3] + m1[1] * m2[7] + m1[2] * m2[11] + m1[3] * m2[15];

        m3[4] = m1[4] * m2[0] + m1[5] * m2[4] + m1[6] * m2[8] + m1[7] * m2[12];
        m3[5] = m1[4] * m2[1] + m1[5] * m2[5] + m1[6] * m2[9] + m1[7] * m2[13];
        m3[6] = m1[4] * m2[2] + m1[5] * m2[6] + m1[6] * m2[10] + m1[7] * m2[14];
        m3[7] = m1[4] * m2[3] + m1[5] * m2[7] + m1[6] * m2[11] + m1[7] * m2[15];

        m3[8] = m1[8] * m2[0] + m1[9] * m2[4] + m1[10] * m2[8] + m1[11] * m2[12];
        m3[9] = m1[8] * m2[1] + m1[9] * m2[5] + m1[10] * m2[9] + m1[11] * m2[13];
        m3[10] = m1[8] * m2[2] + m1[9] * m2[6] + m1[10] * m2[10] + m1[11] * m2[14];
        m3[11] = m1[8] * m2[3] + m1[9] * m2[7] + m1[10] * m2[11] + m1[11] * m2[15];

        m3[12] = m1[12] * m2[0] + m1[13] * m2[4] + m1[14] * m2[8] + m1[15] * m2[12];
        m3[13] = m1[12] * m2[1] + m1[13] * m2[5] + m1[14] * m2[9] + m1[15] * m2[13];
        m3[14] = m1[12] * m2[2] + m1[13] * m2[6] + m1[14] * m2[10] + m1[15] * m2[14];
        m3[15] = m1[12] * m2[3] + m1[13] * m2[7] + m1[14] * m2[11] + m1[15] * m2[15];

        if (inPlace) {
            this.setAll(m3);
        } else {
            return new Matrix4(m3);
        }
    }

    /**
     * Transforms a vector using this matrix
     * @param {Vector4} vector the vector to transform
     * @returns {Vector4} the transformed vector
     */
    transform(vector) {
         if (!(vector instanceof Vector4)) {
            console.error(`Other is not of type 'Vector4'. Aborting multiplication.`);
            return new Vector4();
        }

        const mat = this.#values;
        
        const x = vector.x * mat[0] + vector.y * mat[1] + vector.z * mat[2] + vector.w * mat[3];
        const y = vector.x * mat[4] + vector.y * mat[5] + vector.z * mat[6] + vector.w * mat[7];
        const z = vector.x * mat[8] + vector.y * mat[9] + vector.z * mat[10] + vector.w * mat[11];
        const w = vector.x * mat[12] + vector.y * mat[13] + vector.z * mat[14] + vector.w * mat[15];

        return new Vector4(x, y, z, w);
    }

    /**
     * Returns true if all elements in the given Matrix4 are equal to the elements in this Matrix4, false otherwise.
     */
    equals(other, EPSILON = 0.0001) {
        if (!(other instanceof Matrix4)) return false;
        if (typeof EPSILON !== 'number' || EPSILON < 0) {
            console.warn("ValueError: Expected 'EPSILON' to be a number greater than or equal to 0. Using default tolerance of 0.00001.");
            EPSILON = 0.00001;
        }

        const otherValues = other.asList();
        for (let i = 0; i < this.#size * this.#size; i++) {
            if (Math.abs(otherValues[i] - this.#values[i]) > EPSILON) {
                return false;
            }
        }
        return true;
    }

    /**
     * Extract the 3x3 rotation Matrix from this matrix. Assumes no shearing or scaling.
     * @returns {Matrix3} Matrix3 of just the rotation of this matrix
     */
    rotationMatrix() {
        const m = this.asList();
        return new Matrix3([
            m[0], m[1], m[2],
            m[4], m[5], m[6],
            m[8], m[9], m[10]
        ])
    }

    /**
     * Retreive this matrix as a 1D list.
     */
    asList() {
        return this.#values.slice();
    }

    /**
     * Clone this matrix into a new Matrix
     */
    clone() {
        let clonedValues = this.#values.slice();
        return new Matrix4(clonedValues);
    }

    toString() {
        let matStr = "Matrix4x4";
        for (let i = 0; i < this.#values.length; i++) {
            if (i % this.#size === 0) {
                matStr = matStr.concat('|\n|');
            }
            matStr = matStr.concat(`${this.#values[i].toFixed(4)} `);
        }
        return matStr.concat('|');
    }

    /**
     * Create a 4x4 scaling matrix given a scaling vector.
     */
    static scalar(scaleVector) {
        if (!(scaleVector instanceof Vector3)) {
            console.error('Other is not of type \'Vector3\'. Cannot calculate scaling matrix from given value.');
            return new Matrix4();
        }

        return new Matrix4([
            scaleVector.x, 0, 0, 0,
            0, scaleVector.y, 0, 0,
            0, 0, scaleVector.z, 0,
            0, 0, 0, 1,
        ]);
    }

    /**
     * Create a 4x4 translation matrix given a translation vector.
     */
    static translation(translateVector) {
        if (!(translateVector instanceof Vector3)) {
            console.error('Other is not of type \'Vector3\'. Cannot calculate translation matrix from given value.');
            return new Matrix4();
        }

        return new Matrix4([
            1, 0, 0, translateVector.x,
            0, 1, 0, translateVector.y,
            0, 0, 1, translateVector.z,
            0, 0, 0, 1,
        ]);
    }

    /**
     * Creates a 4x4 rotation matrix from a quaternion.
     */
    static rotation(quaternion) {
        if (!(quaternion instanceof Quaternion)) {
            console.error('TypeError: Input is not of type \'Quaternion\'. Cannot create rotation matrix.');
            return new Matrix4(); // Return identity matrix on error
        }

        // Get the 3x3 rotation matrix from the Quaternion
        const mat3Rotation = Matrix3.rotate(quaternion);
        const m = mat3Rotation.asList(); // Get the 1D array of 3x3 values

        // Construct the 4x4 matrix from the 3x3 rotation and identity translation/homogeneous components
        return new Matrix4([
            m[0], m[1], m[2], 0,
            m[3], m[4], m[5], 0,
            m[6], m[7], m[8], 0,
            0,    0,    0,    1
        ]);
    }

    /**
     * Create a combined 4x4 transformation matrix
     */
    static STR4(translateVector, rotationQuaternion, scaleVector) {
        if (!(translateVector instanceof Vector3 && rotationQuaternion instanceof Quaternion && scaleVector instanceof Vector3)) {
            console.error("One or more provided values are not of type 'Vector3'. Unable to create TRS matrix from values.");
            return new Matrix4();
        }

        const translation = Matrix4.translation(translateVector);
        const rotation = Matrix4.rotation(rotationQuaternion);
        const scale = Matrix4.scalar(scaleVector);

        return translation.multiply(rotation).multiply(scale);
    }

    /**
     * Create a general 4x4 perspective projection matrix. Right handed.
     */
    static perspectiveProj(t, b, r, l, n, f) {
        return new Matrix4([
            (2*n)/(r-l), 0, -(r+l)/(r-l), 0,
            0, (2*n)/(t-b), -(t+b)/(t-b), 0,
            0, 0, -(f+n)/(f-n), -(2*f*n)/(f-n),
            0, 0, -1, 0
        ]);
    }

    /**
     * Create a 4x4 symmetic perspective projection matrix. Right handed.
     */
    static perspectiveProjSymmetic(fovAngle, aspect, n, f) {
        let top = Math.tan(fovAngle/2.0);
        let right = aspect*top;

        return new Matrix4([
            1 / right, 0, 0, 0,
            0, 1 / top, 0, 0,
            0, 0, -(f+n)/(f-n), -(2*f*n)/(f-n),
            0, 0, -1, 0
        ]);
    }

    /**
     * Create a 4x4 orthographic projection matrix. Right handed.
     */
    static orthogaphicProj(t, b, r, l, n, f) {
        return new Matrix4([
            2/(r-l), 0, 0, -(r+l)/(r-l),
            0, 2/(t-b), 0, -(t+b)/(t-b),
            0, 0, -2/(f-n), -(f+n)/(f-n),
            0, 0, 0, 1
        ]);
    }
}