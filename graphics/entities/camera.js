import { Component, LocalTranslationControls, RotationControls, ZoomControls } from "../components/index.js";
import { ShaderProgram } from "../systems/index.js";
import { EventDispatcher, Matrix3, Matrix4, MouseInput, Quaternion } from "../utilities/index.js";
import KeyBoardInput from "../utilities/interactivity/keyboard.js";
import Entity from "./entity.js";

/** Represents the view and projection into a scene. */
export default class Camera extends Entity {
    #projMatrix;
    #prevAspectRatio = 1;
    #fov;
    #nearPlane;
    #farPlane;
    #isProjDirty = true;

    constructor(options={}) {
        super('camera');
        this.#projMatrix = new Matrix4();

        this.#fov = options.fov ?? Math.PI/4;
        this.#nearPlane = options.nearPlane ?? 0.1;
        this.#farPlane = options.farPlane ?? 500;

        this._capabilities.push('uView', 'uProjection');
    }

    /**
     * Get a copy of the view matrix of this camera.
     * @returns {Matrix4} the view matrix
     */
    get viewMatrix() {
        return this.transform.viewMatrix.clone();
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

    set FOV(newFOV) {
        this.#fov = newFOV;
        this.#isProjDirty = true;
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

    /**
     * Update this camera instance
     * @param {number} dt the elapsed time since the last frame
     * @param {number} aspectRatio the aspect ratio of the camera viewport
     */
    update(dt, aspectRatio) {
        for (const component of this._componentsByClass.values()) {
            if (component.hasModifier(Component.Modifier.UPDATABLE)) {
                component.update(this, dt);
            }
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
            shaderProgram.setUniform('uView', this.transform.viewMatrix);
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
            sensitivity: options.rotSensitivity ?? 0.002,
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