import { ShaderProgram } from "../../systems/index.js";
import { Matrix4, Quaternion, Vector3, Vector4 } from "../../utilities/index.js";

/**
 * Encapsulates local to world space transformations.
 */
export default class Transform {
    // local orientation vectors, these are always constant
    static localRight   = new Vector3(1, 0, 0);
    static localUp      = new Vector3(0, 1, 0);
    static localForward = new Vector3(0, 0, 1); // right-handed system

    static #name = 'uModel'; // all transforms support a model matrix

    #position;
    #dimensions;
    #rotation;

    #worldMatrix;
    #isDirty;

    /**
     * Create an new Transform instance
     * @param {object} params optional intitial transform values. 
     * @param {Vector3} params.position initial position, default is Vector3(0, 0, 0)
     * @param {Quaternion} params.rotation initial rotation, default is Quaternion(1, 0i, 0j, 0k)
     * @param {Vector3} params.dimensions initial dimensions, default is Vector3(1, 1, 1)
     */
    constructor(params = {}) {
        if (params.position && !(params.position instanceof Vector3)) {
            console.warn(`[Transform] TypeError: Expected 'params.position' to be instance of Vector3. Assigning default position.`)
            params.position = new Vector3();
        }
        if (params.rotation && !(params.rotation instanceof Quaternion)) {
            console.warn(`[Transform] TypeError: Expected 'params.rotation' to be instance of Quaternion. Assigning default rotation.`)
            params.rotation = new Quaternion();
        }
        if (params.dimensions && !(params.dimensions instanceof Vector3)) {
            console.warn(`[Transform] TypeError: Expected 'params.dimensions' to be instance of Vector3. Assigning default dimensions.`)
            params.dimensions = new Vector3();
        }

        this.#position = params.position ?? new Vector3();
        this.#rotation = params.rotation ?? new Quaternion();
        this.#dimensions = params.dimensions ?? Vector3.Ones();

        // this check is to prevent gpu driver related issues where an model matrix is the identity matrix
        if (this.#position.equals(new Vector3(0, 0, 0))) {
            this.#position = new Vector3(0, 0.001, 0);
        }

        // create world matrix based on inititial orientation
        this.#worldMatrix = Matrix4.STR4(this.#position, this.#rotation, this.#dimensions);
        this.#isDirty = false;
    }

