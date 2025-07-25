/**
 * Schedules events after a specified delay. Intended to be more useful for delayed events than setTimeout()
 */
export default class EventScheduler {
    static #eventMap = new Map();
    static #zeroDelayEvents = new Map();
    static #categoryMap = new Map();
    static #shouldUpdate = true; // for global pauses

    /**
     * Get the total number of currently scheduled events
     * @returns {number}
     */
    static get size() {
        return EventScheduler.#eventMap.size + EventScheduler.#zeroDelayEvents.size;
    }

    /**
     * Schedule a event to happen after some delay.
     * @param {string} alias a unique name representing this specific event
     * @param {number} delay the time in seconds for when the event should occur after it was first scheduled
     * @param {Function} callback the function that is called after the delay time expires.
     * @param {Function | null} options.onInterval a function that is called repeatedly at an interval untl the main callback is invoked. Should accept the alias and the current invocation count as a parameter
     * @param {number | null} options.interval the interval at which to call onInterval. Default is 1 second. If onInterval is not given, this value is ignored.
     * @param {string | null} options.eventData optional data that should get passed in to the eventCallback.
     * @param {string | null} options.category optionally group events by category. (i.e which resources it effects);
     * @param {string | null} options.eventType optionally ground events by type (ie what the event does)
     * @returns {boolean} true if the event was successfully scheduled, false otherwise.
     */
    static schedule(alias, delay, callback, options={}) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot schedule event.`);
            return false;
        }
        if (typeof delay !== 'number' || delay < 0) {
            console.error(`[EventScheduler] TypeError: Expected 'delay' to be a number greater than or equal to 0. Cannot schedule event '${alias}'.`);
            return false;
        }
        if (typeof callback !== 'function') {
            console.error(`[EventScheduler] TypeError: Expected 'callback' to be a function. Cannot schedule event '${alias}'.`);
            return false;
        }

        if (EventScheduler.#eventMap.has(alias)) {
            console.warn(`[EventScheduler] Event '${alias}' was already scheduled. Overwriting existing schedule.`);
        }
        const eventInfo = {
            delay, callback,
            data: options.eventData,
            onInterval: options.onInterval,
            interval: options.interval ? options.interval : 1,
            _onIntervalInvocationCount: 0,
            _timeSinceScheduled: 0,
            _timeSinceLastInterval: 0,
            _shouldUpdate: true,
        }
        if (delay > 0) {
            EventScheduler.#eventMap.set(alias, eventInfo);
        } else {
            EventScheduler.#zeroDelayEvents.set(alias, eventInfo);
        }

        const category = options.category;
        if (category && typeof category === 'string' && category.trim() !== '') {
            if (!EventScheduler.#categoryMap.has(category)) {
                EventScheduler.#categoryMap.set(category, new Set());
            }
            EventScheduler.#categoryMap.get(category).add(alias);
            EventScheduler.#eventMap.get(alias).category = category;
        } else if (category) {
            console.warn(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot associate event with category.`);
        }
        return true;
    }

    /**
     * Check if an event is currently scheduled
     * @param {string} alias the name representing the event
     * @returns true if the resource is currently scheduled, false otherwise
     */
    static isScheduled(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot check if event is scheduled.`);
            return false;
        }
        return EventScheduler.#eventMap.has(alias);
    }

    /**
     * Get a read-only snapshot of a scheduled resource.
     * @param {string} alias the name representing the event
     * @returns {object} a js object containing metadata about the event, excluding the callback
     */
    static peekAt(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot peek at event.`);
            return {};
        }
        const eventInfo = EventScheduler.#eventMap.get(alias)
        if (!eventInfo) {
            console.warn(`[EventScheduler] Event '${alias}' was not previously scheduled. Cannot peek at event.`);
            return false;
        }
        const readOnlyData = {
            alias: alias,
            delay: eventInfo.delay,
            timeSinceScheduled: eventInfo.timeSinceScheduled,
        }
        if (eventInfo.category) {
            readOnlyData.category = eventInfo.category;
        }
        return Object.freeze(readOnlyData);
    }

    /**
     * Get read-only snapshots of scheduled events assiocated with a category.
     * @param {string} category the category that scheduled events fall under
     * @returns {Map<string, object>} a map of aliases to read-only objects containing resource metadata
     */
    static peekAtCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot peek at events.`);
            return new Map();
        }
        if (!EventScheduler.#categoryMap.has(category)) {
            console.warn(`[EventScheduler] '${category}' was not found to have an associated resources. Cannot peek at events.`);
            return new Map();
        }
        const eventSnapshotMap = new Map();
        const categorizedAliasesArray = Array.from(EventScheduler.#categoryMap.get(category));
        for (const alias of categorizedAliasesArray) {
            eventSnapshotMap.set(alias, EventScheduler.peekAt(alias));
        }
        return eventSnapshotMap;
    }

    /**
     * Get read-only snapshots of all scheduled events.
     * @returns {Map<string, object>} a map of aliases to read-only objects containing event metadata
     */
    static peekAll() {
        const eventSnapshotMap = new Map();
        for (const alias of EventScheduler.#eventMap.keys()) {
            eventSnapshotMap.set(alias, EventScheduler.peekAt(alias));
        }
        return eventSnapshotMap;
    }

    /**
     * Cancel a scheduled event from happening. 
     * @param {string} alias the name representing the event
     * @returns {boolean} true if the event was found and cancelled, false otherwise.
     */
    static cancel(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot cancel event.`);
            return false;
        }
        if (!EventScheduler.#eventMap.has(alias)) {
            console.warn(`[EventScheduler] Event '${alias}' was not previously scheduled. Cannot cancel event.`);
            return false;
        }
        return EventScheduler.#eventMap.delete(alias);
    }

    /**
     * Cancel all scheduled events.
     * @returns {boolean} true if all scheduled events were cancelled, false otherwise.
     */
    static cancelAll() {
        if (EventScheduler.size === 0) {
            console.log(`[EventScheduler] No events currently scheduled.`)
        } else {
            console.log(`[EventScheduler] Cancelling ${EventScheduler.size} currently scheduled event(s).`);
            EventScheduler.#eventMap.clear();
        }
        return true;
    }

    /**
     * Cancel scheduled events by category.
     * @returns {boolean} true if the scheduled events were cancelled, false otherwise.
     */
    static cancelCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot cancel events.`);
            return false;
        }
        if (!EventScheduler.#categoryMap.has(category)) {
            console.warn(`[EventScheduler] '${category}' was not found to have any associated events. Cannot cancel events.`);
            return false;
        }
        let allEventsCancelled = true;
        const categorizedAliasesArray = Array.from(EventScheduler.#categoryMap.get(category));
        for (const alias of categorizedAliasesArray) {
            if (!EventScheduler.cancel(alias)) allEventsCancelled = false;
        }
        return allEventsCancelled;
    }

    /**
     * Invokes the callback of a scheduled event immediately, bypassing it's delay.
     * @param {string} alias the name representing the event
     * @returns {boolean} true if the event was successfully triggered, false otherwise.
     */
    static triggerEvent(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot trigger event.`);
            return false;
        }
        if (!EventScheduler.#eventMap.has(alias)) {
            console.error(`[EventScheduler] Event '${alias}' was not scheduled. Cannot trigger event.`);
            return false;
        }
        EventScheduler.#invokeCallback(alias, EventScheduler.#eventMap.get(alias));
        return true;
    }

    /**
     * Invoke the callbacks of all scheduled events in the given category immediately.
     * @param {string} category the category the events are associated with
     * @returns {boolean} true if all events within the category were successfully triggered, false otherwise.
     */
    static triggerCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot trigger events.`);
            return false;
        }
        if (!EventScheduler.#categoryMap.has(category)) {
            console.warn(`[EventScheduler] '${category}' was not found to have an associated events. Cannot trigger events.`);
            return false;
        }
        let allEventsTriggered = true;
        const categorizedAliasesArray = Array.from(EventScheduler.#categoryMap.get(category));
        for (const alias of categorizedAliasesArray) {
            if (!EventScheduler.triggerEvent(alias)) allEventsTriggered = false;
        }
        return allEventsTriggered;
    }

    /**
     * Dispose all currently scheduled resources immediately. Invokes their respective disposal callbacks.
     * @returns {boolean} true if all resources were successfully disposed, false otherwise.
     */
    static triggerAll() {
        if (EventScheduler.size === 0) {
            console.log(`[EventScheduler] No events currently scheduled, cannot trigger callbacks.`)
            return true;
        }

        let allEventsTriggered = true;
        const aliases = Array.from(EventScheduler.#eventMap.keys());
        for (const alias of aliases) {
            if (!EventScheduler.triggerEvent(alias)) {
                allEventsTriggered = false;
            }
        }
        return allEventsTriggered;
    }

    /**
     * Update the internal state of the Scheduler. If any event's delay time expires, this invokes their respective callbacks.
     */
    static update(dt) {
        if (typeof dt !== 'number' || dt < 0) {
            console.error(`[EventScheduler] TypeError: Expected 'dt' to be a non-negative number. Cannot update.`);
            return;
        }
        if (EventScheduler.size === 0) return; // nothing to update
        if (!EventScheduler.#shouldUpdate) return; // event timers paused

        const aliases = Array.from(EventScheduler.#eventMap.keys());
        for (const alias of aliases) {
            const eventInfo = EventScheduler.#eventMap.get(alias);
            if (eventInfo._timeSinceScheduled > eventInfo.delay) {
                EventScheduler.#invokeCallback(alias, eventInfo);
            } else if (eventInfo._shouldUpdate) {
                eventInfo._timeSinceScheduled += dt;
            }

            if (typeof eventInfo.onInterval === "function") {
                if (eventInfo._timeSinceLastInterval > eventInfo.interval) {
                    EventScheduler.#invokeOnInterval(alias, eventInfo);
                    eventInfo._timeSinceLastInterval = 0;
                } else if (eventInfo._shouldUpdate) {
                    eventInfo._timeSinceLastInterval += dt;
                }
            }
        }

        // call zero delay events immediately after delayed events
        const zeroDelayEvents = Array.from(EventScheduler.#zeroDelayEvents.keys());
        for (const eventAlias of zeroDelayEvents) {
            const eventInfo = EventScheduler.#zeroDelayEvents.get(eventAlias);
            EventScheduler.#invokeCallback(eventAlias, eventInfo);
        }
    }

    /**
     * Pause the timer on one or all scheduled events.
     * @param {string | null} alias a name to a specific event
     */
    static pause(alias = null) {
        if (alias && typeof alias === 'string' && alias.trim() !== '') {
            if (EventScheduler.#eventMap.has(alias)) {
                console.log(`[EventScheduler] Pausing timer of event '${alias}'.`)
                EventScheduler.#eventMap.get(alias).shouldUpdate = false;
            } else {
                console.warn(`[EventScheduler] Cannot pause timer of unscheduled event '${alias}'.`);
            }
        } else if (alias) {
            console.error(`[EventScheduler] Expected 'alias' to be a non-empty string. Cannot pause event timer.`)
        } else {
            // in this case, no alias was defined, so pause globally
            EventScheduler.#shouldUpdate = false;
        }
    }

    /**
     * Pause all timers of the events in the given category. All other event timers will continue as normal.
     * @param {string} category the category to match paused events with.
     */
    static pauseCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot pause event timers in category.`);
            return;
        }
        if (EventScheduler.#categoryMap.has(category)) {
            const categorizedAliasesArray = Array.from(EventScheduler.#categoryMap.get(category));
            for (const alias of categorizedAliasesArray) {
                EventScheduler.pause(alias);
            }
        }
    }

    /**
     * Resume event timers on one or all scheduled assets.
     * @param {string | null} alias a name to a specific event
     */
    static resume(alias = null) {
        if (alias && typeof alias === 'string' && alias.trim() !== '') {
            if (EventScheduler.#eventMap.has(alias)) {
                console.log(`[EventScheduler] Resuming timer of event '${alias}'.`);
                EventScheduler.#eventMap.get(alias).shouldUpdate = true;
            } else {
                console.warn(`[EventScheduler] Cannot resume unscheduled event '${alias}'.`)
            }
        } else if (alias) {
            console.error(`[EventScheduler] Expected 'alias' to be a non-empty string. Cannot resume event timer.`)
        } else {
            // in this case, no alias was defined.
            EventScheduler.#shouldUpdate = true;
        }
    }

    /**
     * Pause all event timers in the given category. All other event timers will continue as normal.
     * @param {string} category the category to match paused events with.
     */
    static resumeCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot pause event timers.`);
            return;
        }
        if (EventScheduler.#categoryMap.has(category)) {
            const categorizedAliasesArray = Array.from(EventScheduler.#categoryMap.get(category));
            for (const alias of categorizedAliasesArray) {
                EventScheduler.resume(alias);
            }
        }
    }

    /** invokes the final callback of an event. Interally called by update() and triggerEvent() */
    static #invokeCallback(alias, eventInfo) {
        try {
            eventInfo.callback(alias, eventInfo.data);
            // console.log(`[EventScheduler] Successfully triggered event '${alias}'.`);
        } catch (error) {
            console.error(`[EventScheduler] Error invoking callback for event '${alias}':`, error);
        } finally {
            const eventCategory = EventScheduler.#eventMap.get(alias).category;
            if (eventCategory) { // if the category exists, then it must have the alias
                EventScheduler.#categoryMap.get(eventCategory).delete(alias);
            }
            EventScheduler.#eventMap.delete(alias);
        }
    }

    /** invokes the inverval callbacks of an event. Interally called by update() */
    static #invokeOnInterval(alias, eventInfo) {
        try {
            eventInfo._onIntervalInvocationCount += 1;
            eventInfo.onInterval(alias, eventInfo._onIntervalInvocationCount, eventInfo.data);
        } catch (error) {
            console.error(`[EventScheduler] Error invoking callback for event '${alias}':`, error);
        }
    }
}