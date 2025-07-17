/** An abstract class defining a camera movable by the user, providing methods for such. */
class MoveableCamera extends Camera {
    // minimum and maximum pitch allowed by the camera
    static MAX_PITCH = Math.PI/2 - 0.05;
    static MIN_PITCH = -Math.PI/2 + 0.05;

    constructor() {
        super();

        // camera world space properties
        this._mouseSensitivity = 0;
        this._canvasElement = null;
    }

    /**
     * initialize the mouse controls for this camera. This needs to be called for a camera to be interactable.
     * @param {*} canvas the canvas element to listen for mouse events on
     * @param {*} mouseSensitivity the sensitivity of the mouse controls
     */
    initMouseControls(canvas, mouseSensitivity = 0.002) {
        if (!(canvas instanceof HTMLElement) || canvas.tagName !== 'CANVAS') {
            console.error("Provided element is not a valid HTMLCanvasElement.");
            return;
        }
        this._canvasElement = canvas;
        this._mouseSensitivity = mouseSensitivity;

        // Use arrow functions to maintain 'this' context
        this._canvasElement.addEventListener('mousedown', (event) => this.#onMouseDown(event));
        this._canvasElement.addEventListener('mousemove', (event) => this.#onMouseMove(event));

        // Optional: Pointer Lock API listeners
        document.addEventListener('pointerlockchange', () => this.#onPointerLockChange(), false);
        document.addEventListener('pointerlockerror', (error) => this.#onPointerLockError(error), false);

        console.log("Initialized mouse controls");
    }

    /** Tells the canvas to request a pointer lock when the mouse button pressed is the left one. */
    #onMouseDown(event) {
        if (event.button === 0) { // Left mouse button
            // Request pointer lock for true FPS feel
            this._canvasElement.requestPointerLock();
        }
    }

    /** Updates the accumulated pitch and yaw angles based on mouse movement */
    #onMouseMove(event) {
        if (document.pointerLockElement !== this._canvasElement) return;

        // update yaw angle - this can be any value
        let yawAngleDelta = event.movementX * this._mouseSensitivity;
        this._currentYawAngle -= yawAngleDelta;

        // update pitch angle - prevent gimbal lock by restricting alignment from local up vector
        // NOTE: doesn't work perfectly. Need to fix at some point
        let pitchAngleDelta = event.movementY * this._mouseSensitivity;
        const possiblePitchAngle = this._currentPitchAngle + pitchAngleDelta;
        if (possiblePitchAngle <= MoveableCamera.MAX_PITCH && possiblePitchAngle >= MoveableCamera.MIN_PITCH) {
            this._currentPitchAngle -= pitchAngleDelta;
        }

        // flag view matrix as dirty
        this._isViewDirty = true;
    }

    /** Binds/Unbinds the pointer lock element to the current document object */
    #onPointerLockChange() {
        const pointerLockEnabled = document.pointerLockElement === this._canvasElement;
        const pointerLockMessage = pointerLockEnabled ? "Enabled" : "Disabled";
        console.log(`Pointer Lock ${pointerLockMessage}`);
    }

    /** if the pointer lock had an error */
    #onPointerLockError(error) {
        console.error('Pointer Lock Error:', error);
    }

    /**
     * Set the mouse sensitivity for the camera's movements.
     * @param {number} sensitivity the new sensitivity. Must be greater than 0.
     * @returns true if the mouse sensitivity was successfully set, false otherwise.
     */
    setMouseSensitivity(sensitivity) {
        if (typeof sensitivity !== 'number' && sensitivity > 0) {
            console.error("Expected 'sensitivity' to be number greater than 0. Cannot set mouse sensitivity for this camera.");
            return false;
        }
        this._mouseSensitivity = sensitivity;
        return true;
    }

    /**
     * Retrieve the mouse sensitivity for this camera.
     * @returns the current mouse sensitivity
     */
    getMouseSensitivity() {
        return this._mouseSensitivity;
    }

    /**
     * Zoom's the camera in. If the projection is perspective, this amounts to decreasing the camera FOV.
     * If the projection is orthographic, this decreases the dimensions of the frustrum and moves the camera forward.
     * @param {number} amount the amount to zoom in by.
     */
    zoomIn(amount) {
        if (this._isPerspective && this._fov - amount * Camera.FOV_SCALE_FACTOR > Camera.MIN_FOV ) {
            this._fov -= amount * Camera.FOV_SCALE_FACTOR;
            this._isProjectionDirty = true;
        } else if (!this._isPerspective && this._orthoZoom + amount < Camera.MAX_ORTHO_ZOOM) {
            this._orthoZoom +=amount;
            this._isProjectionDirty = true;

            // zooming in with orthographic projection is equilavent to moving forward,
            // so to prevent near clipping plane issues, we also move the camera forward.
            this.#updateCameraZoomPosition();

            // camera position changed, so the view matrix needs to be updated.
            this._isViewDirty = true;
        }
    }

