/**
 * Implements the observer pattern for general event listening
 */
export default class EventDispatcher {
    static EventType = Object.freeze({
        POSITION_CHANGE: 'position-change',
        ROTATION_CHANGE: 'rotation-change',
        SCALE_CHANGE: 'scale-change',
        FOV_CHANGE: 'fov-change'
    })

    #listenerMap;

    /**
     * Create a new EventDispatcher instance
     */
    constructor() {
        this.#listenerMap = new Map();
    }

    /**
     * Subscribe to a event
     * @param {string} eventType the event type to subsribe to.
     * @param {Function} callback the callback function for when the event occurs
     */
    subscribe(eventType, callback) {
        if (!this.#listenerMap.has(eventType)) {
            this.#listenerMap.set(eventType, []);
        }
        this.#listenerMap.get(eventType).push(callback);
    }

    /**
     * Unsubstribe from an event
     * @param {string} eventType the event type to unsubsribe from.
     * @param {Function} callback the callback associated with the subscriber
     */
    unsubscribe(eventType, callback) {
        const callbacks = this.#listenerMap.get(eventType);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);

            if (callbacks.length === 0) {
                this.#listenerMap.delete(eventType);
            }
        }
    }

    /**
     * Trigger a new event with optional payload, notifying any subscribers.
     * @param {string} eventType the event type to dispatch as
     * @param {any || null} payload optional data to send to the event listeners
     */
    dispatch(eventType, payload=null) {
        if (!this.#listenerMap.has(eventType)) {
            return;
        }

        for (const callback of this.#listenerMap.get(eventType)) {
            callback(payload);
        }
    }
}