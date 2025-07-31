import { Vector3 } from "../../utilities/math/vector.js";
import { Matrix4 } from "../../utilities/math/matrix.js";
import Transform from "../../utilities/containers/transform.js";
import Quaternion from "../../utilities/math/quaternion.js";

/** Provides common attributes/methods for all camera types. This class is abstract and should not be instatiated directly */
export default class Camera {
    // static variables, always constant
    // we can let the user directly configure these since they're universal to all camera subclasses
    static MAX_FOV = 2.094; // 120 degrees
    static MIN_FOV = 0.017; // 1 degree
    static FOV_SCALE_FACTOR = 2.5;
    static MAX_ORTHO_ZOOM = 1;
    static MIN_ORTHO_ZOOM = 0.01;

    constructor() {
        // previous view ratio
        this._prevAspectRatio = 0;

        // camera properties and projection
        this._isPerspective = true;
        this._fov = Math.PI/4;
        this._nearPlane = 0.1;
        this._farPlane = 150;
        this._projectionMatrix = new Matrix4();
        this._viewMatrix = new Matrix4();
        this._isProjectionDirty = true;
        this._isViewDirty = true;

        // camera orientation
        this.transform = new Transform(new Vector3(), new Quaternion(), Vector3.Ones());
        this._localMovementVector = new Vector3();
        this._currentPitchAngle = 0;
        this._currentYawAngle = 0;
        this._currentRollAngle = 0;
        
        // used for orthographic projection
        this._baseOrthoHeight = 2.0;
        this._orthoFocalDistance = 6;
        this._orthoZoom = 1.0;
        this._prevOrthoZoom = 1.0;
    }

    /**
     * Get this camera's current view matrix.
     */
    get viewMatrix() {
        return this._viewMatrix.clone();
    }

    /**
     * Get this camera's current projection matrix.
     */
    get projectionMatrix() {
        return this._projectionMatrix.clone();
    }

    /**
     * Returns true if the camera current projection is perspective, false otherwise.
     */
    get isPerspective() {
        return this._isPerspective;
    }

    /**
     * Set this camera's current projection to orthographic.
     */
    setProjectionOrthographic(zoom, near, far) {
        if (this._isPerspective ||
            this._orthoZoom !== zoom ||
            this._nearPlane !== near ||
            this._farPlane !== far)
        {
            this._isPerspective = false;
            this._orthoZoom = zoom;
            this._nearPlane = near;
            this._farPlane = far;
            this._isProjectionDirty = true;
        }
    }

    /**
     * Set this camera's current projection to perspective.
     */
    setProjectionPerspective(fovAngle, near, far) {
        if (!this._isPerspective ||
            this._fov !== fovAngle ||
            this._nearPlane !== near ||
            this._farPlane !== far)
        {
            this._isPerspective = true;
            this._fov = fovAngle;
            this._nearPlane = near;
            this._farPlane = far;
            this._isProjectionDirty = true;
        }
    }

    switchProjection() {
        this._isPerspective = !this._isPerspective;
        console.log("zoom: " + this._orthoZoom);
        console.log("fov: " + this._fov);

        if (this._isPerspective) {
            this._fov = mapRange(Camera.MIN_ORTHO_ZOOM, Camera.MAX_ORTHO_ZOOM, Camera.MIN_FOV, Camera.MAX_FOV, this._orthoZoom);
            this._fov = clamp(this._fov, Camera.MIN_FOV, Camera.MAX_FOV);
        } else {
            this._orthoZoom = mapRange(Camera.MIN_FOV, Camera.MAX_FOV, Camera.MIN_ORTHO_ZOOM, Camera.MAX_ORTHO_ZOOM, this._fov);
            this._orthoZoom = clamp(this._fov, Camera.MIN_ORTHO_ZOOM, Camera.MAX_ORTHO_ZOOM);
        }

        this._isProjectionDirty = true;
    }

    update(dt, aspectRatio) {
        // this is an 'abstract' class, where update() is a method base classes need to implement.
        console.error("Cannot update abstract Camera instance. Please instatiate a subclass to use update method.");
    }
}