    get capabilities() {
        return [Transform.#name];
    }

    /**
     * Retrieve the position vector of this transform
     * @returns {Vector3} the position vector
     */
    get position() {
        return this.#position;
    }

    /**
     * Retrieve the rotation quaternion of this transform
     * @returns {Quaternion} the rotation quaternion
     */
    get rotation() {
        return this.#rotation;
    }

    /**
     * Retrieve the scale vector of this transform
     * @returns {Vector3} the scale vector
     */
    get dimensions() {
        return this.#dimensions;
    }
    
    /**
     * Set the absolute position of this transform
     * @param {Vector3} position the new position
     * @returns {boolean} true if the position was successfully set, false otherwise
     */
    set position(position) {
        if (!(position instanceof Vector3)) {
            console.error("TypeError: Expected 'position' to be instance of Vector3. Unable to set position vector.")
            return false
        }
        this.#position = position.clone();
        this.#isDirty = true;
        return true;
    }

    /**
     * Set the absolute rotation of this transform
     * @param {Quaternion} rotation the new rotation
     * @returns {boolean} true if the rotation was successfully set, false otherwise
     */
    set rotation(rotation) {
        if (!(rotation instanceof Quaternion)) {
            console.error("TypeError: Expected 'rotation' to be instance of Quaternion. Unable to set rotation quaternion.")
            return false
        }
        this.#rotation = rotation.clone().normal();
        this.#isDirty = true;
        return true;
    }

    /**
     * Set the absolute scale of this transform
     * @param {Vector3} scale the new scale
     * @returns {boolean} true if the scale was successfully set, false otherwise
     */
    set dimensions(dimensions) {
        if (!(dimensions instanceof Vector3)) {
            console.error("TypeError: Expected 'dimensions' to be instance of Vector3. Unable to set dimensions.")
            return false;
        }
        this.#dimensions = dimensions.clone();
        this.#isDirty = true;
        return true;
    }

    /**
     * Retreive the world space forward vector of this transform.
     * @returns {Vector3} the forward vector
     */
    get forwardVector() {
        return this.#rotation.rotateVector(Transform.localForward);
    }

    /**
     * Retreive the world space up vector of this transform.
     * @returns {Vector3} the up vector
     */
    get upVector() {
        return this.#rotation.rotateVector(Transform.localUp);
    }

    /**
     * Retreive the world space right vector of this transform.
     * @returns {Vector3} the right vector
     */
    get rightVector() {
        return this.#rotation.rotateVector(Transform.localRight);
    }
    
    /**
     * Computes the transformation matrix as determined by the current position, rotation, and dimensions.
     * @returns {Matrix4} the computed transformation matrix
     */
    get worldMatrix() {
        if (this.#isDirty) {
            this.#worldMatrix = Matrix4.STR4(this.#position, this.#rotation, this.#dimensions);
            this.#isDirty = false;
        }
        return this.#worldMatrix;
    }

    /**
     * Adds the given translation to the current transform position.
     * @param {Vector3 | number} translation the translation value - can be either a Vector3 or number.
     * 
     * Note: Providing a number effectively only increases/decreases the distance from the world space origin.
     * @returns {boolean} true if the position was successfully changed, false otherwise
     */
    translate(translation) {
        if (!(translation instanceof Vector3) && typeof translation !== 'number') {
            console.error("TypeError: Expected 'translation' to be a number, or an instance of Vector3. Unable to update position vector.")
            return false
        }
        this.#position = this.#position.add(translation);
        this.#isDirty = true;
        return true;
    }

    /**
     * Applies a rotation to the current rotation quaternion.
     * @param {Quaternion} rotationQuat the rotation quaternion offset
     * @returns {boolean} true if the rotation was successfully changed, false otherwise
     */
    rotate(rotationQuat) {
        if (!(rotationQuat instanceof Quaternion)) {
            console.error("TypeError: Expected 'rotationQuat' to be instance of Quaternion. Unable to update rotation quaternion.")
            return false
        }
        this.#rotation = this.#rotation.mult(rotationQuat).normal();
        this.#isDirty = true;
        return true;
    }

    /**
     * Multiplies this transform's dimensions by the given scaling vector. Note that this is a linear operation.
     * @param {Vector3} scaleVector the amount to scale
     * @returns {boolean} true if the scale was successfully changed, false otherwise
     */
    scale(scaleVector) {
        if (!(scaleVector instanceof Vector3)) {
            console.error("TypeError: Expected 'scaleVector' to be instance of Vector3. Unable to update scale vector.")
            return false;
        }
        this.#dimensions.mult(scaleVector);
        this.#isDirty = true;
        return true;
    }

    /**
     * Reorients this transform such that it's forward vector 'points' at a target point.
     * @param {Vector3} target the point in space to point the forward vector at
     * @param {Vector3} up the world space up, allowing for optional roll. Default is the local up axis.
     */
    lookAt(target, up = Transform.localUp) {
        if (!(target instanceof Vector3 && up instanceof Vector3)) {
            console.error("TypeError: Expected 'target' and 'up' to be instances of Vector3. Unable to reorient coordinate system.")
            return;
        }

        const lookDirection = target.sub(this.#position);
        this.#rotation = Quaternion.fromForwardUp(lookDirection, up);

        this.#isDirty = true;
    }

    /**
     * Combine this transform with another additively. Does not affect this transform.
     * @param {Transform} transform the other transform
     * @returns {Transform} a new transform as a combination of both transforms
     */
    combine(transform) {
        return new Transform({
            position: this.position.add(transform.position),
            rotation: this.rotation.mult(transform.rotation),
            dimensions: this.dimensions.add(transform.dimensions)
        });
    }

    /**
     * create an exact replica of this transform instance
     * @returns {Transform} a new transform instance
     */
    clone() {
        return new Transform({
            position: this.#position.clone(),
            rotation: this.#rotation.clone(),
            dimensions: this.#dimensions.clone()
        })
    }

    /**
     * Apply this transform to a vector, generating a new one.
     * @param {Vector4} vector a vector to apply the transformation to
     */
    applyTo(vector) {
        return this.worldMatrix.transform(vector);
    }

    /**
     * apply this transform to a shader
     * @param {ShaderProgram} shaderProgram the shader program to apply this transform to
     */
    applyToShader(shaderProgram) {
        if (shaderProgram.supports(Transform.#name)) {
            shaderProgram.setUniform(Transform.#name, this.worldMatrix);
        }
    }
}