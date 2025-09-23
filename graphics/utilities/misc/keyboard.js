/**
 * Processes basic input from the keyboard. 
 * */
export default class KeyBoardInput {
    #currentPressedKeys = new Set();
    #previousPressedKeys = new Set();

    #keyDownCommands = new Map();
    #keyUpCommands = new Map();

    constructor() {
        document.addEventListener('keydown', event => {
            this.#currentPressedKeys.add(event.code)
        });
        document.addEventListener('keyup', event => {
            this.#currentPressedKeys.delete(event.code)
        });
    }

    /**
     * Register a new keyDown event with this key
     * @param {string} key the key to register an event with
     * @param {function} callback the function to call when the key is pressed.
     * @param {object} [config={}] configuration variables for the key handler.
     * @param {boolean} [config.callOnce = false] if true, will only invoke callback when the key is first pressed. 
     * If false, will repeatedly invoke the callback for as long as the key is pressed.
     * @param {number} [config.delay = 0] amount of time in seconds before the callback is first invoked. Default is 0.
     */
    registerKeyDown(key, callback, config = {}) {
        if (typeof key !== 'string' || !key) {
            console.error("KeyBoardInput: Invalid key provided to registerKeyDown.");
            return;
        }
        if (typeof callback !== 'function') {
            console.error(`KeyBoardInput: Callback must be a function for key: ${key}`);
            return;
        }
        if (typeof config !== 'object') {
            console.error(`KeyBoardInput: Config must be a javascript object for key: ${key}`);
            return;
        }

        const {callOnce = false, delay = 0} = config;
        this.#keyDownCommands.set(key, {
            callback, 
            callOnce,
            delay,
            timeSincePressed: 0, // time since the key was pressed, reset upon release
            callbackTriggered: false // needed in case callOnce is true and delay > 0
        });
    }

    /**
     * Register a new keyUp event with this key
     * @param {string} key the key to register an event with
     * @param {function} callback the function to call when the key is released. Is called once immediately upon release.
     */
    registerKeyUp(key, callback) {
        if (typeof key !== 'string' || !key) {
            console.error("KeyBoardInput: Invalid key provided to registerKeyUp.");
            return;
        }
        if (typeof callback !== 'function') {
            console.error(`KeyBoardInput: Callback must be a function for key: ${key}`);
            return;
        }
        this.#keyUpCommands.set(key, { callback });
    }

    /**
     * Unregister the keyDown event associated with this key, if it exists
     * @param {string} key the key to unregister.
     */
    unregisterKeyDown(key) {
        this.#keyDownCommands.delete(key);
    }

    /**
     * Unregister the keyUp event associated with this key, if it exists
     * @param {string} key the key to unregister.
     */
    unregisterKeyUp(key) {
        this.#keyUpCommands.delete(key);
    }

    /**
     * Unregister any keyUp or keyDown events associated with this key
     * @param {string} key the key to unregister.
     */
    unregisterKey(key) {
        this.unregisterKeyDown(key);
        this.unregisterKeyUp(key);
    }

    /**
     * Checks if the given key is currently being pressed.
     * @param {string} key the key to check against
     * @returns {boolean} True if the key is currently pressed, false otherwise.
     */
    isKeyDown(key) {
        return this.#currentPressedKeys.has(key);
    }

    /**
     * This method should be called once per animation frame.
     * It processes all registered key events based on the current keyboard state.
     * @param {number} dt Delta time in seconds since the last frame.
     */
    update(dt) {
        // Iterate over all keys that are currently marked as pressed down
        for (const key of this.#currentPressedKeys) {
            const keyDownCommand = this.#keyDownCommands.get(key);
            if (keyDownCommand) {
                // if the key was just pressed, reset timer and callback toggle 
                if (this.#keyJustPressed(key)) {
                    keyDownCommand.timeSincePressed = 0;
                    keyDownCommand.callbackTriggered = false;
                }

                // if the key callback should be called once
                if (keyDownCommand.callOnce) {
                    // if the key was just pressed and delay is over
                    if (!keyDownCommand.callbackTriggered && keyDownCommand.timeSincePressed >= keyDownCommand.delay) {
                        keyDownCommand.callback(dt);
                        keyDownCommand.callbackTriggered = true;
                    }
                // callball should be called repeatedly, just check if delay is over
                } else if (keyDownCommand.timeSincePressed >= keyDownCommand.delay) {
                    keyDownCommand.callback(dt);
                }
                // accumulate key timer
                keyDownCommand.timeSincePressed += dt;
            }
        }

        // Iterate over all keys that were previously marked as pressed down
        for (const key of this.#previousPressedKeys) {
            const keyUpCommand = this.#keyUpCommands.get(key);

            // if the key was just released, invoke callback
            if (keyUpCommand && this.#keyJustReleased(key)) {
                keyUpCommand.callback(dt);
            }
        }

        // Clear the previous state and copy the current state into it.
        this.#previousPressedKeys.clear();
        for (const key of this.#currentPressedKeys) {
            this.#previousPressedKeys.add(key);
        }
    }

    /** 
     * Returns true if the given key was just pressed this frame, false otherwise.
     * */
    #keyJustPressed(key) {
        return !this.#previousPressedKeys.has(key) && this.#currentPressedKeys.has(key);
    }

    /** 
     * Returns true if the given key was just released this frame, false otherwise.
     * */
    #keyJustReleased(key) {
        return this.#previousPressedKeys.has(key) && !this.#currentPressedKeys.has(key);
    }
}