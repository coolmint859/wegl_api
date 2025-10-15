import { Vector2, Vector3, Vector4 } from './vector.js';
import Quaternion from './quaternion.js';

/**
 * Represents a 3x3 mathematical matrix, row-major order
 */
export class Matrix3 {
    #values;
    #size;

    constructor(values) {
        if (values === undefined) {
            this.#values = [
                1, 0, 0,
                0, 1, 0,
                0, 0, 1,
            ];
        } else {
            this.#values = values.slice();
        }
        this.#size = 3;
    }

    /** 
     * Create a new Matrix3 from row vectors.
     */
    static fromRowVectors(row1, row2, row3) {
        if (!(row1 instanceof Vector3 && row2 instanceof Vector3 && row3 instanceof Vector3)) {
            console.error("One or more of the given values are not instances of Vector3. Cannot create matrix.");
            return new Matrix3();
        }

        let values = [
            row1.x, row1.y, row1.z,
            row2.x, row2.y, row2.z,
            row3.x, row3.y, row3.z
        ]
        return new Matrix3(values);
    }

    /** 
     * Create a new Matrix3 from column vectors.
     */
    static fromColumnVectors(col1, col2, col3) {
        if (!(col1 instanceof Vector3 && col2 instanceof Vector3 && col3 instanceof Vector3)) {
            console.error("One or more of the given values are not instances of Vector3. Cannot create matrix.");
            return new Matrix3();
        }

        let values = [
            col1.x, col2.x, col3.x,
            col1.y, col2.y, col3.y,
            col1.z, col2.z, col3.z
        ]
        return new Matrix3(values);
    }

    /**
     * "Promotes" a Matrix2 instance to a Matrix3 instance. All new values are zero except for last, which is 1.
     */
    static promoteFromMatrix2(matrix2) {
        if (!(matrix2 instanceof Matrix2)) {
            console.error(`${matrix2} is not an instance of Matrix2. Cannot promote matrix.`);
            return new Matrix3();
        }

        const m = matrix2.asList();
        return new Matrix3([
            m[0], m[1], 0,
            m[2], m[3], 0,
            0, 0, 1
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
        if (!(values instanceof Array && values.length === 9)) {
            console.error(`${values} is not a 9-component javascript Array, cannot set matrix values.`);
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
            m[0], m[3], m[6],
            m[1], m[4], m[7],
            m[2], m[5], m[8]
        ];

        if (inPlace) {
            this.setAll(t);
            return this;
        } else {
            return new Matrix3(t);
        }
    }

    /**
     * Multiply this matrix with another. If inPlace is true (false by default), then sets this
     * matrix as the resulting matrix.
     */
    multiply(other, inPlace = false) {
        if (!(other instanceof Matrix3)) {
            console.error('Other is not of type \'Matrix3\'. Aborting multiplication.');
            return;
        }

        let m1 = this.#values;
        let m2 = other.#values;
        let m3 = [
            0, 0, 0,
            0, 0, 0,
            0, 0, 0,
        ];

        m3[0] = m1[0] * m2[0] + m1[1] * m2[3] + m1[2] * m2[6];
        m3[1] = m1[0] * m2[1] + m1[1] * m2[4] + m1[2] * m2[7];
        m3[2] = m1[0] * m2[2] + m1[1] * m2[5] + m1[2] * m2[8];

        m3[3] = m1[3] * m2[0] + m1[4] * m2[3] + m1[5] * m2[6];
        m3[4] = m1[3] * m2[1] + m1[4] * m2[4] + m1[5] * m2[7];
        m3[5] = m1[3] * m2[2] + m1[4] * m2[5] + m1[5] * m2[8];

        m3[6] = m1[6] * m2[0] + m1[7] * m2[3] + m1[8] * m2[6];
        m3[7] = m1[6] * m2[1] + m1[7] * m2[4] + m1[8] * m2[7];
        m3[8] = m1[6] * m2[2] + m1[7] * m2[5] + m1[8] * m2[8];

        if (inPlace) {
            this.setAll(m3);
            return this;
        } else {
            return new Matrix3(m3);
        }
    }

    /**
     * Transforms a vector using this matrix
     * @param {Vector3} vector the vector to transform
     * @returns {Vector3} the transformed vector
     */
    transform(vector) {
         if (!(vector instanceof Vector3)) {
            console.error(`Other is not of type 'Vector3'. Aborting multiplication.`);
            return new Vector3();
        }

        const mat = this.#values;
        
        const x = vector.x * mat[0] + vector.y * mat[1] + vector.z * mat[2];
        const y = vector.x * mat[3] + vector.y * mat[4] + vector.z * mat[5];
        const z = vector.x * mat[6] + vector.y * mat[7] + vector.z * mat[8];

        return new Vector3(x, y, z);
    }

    /**
     * Returns true if all elements in the given Matrix4 are equal to the elements in this Matrix4, false otherwise.
     */
    equals(other, EPSILON = 0.0001) {
        if (!(other instanceof Matrix3)) return false;
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
     * Clone this matrix into a new Matrix
     */
    clone() {
        let clonedValues = this.#values.slice();
        return new Matrix3(clonedValues);
    }

    /**
     * Retreive this matrix as a 1D list.
     */
    asList() {
        return this.#values.slice();
    }

    /**
     * Create a 3x3 scaling matrix given a scaling vector.
     */
    static scale(scaleVector) {
        return new Matrix3([
            scaleVector.x, 0, 0,
            0, scaleVector.y, 0,
            0, 0, scaleVector.z
        ]);
    }

    /**
     * Rotates in the zxy axis'. Treats the x, y, and z components 
     * as the individual rotation angles for each axis respectively.
     */
    static rotate(quaternion) {
        if (!(quaternion instanceof Quaternion)) {
            console.error('TypeError: Input is not of type \'Quaternion\'. Cannot create rotation matrix.');
            return new Matrix3(); // Return identity matrix on error
        }

        // Assuming Quaternion components are (x, y, z, w) where w is scalar
        const x = quaternion.x;
        const y = quaternion.y;
        const z = quaternion.z;
        const w = quaternion.w;

        const x2 = x + x;
        const y2 = y + y;
        const z2 = z + z;

        const xx = x * x2;
        const xy = x * y2;
        const xz = x * z2;
        const yy = y * y2;
        const yz = y * z2;
        const zz = z * z2;
        const wx = w * x2;
        const wy = w * y2;
        const wz = w * z2;

        return new Matrix3([
            1 - (yy + zz), xy - wz,        xz + wy,
            xy + wz,       1 - (xx + zz),  yz - wx,
            xz - wy,       yz + wx,        1 - (xx + yy)
        ]);
    }
}

/**
 * Represents a 2x2 mathematical matrix
 */
export class Matrix2 {
    #values;
    #size;

    constructor(values) {
        if (values === undefined) {
            this.#values = [1, 0, 0, 1];
        } else {
            this.#values = values.slice();
        }
        this.#size = 2;
    }

    /** 
     * Create a new Matrix2 from row vectors.
     */
    static fromRowVectors(row1, row2) {
        if (!(row1 instanceof Vector2 && row2 instanceof Vector2)) {
            console.error("One or more of the given values are not instances of Vector2. Cannot create matrix.");
            return new Matrix2();
        }

        let values = [
            row1.x, row1.y,
            row2.x, row2.y
        ]
        return new Matrix2(values);
    }

    /** 
     * Create a new Matrix2 from column vectors.
     */
    static fromColumnVectors(col1, col2) {
        if (!(col1 instanceof Vector3 && col2 instanceof Vector3)) {
            console.error("One or more of the given values are not instances of Vector2. Cannot create matrix.");
            return new Matrix2();
        }

        let values = [
            col1.x, col2.x,
            col1.y, col2.y,
        ]
        return new Matrix2(values);
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
        if (!(values instanceof Array && values.length === 4)) {
            console.error(`Values are not a 4-component javascript Array, cannot set matrix values.`);
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
        let t = [m[0], m[2], m[1], m[3]];

        if (inPlace) {
            this.setAll(t);
            return this;
        } else {
            return new Matrix2(t);
        }
    }

    /** 
     * Obtain the inverse of this matrix. If inPlace is true (false by default), then sets this
     * matrix as the resulting matrix.
     */
    inverse(inPlace = false) {
        let m = this.#values;
        const det = m[0] * m[3] - m[1] * m[2];

        if (det === 0) {
            console.error("Cannot calculate inverse as this matrix is singular (The determinant is 0).");
            return this;
        } else {
            let detInv = 1.0/det;
            let inverse = [
                m[3] * detInv,
                -m[1] * detInv,
                -m[2] * detInv,
                m[0] * detInv
            ]

            if (inPlace) {
                this.setAll(inverse);
                return this;
            } else {
                return new Matrix2(inverse);
            }
        }
    }

    /**
     * Multiply this matrix with another. If inPlace is true (false by default), then sets this
     * matrix as the resulting matrix.
     */
    multiply(other, inPlace = false) {
        if (!(other instanceof Matrix2)) {
            console.error('Other is not of type \'Matrix2\'. Aborting multiplication.');
            return;
        }

        let m1 = this.#values;
        let m2 = other.#values;
        let m3 = [
            // first row
            m1[0] * m2[0] + m1[1] * m2[2], 
            m1[0] * m2[1] + m1[1] * m2[3],

            // second row
            m1[2] * m2[0] + m1[3] * m2[2],
            m1[2] * m2[1] + m1[3] * m2[3]
        ];

        if (inPlace) {
            this.setAll(m3);
            return this;
        } else {
            return new Matrix2(m3);
        }
    }

    /**
     * Transforms a vector using this matrix
     * @param {Vector2} vector the vector to transform
     * @returns {Vector2} the transformed vector
     */
    transform(vector) {
         if (!(vector instanceof Vector2)) {
            console.error(`Other is not of type 'Vector2'. Aborting multiplication.`);
            return new Vector2();
        }

        const mat = this.#values;
        
        const x = vector.x * mat[0] + vector.y * mat[1];
        const y = vector.x * mat[2] + vector.y * mat[3];

        return new Vector2(x, y);
    }

    /**
     * Returns true if all elements in the given Matrix4 are equal to the elements in this Matrix4, false otherwise.
     */
    equals(other, EPSILON = 0.0001) {
        if (!(other instanceof Matrix2)) return false;
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
     * Clone this matrix into a new Matrix
     */
    clone() {
        let clonedValues = this.#values.slice();
        return new Matrix2(clonedValues);
    }

    /**
     * Retreive this matrix as a 1D list.
     */
    asList() {
        return this.#values.slice();
    }
}
