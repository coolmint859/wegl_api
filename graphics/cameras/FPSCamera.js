import MoveableCamera from "./mCamera.js";
import Quaternion from "../../utilities/quaternion.js";
import Transform from "../../utilities/transform.js";
import { Matrix4 } from "../../utilities/matrix.js";
import { Vector3 } from "../../utilities/vector.js";

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

    #updateCameraOrientation() {
        // console.log(this.#currentRollAngle);
        // compute axis quaternions
        const yawQuat = Quaternion.fromAxisAngle(Transform.localUp, this._currentYawAngle);
        const pitchQuat = Quaternion.fromAxisAngle(Transform.localRight, this._currentPitchAngle);
        const rollQuat = Quaternion.fromAxisAngle(Transform.localForward, this._currentRollAngle);

        // update camera orientation
        const totalRotation = yawQuat.mult(pitchQuat).mult(rollQuat).normal()
        this.transform.setRotation(totalRotation);

        // update camera position based on current camera orientation
        const worldMoveVector = totalRotation.rotateVector(this._localMovementVector);
        this.transform.translate(worldMoveVector);
        // console.log("cameraPos: " + this.transform.getPosition().str());
        // console.log("worldForward: " + this.transform.getForwardVector().str());
        
        // reset local movement vector to prevent accumulation
        this._localMovementVector = new Vector3();
    }

    /**
     * Updates the view and projection matrices with the currently set camera properties
     * @param {number} dt the amount of time since the last update in seconds
     * @param {number} aspectRatio the aspectRatio of the camera view
     */
    update(dt, aspectRatio) {
        // update view matrix if camera orientation changed
        if (this._isViewDirty) {
            this.#updateCameraOrientation();

            const eye = this.transform.getPosition();
            const target = eye.add(this.transform.getForwardVector());
            this._viewMatrix = Matrix4.lookAt(eye, target, this.transform.getUpVector());
            this._isViewDirty = false;
        }

        // update projection matrix if camera settings have changed.
        if (this._isProjectionDirty || this._prevAspectRatio !== aspectRatio) {
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
    }
}