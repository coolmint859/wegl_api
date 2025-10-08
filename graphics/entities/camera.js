import { Component, LocalTranslationControls, RotationControls, ZoomControls } from "../components/index.js";
import { ShaderProgram } from "../systems/index.js";
import { EventDispatcher, Matrix4, MouseInput } from "../utilities/index.js";
import KeyBoardInput from "../utilities/interactivity/keyboard.js";
import Entity from "./entity.js";

/** Represents the view and projection into a scene. */
export default class Camera extends Entity {
    #viewMatrix;
    #isViewDirty = true;
    
    #projMatrix;
    #prevAspectRatio = 1;
    #fov;
    #nearPlane;
    #farPlane;
    #isProjDirty = true;

    constructor(options={}) {
        super('camera');
        this.#viewMatrix = new Matrix4();
        this.#projMatrix = new Matrix4();

        this.#fov = options.fov ?? Math.PI/4;
        this.#nearPlane = options.nearPlane ?? 0.1;
        this.#farPlane = options.farPlane ?? 500;

        this._capabilities.push('uView', 'uProjection');

        this.dispatcher.subscribe(EventDispatcher.EventType.POSITION_CHANGE, this.#updatePosition.bind(this));
        this.dispatcher.subscribe(EventDispatcher.EventType.ROTATION_CHANGE, this.#updateRotation.bind(this));
        this.dispatcher.subscribe(EventDispatcher.EventType.FOV_CHANGE, this.#updateFOV.bind(this));
    }

    /**
     * Get a copy of the view matrix of this camera.
     * @returns {Matrix4} the view matrix
     */
    get viewMatrix() {
        return this.#viewMatrix.clone();
    }

    /**
     * Get a copy of the projection matrix of this camera.
     * @returns {Matrix4} the projection matrix
     */
    get projMatrix() {
        return this.#projMatrix;
    }

    /**
     * Get the aspect ratio of this camera's projection
     * @returns {number} the aspect ratio
     */
    get aspectRatio() {
        return this.#prevAspectRatio;
    }

    /**
     * Get the field of view of this camera's projection
     * @returns {number} the field of view
     */
    get FOV() {
        return this.#fov;
    }

    /**
     * Get near clipping plane of the camera's view frustum
     * @returns {number} the near clipping plane
     */
    get nearPlane() {
        return this.#nearPlane;
    }

    /**
     * Get far clipping plane of the camera's view frustum
     * @returns {number} the far clipping plane
     */
    get farPlane() {
        return this.#farPlane;
    }
    
    #updatePosition(event) {
        this.position = event.position;
        this.#isViewDirty = true;
    }

    #updateRotation(event) {
        this.rotation = event.rotation;
        this.#isViewDirty = true;
    }

    #updateFOV(event) {
        this.#fov = event.fov;
        this.#isProjDirty = true;
    }

    /**
     * Update this camera instance
     * @param {number} dt the elapsed time since the last frame
     * @param {number} aspectRatio the aspect ratio of the camera viewport
     */
    update(dt, aspectRatio) {
        for (const component of this._components.values()) {
            if (component.hasModifier(Component.Modifier.UPDATABLE)) {
                component.update(this, dt);
            }
        }

        if (this.#isViewDirty) {
            const eye = this._transform.position;
            const target = eye.add(this._transform.forwardVector);
            this.#viewMatrix = Matrix4.lookAt(eye, target, this._transform.upVector);
            this.#isViewDirty = false;
        }

        if (this.#isProjDirty || aspectRatio !== this.#prevAspectRatio) {
            this.#projMatrix = Matrix4.perspectiveProjSymmetic(this.#fov, aspectRatio, this.#nearPlane, this.#farPlane);
            this.#prevAspectRatio = aspectRatio;
            this.#isProjDirty = false;
        }
    }

    /**
     * Apply this camera to a shader program
     * @param {ShaderProgram} shaderProgram the shader program to apply this camera to
     */
    applyToShader(shaderProgram) {
        if (shaderProgram.supports('uView')) {
            shaderProgram.setUniform('uView', this.#viewMatrix);
        }
        if (shaderProgram.supports('uProjection')) {
            shaderProgram.setUniform('uProjection', this.#projMatrix);
        }
    }

    /**
     * Create a camera instance designed to be controlled like a first person camera.
     * @param {MouseInput} mouse the mouse input handler to register mouse events with
     * @param {KeyBoardInput} keyboard the keyboard input handler to register keyboard events with
     * @param {object} options an object containing camera and control options.
     * @returns {Camera} a new camera instance with controls for a first person feel.
     */
    static FirstPerson(mouse, keyboard, options={}) {
        const cameraOptions = {
            fov : options.fov ?? Math.PI/4,
            nearPlane: options.nearPlane ?? 0.1,
            farPlane: options.farPlane ?? 1000
        }
        const camera = new Camera(cameraOptions);

        const rotControlOptions = {
            sensitivity: options.rotSensitivity ?? 0.005,
            minPitch: -Math.PI/2 + 0.05,
            maxPitch: Math.PI/2 - 0.05
        }
        camera.addComponent(new RotationControls(mouse, rotControlOptions));

        const transControlOptions = {
            speed: options.moveSpeed ?? 15,
            keyFireRate: options.keyFireRate ?? 0
        }
        camera.addComponent(new LocalTranslationControls(keyboard, transControlOptions));
        
        const zoomOptions = {
            sensitivity: options.zoomSensitivity ?? 0.05,
            speed: options.zoomSpeed ?? 15,
            minFOV: options.minFOV ?? 0.2,
            maxFOV: options.maxFOV ?? 2.094
        }
        camera.addComponent(new ZoomControls(keyboard, zoomOptions));

        return camera;
    }
}