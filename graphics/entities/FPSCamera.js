import { Transform } from "../components/index.js";
import { Matrix4, Quaternion, Vector3 } from "../utilities/index.js";
import MoveableCamera from "./mCamera.js";

/**
 * FPS style camera, where the movements of such are directly controlled by the user
 */
export default class FPSCamera extends MoveableCamera {
    /**
     * Creates a new FPSCamera instance.
     */
    constructor() {
        super();
    }

    #updateViewMatrix() {
        // compute axis quaternions
        const yawQuat = Quaternion.fromAxisAngle(Transform.localUp, this._currentYawAngle);
        const pitchQuat = Quaternion.fromAxisAngle(Transform.localRight, this._currentPitchAngle);
        const rollQuat = Quaternion.fromAxisAngle(Transform.localForward, this._currentRollAngle);

        // update camera orientation
        const totalRotation = yawQuat.mult(pitchQuat).mult(rollQuat).normal()
        this.transform.rotation = totalRotation;

        // update camera position based on current camera orientation
        const worldMoveVector = totalRotation.rotateVector(this._localMovementVector);
        this.transform.translate(worldMoveVector);

        // update view matrix
        const eye = this.transform.position;
        const target = eye.add(this.transform.forwardVector);
        this._viewMatrix = Matrix4.lookAt(eye, target, this.transform.upVector);
        this._isViewDirty = false;

        // reset local movement vector to prevent accumulation
        this._localMovementVector = new Vector3();
    }

    #updateProjectionMatrix(aspectRatio) {
        if (this._isPerspective) {
            this._projectionMatrix = Matrix4.perspectiveProjSymmetic(this._fov, aspectRatio, this._nearPlane, this._farPlane);
        } else {
            let orthoHeight = this._baseOrthoHeight / this._orthoZoom;
            let top = orthoHeight / 2.0;
            let bottom = -orthoHeight / 2.0;
            let right = orthoHeight * aspectRatio / 2.0;
            let left = -orthoHeight * aspectRatio / 2.0;

            this._projectionMatrix = Matrix4.orthogaphicProj(right, left, top, bottom, this._nearPlane, this._farPlane);
        }

        this._prevAspectRatio = aspectRatio;
        this._isProjectionDirty = false;
    }

    /**
     * Updates the view and projection matrices with the currently set camera properties
     * @param {number} dt the amount of time since the last update in seconds
     * @param {number} aspectRatio the aspectRatio of the camera view
     */
    update(dt, aspectRatio) {
        // console.log(aspectRatio);
        if (this._isViewDirty) {
            this.#updateViewMatrix();
        }
        if (this._isProjectionDirty || this._prevAspectRatio !== aspectRatio) {
            this.#updateProjectionMatrix(aspectRatio);
        }
    }

    applyToShader(shaderProgram) {
        if (shaderProgram.supports('uView')) {
            shaderProgram.setUniform('uView', this.viewMatrix);
        }
        if (shaderProgram.supports('uProjection')) {
            shaderProgram.setUniform('uProjection', this.projectionMatrix);
        }
    }
}