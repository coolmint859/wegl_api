import { TextureManager } from "../../components/index.js";
import GeometryHandler from "../../modeling/geometry/geometry-handler.js";
import ShaderManager from "../../shading/shader-manager.js";

/**
 * Handles webgl rendering contexts
 */
export default class ContextManager {
    static #contexts = new Map();
    static #currentContext = null;

    static HandlerType = Object.freeze({
        TEXTURE: 'texture',
        SHADER: 'shader',
        GEOMETRY: 'geometry'
    })

    /**
     * Create a new webgl2 context instance.
     * @param {HTMLCanvasElement} canvasElement the canvas element the new context should be bound to
     * @param {object} options webgl canvas context options. See MPN docs for possible properties
     * @param {boolean} options.setCurrent if true, will set the new context as the current context. Default is true
     * @returns {string} the canvas id the context is bound to.
     */
    static create(canvasElement, options={}) {
        if (!(canvasElement instanceof HTMLCanvasElement)) {
            console.error(`[ContextManager] Cannot create new WebGL context as the provided object is not a canvas element.`);
            return '';
        }

        const gl = canvasElement.getContext('webgl2', options);
        const contextWrapper = {
            canvas: canvasElement,
            id: canvasElement.id,
            glContext: gl,
            handlers: {
                texture: new TextureManager(gl, canvasElement.id),
                shader: new ShaderManager(gl, canvasElement.id),
                geometry: new GeometryHandler(gl, canvasElement.id)
            }
        }

        ContextManager.#contexts.set(canvasElement.id, contextWrapper);

        const setAsCurrent = options.setCurrent ?? true;
        if (setAsCurrent) {
            this.#currentContext = contextWrapper;
        }

        console.log(`[ContextManager] Successfully created new WebGL context for canvas '${canvasElement.id}'. (current: ${setAsCurrent})`);
        return canvasElement.id;
    }

    /** 
     * Check if the provided canvas id is bound to a known context 
     * @returns {boolean} true if the canvas id is valid, false otherwise
     */
    static isValidContext(canvasID) {
        return ContextManager.#contexts.has(canvasID);
    }

    /** 
     * Check if the provided handler type is a recognized type
     * @returns {boolean} true if the handler type is valid, false otherwise
     */
    static isValidHandlerType(handlerType) {
        return Object.values(ContextManager.HandlerType).includes(handlerType);
    }

    /**
     * Get all handlers from a known context
     * @param {string} canvasID the name of the canvas id bound to the context
     * @returns {object} an object whose properties contain the provided context's handler instances
     */
    static getHandlers(canvasID) {
        if (!ContextManager.isValidContext(canvasID)) {
            console.error(`[ContextManager] Cannot get context handlers as the provided context is not recognized.`);
            return null;
        }
        return ContextManager.#contexts.get(canvasID).managers;
    }

    /**
     * Get a handler instance given the canvasID and handler type
     * @param {string} canvasID the canvas id that the handler is bound to
     * @param {ContextManager.HandlerType} handlerType the handler type requested
     * @returns {GeometryHandler | TextureManager | ShaderManager } the handler instance corresponding to given context and handler type
     */
    static getHandler(canvasID, handlerType) {
        if (!ContextManager.isValidContext(canvasID)) {
            console.error(`[ContextManager] Cannot get context handler as the provided canvas id is not recognized.`);
            return null;
        }
        if (!ContextManager.isValidHandlerType(handlerType)) {
            console.error(`[ContextManager] Cannot get context handler as the provided handler type is not recognized.`);
            return null;
        }
        return ContextManager.#contexts.get(canvasID).handlers[handlerType];
    }

    /**
     * Retrieve the currently active context's canvas id
     * @returns {string} the currently active canvas id
     */
    static get currentCanvasID() {
        return ContextManager.#currentContext.id;
    }

    /**
     * Retrieve the canvas element that the current WebGL context is bound to
     * @returns {HTMLCanvasElement}
     */
    static get currentCanvas() {
        return ContextManager.#currentContext.canvas;
    }

    /**
     * Retrieve the currently active webgl context
     * @returns {WebGL2RenderingContext} the current active webgl context
     */
    static get currentGLContext() {
        return ContextManager.#currentContext.glContext;
    }

    /**
     * Retrieve the manager instances of the currently active context
     * @returns {object} an object whose properties contain the current context's manager instances
     */
    static get currentHandlers() {
        return ContextManager.#currentContext.managers;
    }

    static getCurrentHandler(handlerType) {
        if (!ContextManager.isValidHandlerType(handlerType)) {
            console.error(`[ContextManager] Cannot get state handler as the provided handler type is not recognized.`);
            return null;
        }
        return ContextManager.#currentContext.handlers[handlerType];
    }

    /**
     * Switch the current rendering context using the provided canvas id
     * @param {string} canvasID the canvas id to switch the current context to
     */
    static switch(canvasID) {
        const context = ContextManager.#contexts.get(canvasID);
        if (!context) {
            console.error(`[ContextManager] Cannot switch contexts as the provided canvas id is not recognized.`);
        }
        console.log(`[ContextManager] Switching contexts from canvas '${ContextManager.#currentContext.id} to ${canvasID}...`)
        ContextManager.#currentContext = context;
    }
}