    /**
     * Zoom's the camera out. If the projection is perspective, this amounts to increasing the camera FOV.
     * If the projection is orthographic, this increases the dimensions of the frustum and moves the camera backward.
     * @param {number} amount the amount to zoom out by.
     */
    zoomOut(amount) {
        if (this._isPerspective && this._fov + amount * Camera.FOV_SCALE_FACTOR < Camera.MAX_FOV) {
            this._fov += amount * Camera.FOV_SCALE_FACTOR;
            this._isProjectionDirty = true;
        } else if (!this._isPerspective && this._orthoZoom - amount > Camera.MIN_ORTHO_ZOOM) {
            this._orthoZoom -=amount;
            this._isProjectionDirty = true;

            // zooming in in orthographic projection is equilavent to moving forward,
            // so to prevent near clipping plane issues, we also move the camera forward.
            this.#updateCameraZoomPosition();

            // camera position changed, so the view matrix needs to be updated.
            this._isViewDirty = true;
        }
    }

    /** Helper function for moving the camera position if zoom changes in orthographic projection. */
    #updateCameraZoomPosition() {
        // calculate the position offset distance
        const prevZoomFactor = 1.0/this._prevOrthoZoom;
        const currentZoomFactor = 1.0/this._orthoZoom;
        const posOffset = this._orthoFocalDistance * (currentZoomFactor - prevZoomFactor);
        const deltaMovement = Transform.localForward.mult(posOffset);
        console.log('deltaMove: ' + deltaMovement.str());

        // move the camera along world forward direction by the offset distance
        this._localMovementVector = this._localMovementVector.add(deltaMovement);
        console.log('localMove: ' + this._localMovementVector.str());

        // update previous zoom
        this._prevOrthoZoom = this._orthoZoom;
    }

    /**
     * Move the camera foward (-z) the given distance.
     */
    moveForward(distance) {
        // only allow moving forward if projection is perspective. This prevents near clipping issues
        if (this._isPerspective) {
            const deltaMovement = Transform.localForward.mult(-distance);
            this._localMovementVector = this._localMovementVector.add(deltaMovement);
            
            this._isViewDirty = true;
        }
    }

    /**
     * Move the camera backard (+z) the given distance.
     */
    moveBackward(distance) {
        // only allow moving backward if projection is perspective. This prevents near clipping issues
        if (this._isPerspective) {
            const deltaMovement = Transform.localForward.mult(distance);
            this._localMovementVector = this._localMovementVector.add(deltaMovement);
            
            this._isViewDirty = true;
        }
    }

    /**
     * Move the camera to the right (+x) the given distance.
     */
    strafeRight(distance) {
        const deltaMovement = Transform.localRight.mult(distance);
        this._localMovementVector = this._localMovementVector.add(deltaMovement);

        this._isViewDirty = true;
    }

    /**
     * Move the camera left (-x) the given distance.
     */
    strafeLeft(distance) {
        const deltaMovement = Transform.localRight.mult(-distance);
        this._localMovementVector = this._localMovementVector.add(deltaMovement);

        this._isViewDirty = true;
    }

    /**
     * Move the camera upward (+y) the given distance.
     */
    moveUp(distance) {
        const deltaMovement = Transform.localUp.mult(distance);
        this._localMovementVector = this._localMovementVector.add(deltaMovement);
        console.log(deltaMovement);
        
        this._isViewDirty = true;
    }

    /**
     * Move the camera downward (-y) the given distance.
     */
    moveDown(distance) {
        const deltaMovement = Transform.localUp.mult(-distance);
        this._localMovementVector = this._localMovementVector.add(deltaMovement);
        console.log(deltaMovement);
        
        this._isViewDirty = true;
    }

    /**
     * Roll the camera counter-clockwise about the current forward vector.
     * @param {number} deltaAngle the change in roll angle in radians
     */
    rollLeft(deltaAngle) {
        this._currentRollAngle += deltaAngle;
        this._isViewDirty = true;
    }

    /**
     * Roll the camera clockwise about the current forward vector.
     * @param {number} deltaAngle the change in roll angle in radians
     */
    rollRight(deltaAngle) {
        this._currentRollAngle -= deltaAngle;
        this._isViewDirty = true;
    }

    update(dt, aspectRatio) {
        // this is an 'abstract' class, where update() is a method base classes need to override.
        console.error("Cannot update abstract MoveableCamera instance. Please instatiate a subclass to use update method.");
    }
}