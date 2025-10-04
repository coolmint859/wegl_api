/**
 * Processes basic input from the mouse. 
 * */
export default class MouseInput {
    static Button = Object.freeze({
        LEFT: 'left',
        MIDDLE: 'middle',
        RIGHT: 'right'
    });

    static Cursor = Object.freeze({
        DEFAULT: 'default', 
        GRAB: 'grab',
        CROSSHAIR: 'crosshair',
        POINTER: 'pointer',
        NONE: 'none'
    })

    #targetElement;

    #mouseState = {
        left: { isPressed: false, isReleased: false, callbackTriggered: false },
        middle: { isPressed: false, isReleased: false, callbackTriggered: false },
        right: { isPressed: false, isReleased: false, callbackTriggered: false },
        posX: 0, posY: 0,
        deltaX: 0, deltaY: 0,
        isPointerLocked: false,
        lastHoveredObject: null
    }

    #commands = {
        click: { left: new Map(), middle: new Map(), right: new Map() },
        release: { left: new Map(), middle: new Map(), right: new Map() },
        drag: { left: new Map(), middle: new Map(), right: new Map() },
        move: new Map(),
        hoverUpdate: new Map(),
        hoverEnter: new Map(),
        hoverExit: new Map()
    }

    /**
     * Create a new MouseInput instance
     * @param {HTMLElement} targetElement the target HTML element to listen to mouse events
     */
    constructor(targetElement) {
        if (!(targetElement instanceof HTMLElement)) {
            console.error(`[Input] Expected 'targetElement' to be an instance of HTMLElement. Cannot initialize input.`);
            return;
        }
        this.#targetElement = targetElement;

        this.#targetElement.addEventListener('mousedown', this.#onMouseDown.bind(this));
        this.#targetElement.addEventListener('mouseup', this.#onMouseUp.bind(this));
        this.#targetElement.addEventListener('mousemove', this.#onMouseMove.bind(this));
        this.#targetElement.addEventListener('contextmenu', e => e.preventDefault()); 

        document.addEventListener('pointerlockchange', this.#onPointerLockChange.bind(this), false);
        document.addEventListener('pointerlockerror', this.#onPointerLockError.bind(this), false);
    }

    /**
     * Updates pointerlock flag based on pointer lock change
     */
    #onPointerLockChange() {
        if (document.pointerLockElement === this.#targetElement) {
            this.#mouseState.isPointerLocked = true;
            console.log(`[MouseInput] Pointer Lock engaged for element '${this.#targetElement.constructor.name}'.`);
        } else {
            this.#mouseState.isPointerLocked = false;
            console.log(`[MouseInput] Pointer Lock released for element '${this.#targetElement.constructor.name}'.`);
        }
    }

    /**
     * Called if pointer lock request had an error
     */
    #onPointerLockError() {
        console.error(`[MouseInput] Failed to engage Pointer Lock for element '${this.#targetElement.constructor.name}'.`);
        this.#mouseState.isPointerLocked = false;
    }

    /**
     * Converts a mouse button code into a string
     */
    #buttonName(buttonCode) {
        const button = Object.values(MouseInput.Button)[buttonCode];
        return button ?? null;
    }

    /** updates internal state of mouse down events */
    #onMouseDown(event) {
        const button = this.#buttonName(event.button);
        if (button !== null) {
            this.#mouseState[button].isPressed = true;
            this.#mouseState[button].isReleased = false;
        }
    }

    /** Updates internal state of mouse up events */
    #onMouseUp(event) {
        const button = this.#buttonName(event.button);
        if (button !== null) {
            this.#mouseState[button].isPressed = false;
            this.#mouseState[button].isReleased = true;
        }
    }

    /** Updates internal state on mouse move events */
    #onMouseMove(event) {
        // relative movement when locked
        if (this.isPointerLocked) {
            this.#mouseState.deltaX = event.movementX; 
            this.#mouseState.deltaY = event.movementY;

            this.#mouseState.posX += event.movementX;
            this.#mouseState.posY += event.movementY;
        // absolute movement when not locked
        } else {
            this.#mouseState.deltaX = event.clientX - this.#mouseState.posX;
            this.#mouseState.deltaY = event.clientY - this.#mouseState.posY;

            this.#mouseState.posX = event.clientX;
            this.#mouseState.posY = event.clientY;
        }
    }

    /**
     * Request the pointer to lock on the target element
     */
    requestPointerLock() {
        if (!this.isPointerLocked && this.#targetElement) {
            this.#targetElement.requestPointerLock();
        }
    }

    /**
     * Releases Pointer Lock if it is currently engaged.
     */
    exitPointerLock() {
        if (this.isPointerLocked) {
            document.exitPointerLock();
        }
    }

    /**
     * Check if the cursor pointer is locked to the target element
     * @returns {boolean} true if the pointer is locked, false otherwise
     */
    get isPointerLocked() {
        return this.#mouseState.isPointerLocked;
    }

    /**
     * Get the current mouse position relative the target html element
     * @returns an object with the x and y position of the mouse
     */
    get position() {
        return { x: this.#mouseState.posX, y: this.#mouseState.posY };
    }

    /**
     * Get the change in mouse position since the last animation frame
     * @returns an object with the dx and dy position of the mouse
     */
    get deltaPos() {
        return { dx: this.#mouseState.deltaX, dy: this.#mouseState.deltaY };
    }

    /**
     * Return the object the mouse was hovering over in the last animation frame
     * @returns { any | null } the object the mouse was hovering over. Is null if there was no object in the last frame.
     */
    get hoveredObject() {
        return this.#mouseState.lastHoveredObject;
    }

    /**
     * Check if a button is currently pressed
     * @param {string} button the button to check ('left', 'middle', 'right');
     * @returns {boolean} true if the provided button is currently pressed, false otherwise
     */
    isButtonPressed(button) {
        return this.#mouseState[button].isPressed;
    }

    /**
     * Sets the CSS cursor property for the target element.
     * @param {string} cursorType - The CSS cursor value (e.g., 'pointer', 'grab', 'crosshair', 'default').
     */
    setCursor(cursorType) {
        if (!Object.values(MouseInput.Cursor).includes(cursorType)) {
            console.error(`[MouseInput] Expected 'cursorType' to be valid cursor type. Cannot set cursor type.`)
            return;
        }
        if (this.#targetElement) {
            this.#targetElement.style.cursor = cursorType;
        }
    }

    /**
     * Register a mouse click event (default is left mouse button)
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called when the provided button is pressed.
     * @param {object} options options for callback invocation
     * @param {object} options.button the button to register the callback with. Default is the left mouse button
     * @param {object} options.callOnce if true, the callback will be invoked only once the button is first pressed, otherwise the callback will be invoked for as long as the button is pressed.
     * @param {number} options.tickRate if callOnce is false, this is the amount of time in seconds between callback invocations. Default is 0 (callback invoked every update). If callOnce is true, this value is ignored
     */
    registerMouseClick(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register click event.`);
            return;
        }
        const button = options.button ?? 'left';
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'options.button' to be a known mouse button type. Cannot register click event.`);
            return;
        }
        const callOnce = options.callOnce ?? true;
        const tickRate = options.tickRate ?? 0;
        this.#commands.click[button].set(id, { 
            callback, 
            callOnce,
            tickRate, 
            timeSinceLastInvoke: 0 
        });
    }

    /**
     * Unregister a mouse click event (default is left mouse button)
     * @param {string} id a unique identifier for the callback
     * @param {string} button the button that the callback was registered with. Default is the left mouse button
     */
    unregisterMouseClick(id, button='left') {
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot unregister click event.`);
            return;
        }
        this.#commands.click[button].delete(id);
    }

    /**
     * Register a mouse release event (default is left mouse button)
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called when the provided button is released.
     * @param {object} options options for callback invocation
     * @param {object} options.button the button to register the callback with. Default is the left mouse button
     */
    registerMouseRelease(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register release event.`);
            return;
        }
        const button = options.button ?? 'left';
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'options.button' to be a known mouse button type. Cannot register release event.`);
            return;
        }
        this.#commands.release[button].set(id, { callback });
    }

    /**
     * Unregister a mouse release event (default is left mouse button)
     * @param {string} id a unique identifier for the callback
     * @param {string} button the button that the callback was registered with. Default is the left mouse button
     */
    unregisterMouseRelease(id, button='left') {
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot unregister click event.`);
            return;
        }
        this.#commands.release[button].delete(id);
    }

    /**
     * Register a hover update event. This is called repeatedly for as long as update() is called.
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called each tick/update. It should return either the current object the mouse is under, or null if it isn't over any object
     * @param {object} options options for callback invocation
     * @param {number} options.tickRate the amount of time in seconds between callback invocations. Default is 0 (callback invoked every update)
     */
    registerHoverUpdate(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with hover event.`);
            return;
        }
        const tickRate = options.tickRate ?? 0;
        this.#commands.hoverUpdate.set(id, { callback, tickRate, timeSinceLastInvoke: 0 });
    }

    /**
     * unregister a hover update event
     * @param {string} id the identifier for the callback function
     */
    unregisterHoverUpdate(id) {
        this.#commands.hoverUpdate.delete(id);
    }

    /**
     * Register a hover enter event
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called whenever the cursor enters hovering over a new object
     */
    registerHoverEnter(id, callback) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with hover over event.`);
            return;
        }
        this.#commands.hoverEnter.set(id, { callback });
    }

    /**
     * unregister a hover enter event
     * @param {string} id the identifier for the callback function
     */
    unregisterHoverEnter(id) {
        this.#commands.hoverEnter.delete(id);
    }

    /**
     * Register a hover exit event
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called whenever the cursor exits hovering over an object
     */
    registerHoverExit(id, callback) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with hover exit event.`);
            return;
        }
        this.#commands.hoverExit.set(id, { callback });
    }

    /**
     * unregister a hover exit event
     * @param {string} id the identifier for the callback function
     */
    unregisterHoverExit(id) {
        this.#commands.hoverExit.delete(id);
    }

    /**
     * Register a mouse move event
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called each tick/update when the mouse moves
     * @param {object} options options for callback invocation
     * @param {number} options.tickRate the amount of time in seconds between callback invocations. Default is 0 (callback invoked every update)
     */
    registerMouseMove(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with hover over event.`);
            return;
        }
        const tickRate = options.tickRate ?? 0;
        this.#commands.move.set(id, { callback, tickRate });
    }

    /**
     * unregister a mouse move event
     * @param {string} id the identifier for the callback function
     */
    unregisterMouseMove(id) {
        this.#commands.move.delete(id);
    }

    /**
     * Register a mouse drag event
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called each tick/update when the specified button is pressed AND the mouse moves
     * @param {object} options options for callback invocation
     * @param {number} options.button the button that triggers the drag behavior. Default is the left mouse button ('left')
     * @param {number} options.tickRate the amount of time in seconds between callback invocations. Default is 0 (callback invoked every update)
     */
    registerMouseDrag(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with hover over event.`);
            return;
        }
        const button = options.button ?? 'left';
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot register drag event.`);
            return;
        }
        const tickRate = options.tickRate ?? 0;
        this.#commands.drag[button].set(id, { callback, tickRate, timeSinceLastInvoke: 0 });
    }

    /**
     * Register a mouse drag event
     * @param {string} id a unique identifier for the callback
     * @param {number} button the button that triggers the drag behavior. Default is the left mouse button ('left')
     */
    unregisterMouseDrag(id, button='left') {
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot unregister drag event.`);
            return;
        }
        this.#commands.drag.delete(id);
    }

    /**
     * This method should be called once per animation frame.
     * It processes all registered mouse events based on the current mouse state.
     * @param {number} dt elapsed time in seconds since the last animation frame
     */
    update(dt) {
        const mouseState = {
            deltaX: this.#mouseState.deltaX,
            deltaY: this.#mouseState.deltaY,
            posX: this.#mouseState.posX,
            posY: this.#mouseState.posY
        }

        const hoverObject = this.#processHoverEvents(dt, mouseState);
        this.#processMouseMove(dt, mouseState, hoverObject);

        for (const button of Object.values(MouseInput.Button)) {
            this.#processMouseClick(dt, mouseState, hoverObject, button);
            this.#processMouseRelease(dt, mouseState, hoverObject, button);
            this.#processMouseDrag(dt, mouseState, hoverObject, button);
        }

        this.#mouseState.lastHoveredObject = hoverObject;
        this.#mouseState.deltaX = 0;
        this.#mouseState.deltaY = 0;
    }

    /** Process mouse hover events (update, enter, exit), returns an object or null */
    #processHoverEvents(dt, mouseState) {
        const lastHoveredObject = this.#mouseState.lastHoveredObject;
        const mouseMoved = this.#mouseState.deltaX !== 0 || this.#mouseState.deltaY !== 0;

        // hover update events
        let currHoveredObject = null;
        if (mouseMoved || this.isPointerLocked) {
            for (const [id, command] of this.#commands.hoverUpdate) {
                if (command.timeSinceLastInvoke >= command.tickRate) {
                    mouseState.id = id;
                    currHoveredObject = command.callback(dt, mouseState);
                    command.timeSinceLastInvoke = 0;

                    if (currHoveredObject) break; // the first object found is the one used
                } else {
                    command.timeSinceLastInvoke += dt;
                }
            }
        }

        // hover exit events
        if (lastHoveredObject !== null && currHoveredObject !== lastHoveredObject) {
            for (const [id, command] of this.#commands.hoverExit) {
                // pass in last known hovered object to properly update state
                mouseState.id = id;
                command.callback(dt, mouseState, lastHoveredObject);
            }
        }

        // hover enter events
        if (currHoveredObject !== null && currHoveredObject !== lastHoveredObject) {
            for (const [id, command] of this.#commands.hoverEnter) {
                // pass in last known hovered object to properly update state
                mouseState.id = id;
                command.callback(dt, mouseState, currHoveredObject);
            }
        }

        return currHoveredObject;
    }

    /** Process mouse move events */
    #processMouseMove(dt, mouseState, currHoveredObject) {
        if (this.#mouseState.deltaX !== 0 || this.#mouseState.deltaY !== 0) {
            for (const [id, command] of this.#commands.move) {
                mouseState.id = id;
                command.callback(dt, mouseState, currHoveredObject);
            }
        }
    }

    /** Process mouse click events */
    #processMouseClick(dt, mouseState, currHoveredObject, button) {
        if (!this.#mouseState[button].isPressed) return;

        for (const [id, command] of this.#commands.click[button]) {
            mouseState.id = id;
            if (!command.callOnce) {
                if (command.timeSinceLastInvoke >= command.tickRate) {
                    command.callback(dt, mouseState, currHoveredObject);
                    command.timeSinceLastInvoke = 0;

                    this.#mouseState[button].callbackTriggered = true;
                // ensure the callback is triggered immediately for first invocation
                } else if (!this.#mouseState[button].callbackTriggered) {
                    command.callback(dt, mouseState, currHoveredObject);
                } else {
                    command.timeSinceLastInvoke += dt;
                }
                continue;
            }

            if (!this.#mouseState[button].callbackTriggered) {
                command.callback(dt, mouseState, currHoveredObject);
            }
        }

        this.#mouseState[button].callbackTriggered = true;
    }

    /** process mouse release events */
    #processMouseRelease(dt, mouseState, currHoveredObject, button) {
        if (!this.#mouseState[button].isReleased) return;

        for (const [id, command] of this.#commands.release[button]) {
            mouseState.id = id;
            command.callback(dt, mouseState, currHoveredObject);
        }

        this.#mouseState[button].isReleased = false;
        this.#mouseState[button].callbackTriggered = false;
    }

    /** process mouse drag events */
    #processMouseDrag(dt, mouseState, currHoveredObject, button) {
        const mouseMoved = this.#mouseState.deltaX !== 0 || this.#mouseState.deltaY !== 0;
        if (!mouseMoved || !this.#mouseState[button].isPressed) return;

        for (const [id, command] of this.#commands.drag[button]) {
            if (command.timeSinceLastInvoke >= command.tickRate) {
                mouseState.id = id;
                command.callback(dt, mouseState, currHoveredObject);
                command.timeSinceLastInvoke = 0;

                this.#mouseState[button].callbackTriggered = true;
            } else {
                command.timeSinceLastInvoke += dt;
            }
        }
    }
}