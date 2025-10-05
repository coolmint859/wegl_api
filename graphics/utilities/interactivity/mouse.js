/**
 * Processes time-dependent callback mouse events
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
        GRABBING: 'grabbing',
        NONE: 'none'
    })

    #targetElement;

    #mouseState = {
        left: { isPressed: false, isReleased: false },
        middle: { isPressed: false, isReleased: false },
        right: { isPressed: false, isReleased: false },
        posX: 0, posY: 0,
        deltaX: 0, deltaY: 0,
        isPointerLocked: false,
        lastHoveredID: null
    }

    #commands = {
        click: { left: new Map(), middle: new Map(), right: new Map() },
        release: { left: new Map(), middle: new Map(), right: new Map() },
        drag: { left: new Map(), middle: new Map(), right: new Map() },
        move: new Map(),
        hoverUpdate: new Map(),
        hoverEnter: new Map(),
        hoverExit: new Map(),
        targetEnter: new Map(),
        targetExit: new Map(),
    }

    #constantHoverUpdate = true;
    #mouseOverTargetElement = false;

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
        this.#targetElement.addEventListener('mouseenter', this.#onTargetHoverEnter.bind(this));
        this.#targetElement.addEventListener('mouseleave', this.#onTargetHoverExit.bind(this)); 

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
        switch(buttonCode) {
            case 0: return MouseInput.Button.LEFT;
            case 1: return MouseInput.Button.MIDDLE;
            case 2: return MouseInput.Button.RIGHT;
            default: return null;
        }
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
        // absolute movement when not locked
        } else {
            this.#mouseState.deltaX = event.clientX - this.#mouseState.posX;
            this.#mouseState.deltaY = event.clientY - this.#mouseState.posY;

            this.#mouseState.posX = event.clientX;
            this.#mouseState.posY = event.clientY;
        }
    }

    /** hover enter event on target element */
    #onTargetHoverEnter() {
        this.#mouseOverTargetElement = true;

        const mouseState = {
            deltaX: 0, deltaY: 0,
            posX: this.#mouseState.posX,
            posY: this.#mouseState.posY
        }
        for (const [id, command] of this.#commands.targetEnter) {
            command.callback(0, mouseState, id);
        }
    }

    /** hover exit event on target element */
    #onTargetHoverExit() {
        this.#mouseOverTargetElement = false;
        this.#mouseState.lastHoveredID = null;

        const mouseState = {
            deltaX: 0, deltaY: 0,
            posX: this.#mouseState.posX,
            posY: this.#mouseState.posY
        }
        for (const [id, command] of this.#commands.targetExit) {
            command.callback(0, mouseState, id);
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
     * Get the change in mouse position since the last browser update
     * @returns an object with the delta x and delta y position of the mouse
     */
    get deltaPos() {
        return { x: this.#mouseState.deltaX, y: this.#mouseState.deltaY };
    }

    /**
     * Return the id of the object the mouse was hovering over in the last update
     * @returns { number | string | null } the id of the object the mouse was hovering over. Is null if there was no object in the last frame.
     */
    get hoveredObjectID() {
        return this.#mouseState.lastHoveredID;
    }

    /** 
     * Check if the hover update logic has update callbacks run continously
     * @returns {boolean} true if hover update events run continously, false otherwise
     */
    get constantHoverUpdate() {
        return this.#constantHoverUpdate;
    }

    /**
     * Set whether the hover update logic should invoke callbacks continuously.
     * @param isConstant when true, hover updates are continuous, otherwise hover updates only occur when the mouse moves or the pointer lock is engaged.
     */
    set constantHoverUpdate(isConstant) {
        this.#constantHoverUpdate = isConstant;
    }

    /**
     * Check if a button is currently pressed
     * @param {string} button the button to check (e.g. 'left', 'middle', 'right');
     * @returns {boolean} true if the provided button is currently pressed, false otherwise
     */
    isButtonPressed(button) {
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot check click event status.`);
            return false;
        }
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
     * @param {number} options.fireRate if callOnce is false, this is the amount of time in seconds between callback invocations. Default is 0 (callback invoked every update). If callOnce is true, this value is ignored
     */
    registerMouseClick(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register click event.`);
            return;
        }
        const button = options.button ?? MouseInput.Button.LEFT;
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'options.button' to be a known mouse button type. Cannot register click event.`);
            return;
        }
        if (this.#commands.click[button].has(id)) {
            console.error(`[MouseInput] A mouse click event with id ${id} already has a registered callback. Cannot register click event.`);
            return;
        }

        const callOnce = options.callOnce ?? true;
        const fireRate = options.fireRate ?? 0;
        this.#commands.click[button].set(id, { 
            callback, 
            callOnce,
            fireRate, 
            timeSinceLastInvoke: 0,
            callbackInvoked: false
        });
    }

    /**
     * Unregister a mouse click event (default is left mouse button)
     * @param {string} id the unique identifier for the callback
     * @param {string} button the button that the callback was registered with. Default is the left mouse button
     */
    unregisterMouseClick(id, button=MouseInput.Button.LEFT) {
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
        const button = options.button ?? MouseInput.Button.LEFT;
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'options.button' to be a known mouse button type. Cannot register release event.`);
            return;
        }
        if (this.#commands.release[button].has(id)) {
            console.error(`[MouseInput] A mouse click event with id ${id} already has a registered callback. Cannot register release event.`);
            return;
        }
        this.#commands.release[button].set(id, { callback });
    }

    /**
     * Unregister a mouse release event (default is left mouse button)
     * @param {string} id the unique identifier for the callback
     * @param {string} button the button that the callback was registered with. Default is the left mouse button
     */
    unregisterMouseRelease(id, button=MouseInput.Button.LEFT) {
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot unregister click event.`);
            return;
        }
        this.#commands.release[button].delete(id);
    }

    /**
     * Register a hover update event. This is called repeatedly for as long as update() is called.
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called each tick/update. It should return either the current object the mouse is over, or null if it isn't over any object
     * @param {object} options options for callback invocation
     * @param {number} options.fireRate the amount of time in seconds between callback invocations. Default is 0 (callback invoked every update)
     */
    registerHoverUpdate(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with hover event.`);
            return;
        }
        if (this.#commands.hoverUpdate.has(id)) {
            console.error(`[MouseInput] A mouse hover update event with id ${id} already has a registered callback. Cannot register hover update event.`);
            return;
        }
        const fireRate = options.fireRate ?? 0;
        this.#commands.hoverUpdate.set(id, { callback, fireRate, timeSinceLastInvoke: 0 });
    }

    /**
     * unregister a hover update event
     * @param {string} id the unique identifier for the callback
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
        if (this.#commands.hoverEnter.has(id)) {
            console.error(`[MouseInput] A mouse hover update event with id ${id} already has a registered callback. Cannot register hover enter event.`);
            return;
        }
        this.#commands.hoverEnter.set(id, { callback });
    }

    /**
     * unregister a hover enter event
     * @param {string} id the unique identifier for the callback
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
        if (this.#commands.hoverExit.has(id)) {
            console.error(`[MouseInput] A mouse hover update event with id ${id} already has a registered callback. Cannot register hover exit event.`);
            return;
        }
        this.#commands.hoverExit.set(id, { callback });
    }

    /**
     * unregister a hover exit event
     * @param {string} id the unique identifier for the callback
     */
    unregisterHoverExit(id) {
        this.#commands.hoverExit.delete(id);
    }

    /**
     * Register a mouse move event
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called each tick/update when the mouse moves
     * @param {object} options options for callback invocation
     * @param {number} options.fireRate the amount of time in seconds between callback invocations. Default is 0 (callback invoked every update)
     */
    registerMouseMove(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with hover over event.`);
            return;
        }
        if (this.#commands.move.has(id)) {
            console.error(`[MouseInput] A mouse move event with id ${id} already has a registered callback. Cannot register mouse move event.`);
            return;
        }
        const fireRate = options.fireRate ?? 0;
        this.#commands.move.set(id, { callback, fireRate, timeSinceLastInvoke: 0 });
    }

    /**
     * unregister a mouse move event
     * @param {string} id the unique identifier for the callback
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
     * @param {number} options.fireRate the amount of time in seconds between callback invocations. Default is 0 (callback invoked every update)
     */
    registerMouseDrag(id, callback, options={}) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with hover over event.`);
            return;
        }
        const button = options.button ?? MouseInput.Button.LEFT;
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot register drag event.`);
            return;
        }
        if (this.#commands.drag[button].has(id)) {
            console.error(`[MouseInput] A mouse drag event with id ${id} already has a registered callback. Cannot register mouse drag event.`);
            return;
        }
        const fireRate = options.fireRate ?? 0;
        this.#commands.drag[button].set(id, { callback, fireRate, timeSinceLastInvoke: 0, callbackInvoked: false });
    }

    /**
     * Unregister a mouse drag event
     * @param {string} id the unique identifier for the callback
     * @param {number} button the button that triggers the drag behavior. Default is the left mouse button ('left')
     */
    unregisterMouseDrag(id, button=MouseInput.Button.LEFT) {
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot unregister drag event.`);
            return;
        }
        this.#commands.drag[button].delete(id);
    }


    /**
     * Register a mouse move event that's only triggered when pointer lock is enabled
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called only when the mouse moved AND pointer lock is enabled.
     * @param {object} options options for callback invocation
     * @param {object} options.fireRate the amount of time in seconds between mouse move callback invocations. Default is 0 (callback invoked every update)
     * @param {string} options.lockButton the button that triggers pointerlock. Default is the left mouse button.
     */
    registerLockedMovement(id, callback, options={}) {
        const button = options.lockButton ?? MouseInput.Button.LEFT;
        if (this.#commands.click[button].has(id)) {
            console.error(`[MouseInput] A mouse click event with id ${id} already has a registered callback. Cannot register mouse click event.`);
            return;
        }
        this.registerMouseClick(id, () => this.requestPointerLock(), { button });

        const fireRate = options.fireRate ?? 0;
        this.registerMouseMove(id, (dt, event, hoverObject) => {
            if (!this.isPointerLocked) return;
            callback(dt, event, hoverObject);
        }, { fireRate })
    }

    /**
     * Unregisters a locked move event.
     * @param {string} id the unique identifier for the callback
     * @param {string} lockButton the button that triggers pointerlock.
     */
    unregisterLockedMovement(id, lockButton=MouseInput.Button.LEFT) {
        if (!Object.values(MouseInput.Button).includes(lockButton)) {
            console.error(`[MouseInput] Expected 'lockButton' to be a known mouse button type. Cannot unregister move lock event.`);
            return;
        }
        this.unregisterMouseClick(id, lockButton); // Remove click command
        this.unregisterMouseMove(id); // Remove move command
    }

    /**
     * Register a mouse click event that's only triggered when the mouse is over a target object
     * 
     * Note: A hover update event in the same space as the target object must be defined for the callback to trigger.
     * @param {string} id a unique identifier for the callback
     * @param {any} targetID the target object id to compare the currently hovered over object with.
     * @param {Function} callback this function is called when the mouse is hovering over the target object AND the provided mouse button is pressed
     * @param {object} options options for callback invocation
     * @param {object} options.callOnce if true, the callback will be invoked once at the start of the press cycle, otherwise it will be invoked every update/tick for as long as the button is pressed.
     * @param {object} options.fireRate the amount of time in seconds between mouse move callback invocations. Default is 0 (callback invoked every update)
     * @param {string} options.button the button that invokes the callback. Default is the left mouse button.
     */
    registerHoverTargetClick(id, targetID, callback, options={}) {
        const button = options.lockButton ?? MouseInput.Button.LEFT;
        if (this.#commands.click[button].has(id)) {
            console.error(`[MouseInput] A mouse click event with id ${id} already has a registered callback. Cannot register mouse click event.`);
            return;
        }
        this.registerMouseClick(id, (dt, event, hoveredObject) => {
            if (this.#mouseState.lastHoveredID !== targetID) return;

            callback(dt, event, hoveredObject);
        }, options);
    }

    /**
     * Register a mouse click event that's only triggered when the mouse is over a target object
     * 
     * Note: A hover update event in the same space as the target object must be defined for the callback to trigger.
     * @param {string} id a unique identifier for the callback
     * @param {any} button the button that would invoke the callback
     */
    unregisterHoverTargetClick(id, button=MouseInput.Button.LEFT) {
        if (!Object.values(MouseInput.Button).includes(button)) {
            console.error(`[MouseInput] Expected 'button' to be a known mouse button type. Cannot unregister drag event.`);
            return;
        }
        this.#commands.click[button].delete(id);
    }

    /**
     * Register a mouse hover enter event for when the mouse enters the target DOM element. These are executed independent of update()
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called when the mouse enters the target element
     */
    registerTargetEnter(id, callback) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with target enter event.`);
            return;
        }
        if (this.#commands.targetEnter.has(id)) {
            console.error(`[MouseInput] A target enter event with id ${id} already has a registered callback. Cannot register target enter event.`);
            return;
        }
        this.#commands.targetEnter.set(id, { callback });
    }

    /**
     * unregister a mouse target DOM hover enter event.
     * @param {string} id a unique identifier for the callback
     */
    unregisterTargetEnter(id) {
        this.#commands.targetEnter.delete(id);
    }

    /**
     * Register a mouse hover exit event for when the mouse exits the target DOM element. These are executed independent of update()
     * @param {string} id a unique identifier for the callback
     * @param {Function} callback this function is called when the mouse exits the target element
     */
    registerTargetExit(id, callback) {
        if (typeof callback !== 'function') {
            console.error(`[MouseInput] Expected 'callback' to be a function. Cannot register function with target exit event.`);
            return;
        }
        if (this.#commands.targetExit.has(id)) {
            console.error(`[MouseInput] A target exit event with id ${id} already has a registered callback. Cannot register target exit event.`);
            return;
        }
        this.#commands.targetExit.set(id, { callback });
    }

    /**
     * Register a mouse hover enter event for when the mouse enters the target DOM element. These are executed independent of update()
     * @param {string} id a unique identifier for the callback
     */
    unregisterTargetExit(id) {
        this.#commands.targetExit.delete(id);
    }

    /**
     * This method should be called once per animation frame.
     * It processes all registered mouse events based on the current mouse state.
     * @param {number} dt elapsed time in seconds since the last animation frame
     */
    update(dt) {
        // snapshot the mouse state for this frame
        const mouseState = {
            deltaX: this.#mouseState.deltaX,
            deltaY: this.#mouseState.deltaY,
            posX: this.#mouseState.posX,
            posY: this.#mouseState.posY
        }

        // process hover events
        const hoverObjectID = this.#processHoverUpdate(dt, mouseState);
        this.#processHoverState(dt, mouseState, hoverObjectID);

        // process mouse events
        this.#processMouseMove(dt, mouseState, hoverObjectID);
        for (const button of Object.values(MouseInput.Button)) {
            this.#processMouseRelease(dt, mouseState, hoverObjectID, button);
            this.#processMouseClick(dt, mouseState, hoverObjectID, button);
            this.#processMouseDrag(dt, mouseState, hoverObjectID, button);
        }

        // reset mouse state
        this.#mouseState.lastHoveredID = hoverObjectID;
        this.#mouseState.deltaX = 0;
        this.#mouseState.deltaY = 0;
    }

    /** Process mouse hover updates, returns an object id or null */
    #processHoverUpdate(dt, mouseState) {
        if (!this.#mouseOverTargetElement) {
            return this.#mouseState.lastHoveredID;
        };

        const mouseMoved = this.#mouseState.deltaX !== 0 || this.#mouseState.deltaY !== 0;
        if (!(mouseMoved || this.isPointerLocked || this.#constantHoverUpdate)) {
            return this.#mouseState.lastHoveredID;
        }

        // hover update events
        let currHoveredID = null;
        for (const [id, command] of this.#commands.hoverUpdate) {
            command.timeSinceLastInvoke += dt;
            if (command.fireRate <= 0 || command.timeSinceLastInvoke >= command.fireRate) {
                const returnID = command.callback(dt, mouseState, null, id);

                if (command.fireRate > 0) { // prevent divide by 0 errors
                    command.timeSinceLastInvoke %= command.fireRate;
                }

                if (returnID && !currHoveredID) {
                    currHoveredID = returnID;
                    break;
                }
            }
        }
        return currHoveredID;
    }

    /** process mouse hover enter events */
    #processHoverState(dt, mouseState, currHoveredID) {
        const lastHoveredID = this.#mouseState.lastHoveredID;

        // hover exit events (idA -> null || idA -> idB)
        if (lastHoveredID && currHoveredID !== lastHoveredID) {
            for (const [id, command] of this.#commands.hoverEnter) {
                // pass in id of object just exited
                command.callback(dt, mouseState, currHoveredID, id);
            }
        }

        // hover enter events (null -> idB || idA -> idB)
        if (currHoveredID && currHoveredID !== lastHoveredID) {
            for (const [id, command] of this.#commands.hoverExit) {
                // pass in id of object just entered
                command.callback(dt, mouseState, lastHoveredID, id);
            }
        }
    }

    /** Process mouse move events */
    #processMouseMove(dt, mouseState, currHoveredID) {
        if (this.#mouseState.deltaX !== 0 || this.#mouseState.deltaY !== 0) {
            for (const [id, command] of this.#commands.move) {
                // continuous per-update callbacks
                if (command.fireRate <= 0) {
                    command.callback(dt, mouseState, currHoveredID, id);
                    continue;
                }

                // continuous rate-limited callbacks
                command.timeSinceLastInvoke += dt;
                while (command.timeSinceLastInvoke >= command.fireRate) {
                    command.callback(dt, mouseState, currHoveredID);
                    command.timeSinceLastInvoke -= command.fireRate;
                }
            }
        }
    }

    /** process mouse release events */
    #processMouseRelease(dt, mouseState, currHoveredID, button) {
        if (!this.#mouseState[button].isReleased) return;

        for (const [id, command] of this.#commands.release[button]) {
            command.callback(dt, mouseState, currHoveredID, id);
        }

        // reset click events
        for (const [id, command] of this.#commands.click[button]) {
            command.callbackInvoked = false;
            command.timeSinceLastInvoke = 0;
        }

        // reset drag events
        for (const [id, command] of this.#commands.drag[button]) {
            command.callbackInvoked = false;
            command.timeSinceLastInvoke = 0;
        }

        this.#mouseState[button].isReleased = false;
    }

    /** Process mouse click events */
    #processMouseClick(dt, mouseState, currHoveredID, button) {
        if (!this.#mouseState[button].isPressed) return;

        for (const [id, command] of this.#commands.click[button]) {
            // one time callbacks
            if (command.callOnce) {
                if (!command.callbackInvoked) {
                    command.callback(dt, mouseState, currHoveredID, id);
                    command.callbackInvoked = true;
                }
                continue;
            }

            // continuous per-update callbacks
            if (!command.callbackInvoked || command.fireRate <= 0) {
                command.callback(dt, mouseState, currHoveredID, id);
                command.callbackInvoked = true;
                continue;
            }

            // continuous rate-limited callbacks
            command.timeSinceLastInvoke += dt;
            while (command.timeSinceLastInvoke >= command.fireRate) {
                command.callback(dt, mouseState, currHoveredID, id);
                command.timeSinceLastInvoke -= command.fireRate;
            }
        }
    }

    /** process mouse drag events */
    #processMouseDrag(dt, mouseState, currHoveredID, button) {
        const mouseMoved = this.#mouseState.deltaX !== 0 || this.#mouseState.deltaY !== 0;
        if (!mouseMoved || !this.#mouseState[button].isPressed) return;

        for (const [id, command] of this.#commands.drag[button]) {
            // continuous per-update callbacks
            if (!command.callbackInvoked || command.fireRate <= 0) {
                command.callback(dt, mouseState, currHoveredID, id);
                command.callbackInvoked = true;
                continue;
            }

            // continuous rate-limited callbacks
            command.timeSinceLastInvoke += dt;
            while (command.timeSinceLastInvoke >= command.fireRate) {
                command.callback(dt, mouseState, currHoveredID, id);
                command.timeSinceLastInvoke -= command.fireRate;
            }
        }
    }
}