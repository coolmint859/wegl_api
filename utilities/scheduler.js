/**
 * Schedules events after a specified delay. Intended to be more useful for delayed events than setTimeout()
 */
export default class EventScheduler {
    static #eventMap = new Map();
    static #zeroDelayEvents = new Map();
    static #categoryMap = new Map();
    static #typeMap = new Map();
    static #waitingMap = new Map();
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
     * @param {number} delay the time in seconds for when the event should occur after it was first scheduled. Values <= 0 will trigger the event immediately
     * @param {Function} callback the function that is called after the delay time expires.
     * @param {object} options event schedule options
     * @param {Function | null} options.onInterval a function that is called repeatedly at an interval untl the main callback is invoked. Should accept the alias and the current invocation count as a parameter, and if set, the optional data parameter
     * @param {number | null} options.interval the interval at which to call onInterval. Default is 1 second. If onInterval is not given, this value is ignored.
     * @param {number | null} options.maxIntervalInvocations the maximum number of times onInterval will be invoked. If not specified, the onInterval will be invoked regularly until the main callback is invoked.
     * @param {string | null} options.eventData optional data that should get passed in to the callbacks (including onInterval).
     * @param {string | null} options.category place the event into a category. (i.e what the event affects);
     * @param {string | null} options.eventType place the event into a type (ie what the event does)
     * @param {number | null} options.timeScale a modifier on the timer accumulation. values < 1 will slow the event timer (making it take longer to trigger) and values > 1 will speed up the event timer . Default is 1 (no effect)
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
        const event = {
            delay, callback,
            data: options.eventData,
            onInterval: options.onInterval,
            interval: options.interval ?? 1,
            timeScale: options.timeScale ?? 1,
            maxIntervalInvocations: options.maxIntervalInvocations ?? -1,
            _intervalsInvoked: 0,
            _timeSinceScheduled: 0,
            _timeSinceLastInterval: 0,
            _shouldUpdate: true,
        }
        if (delay > 0) {
            EventScheduler.#eventMap.set(alias, event);
        } else {
            EventScheduler.#zeroDelayEvents.set(alias, event);
        }

        const category = options.category;
        if (typeof category === 'string' && category.trim() !== '') {
            if (!EventScheduler.#categoryMap.has(category)) {
                EventScheduler.#categoryMap.set(category, new Set());
            }
            EventScheduler.#categoryMap.get(category).add(alias);
            EventScheduler.#eventMap.get(alias).category = category;
        } else if (category) {
            console.warn(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot associate event with category.`);
        }

        const type = options.eventType;
        if (typeof type === 'string' && type.trim() !== '') {
            if (!EventScheduler.#typeMap.has(type)) {
                EventScheduler.#typeMap.set(type, new Set());
            }
            EventScheduler.#typeMap.get(type).add(alias);
            EventScheduler.#eventMap.get(alias).type = type;
        } else if (type) {
            console.warn(`[EventScheduler] TypeError: Expected 'eventType' to be a non-empty string. Cannot associate event with type.`);
        }
        return true;
    }

    /**
     * Schedule the same event multiple times, spaced out by an interval
     * @param {string} eventType the type of event that fires (used to reference the events as a whole)
     * @param {number} delay the time in seconds before the first event occurs
     * @param {number} count the number of events to fire
     * @param {Function} callback the function that is called after the delay time expires. Should except the event type, an invocation count, and event data (if provided)
     * @param {number} options.interval the time in seconds between each event. Default is 0 (the events occur at the same time). These begin *after* the delay period ends.
     * @param {any} options.eventData data that can be passed into the callback functions.
     * @param {number | null} options.timeScale a modifier on the timer accumulation. values < 1 will slow the event timers (making them take longer to trigger) and values > 1 will speed up the event timers. Default is 1 (no effect)
     * @returns {boolean} true if the event was successfully scheduled, false otherwise.
     */
    static scheduleMany(eventType, delay, count, callback, options={}) {
        if (typeof eventType !== 'string' || eventType.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'eventType' to be a non-empty string. Cannot schedule events.`);
            return false;
        }
        if (typeof delay !== 'number' || delay < 0) {
            console.error(`[EventScheduler] TypeError: Expected 'delay' to be a number greater than or equal to 0. Cannot schedule events '${eventType}'.`);
            return false;
        }
        if (typeof count !== 'number' || count < 0) {
            console.error(`[EventScheduler] TypeError: Expected 'delay' to be a number greater than or equal to 0. Cannot schedule events '${eventType}'.`);
            return false;
        }
        if (typeof callback !== 'function') {
            console.error(`[EventScheduler] TypeError: Expected 'callback' to be a function. Cannot schedule events '${eventType}'.`);
            return false;
        }
        let allEventsScheduled = true;
        const interval = options.interval ? options.interval : 0;
        console.log(options.interval);
        for (let i = 0; i < count; i++) {
            const totalDelay = delay + interval * i;
            let scheduled = EventScheduler.schedule(`${eventType}#${i+1}`, totalDelay, callback, { timeScale: options.timeScale, eventData: options.eventData });
            if (!scheduled) allEventsScheduled = false;
        }
        return allEventsScheduled;
    }

    /**
     * Schedule a event to happen after another event and after some delay
     * @param {string} otherEvent the alias of an event already scheduled. The new event will be scheduled only after this one occurs
     * @param {string} alias a unique name representing this specific event
     * @param {number} delay the time in seconds for when this event should occur after the other event occurs. Values <= 0 will trigger the event immediately after
     * @param {Function} callback the function that is called after the delay time expires.
     * @param {object} options event schedule options
     * @param {Function | null} options.onInterval a function that is called repeatedly at an interval untl the main callback is invoked. Should accept the alias and the current invocation count as a parameter, and if set, the optional data parameter
     * @param {number | null} options.interval the interval at which to call onInterval. Default is 1 second. If onInterval is not given, this value is ignored.
     * @param {number | null} options.maxIntervalInvocations the maximum number of times onInterval will be invoked. If not specified, the onInterval will be invoked regularly until the main callback is invoked.
     * @param {string | null} options.eventData optional data that should get passed in to the callbacks (including onInterval).
     * @param {string | null} options.category place the event into a category. (i.e what the event affects)
     * @param {string | null} options.eventType place the event into a type (i.e. what the event does)
     * @param {number | null} options.timeScale a modifier on the timer accumulation. values < 1 will slow the event timer (making the event take longer to trigger) and values > 1 will speed up the event timer . Default is 1 (no effect)
     * @returns {boolean} true if the event was successfully added to the waiting list, false otherwise.
     */
    static scheduleAfter(otherEvent, alias, delay, callback, options={}) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot schedule event.`);
            return false;
        }
        if (typeof otherEvent !== 'string' || otherEvent.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot schedule event.`);
            return false;
        }
        if (!EventScheduler.#eventMap.has(otherEvent)) {
            console.error(`[EventScheduler] Cannot schedule event to occur after an event that doesn't exist.`);
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

        const event = {
            alias: alias,
            delay: delay,
            callback: callback,
            onInterval: options.onInterval || null,
            interval: options.interval ?? 1000,
            maxIntervalInvocations: options.maxIntervalInvocations ?? -1,
            timeScale: options.timeScale ?? 1,
            category: options.category || null,
            type: options.type || null,
            _intervalsInvoked: 0,
            _timeSinceScheduled: 0,
            _timeSinceLastInterval: 0,
            _shouldUpdate: true,
        };
        if (EventScheduler.#waitingMap.has(otherEvent)) {
            if (EventScheduler.#waitingMap.get(otherEvent).has(alias)) {
                console.log(`[EventScheduler] Event '${alias}' was already scheduled to happen after event '${otherEvent}'.`);
                return true;
            }
            EventScheduler.#waitingMap.get(otherEvent).set(event);
        } else {
            EventScheduler.#waitingMap.set(otherEvent, new Map());
            EventScheduler.#waitingMap.get(otherEvent).set(event);
        }
        return true;
    }

    /**
     * Check if an event is currently scheduled
     * @param {string} alias the name representing the event
     * @returns true if the event is currently scheduled, false otherwise
     */
    static isScheduled(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot check if event is scheduled.`);
            return false;
        }
        return EventScheduler.#eventMap.has(alias);
    }

    /**
     * Check if any events of the specfied type are currently scheduled
     * @param {string} type the event type
     * @returns true if the events are currently scheduled, false otherwise
     */
    static isTypeScheduled(type) {
        if (typeof type !== 'string' || type.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'type' to be a non-empty string. Cannot check if event type is scheduled.`);
            return false;
        }
        return EventScheduler.#typeMap.has(type);
    }

    /**
     * Set the time scale of an event. This takes effect immediately.
     * @param {string} alias the name of the event
     * @param {number} timeScale a modifier on the timer accumulation. values < 1 will slow the event timer (making the event take longer to trigger) and values > 1 will speed up the event timer.
     * @returns {boolean} true if the timer was scaled, false otherwise
     */
    static setTimeScale(alias, timeScale) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot set time scale of event.`);
            return false;
        }
        if (typeof timeScale !== 'number' || timeScale < 0) {
            console.error(`[EventScheduler] TypeError: Expected 'timeScale' to be a number greater or equal to 0. Cannot set time scale of event '${alias}'.`);
            return false;
        }
        if (!EventScheduler.#eventMap.has(alias)) {
            console.warn(`[EventScheduler] Could not find event '${alias}' in scheduled events. Cannot set time scale of event.`);
            return false;
        }
        EventScheduler.#eventMap.get(alias).timeScale = timeScale;
        return true;
    }

    /**
     * Set the time scale of events by category. This takes effect immediately.
     * @param {string} category the name of the category of events
     * @param {number} timeScale a modifier on the timer accumulation. values < 1 will slow the event timers (making the events take longer to trigger) and values > 1 will speed up the event timers.
     * @returns {boolean} true if the timers were scaled, false otherwise
     */
    static setCategoryTimeScale(category, timeScale) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot set time scale of events.`);
            return false;
        }
        if (typeof timeScale !== 'number' || timeScale < 0) {
            console.error(`[EventScheduler] TypeError: Expected 'timeScale' to be a number greater or equal to 0. Cannot set time scale of events in category '${category}'.`);
            return false;
        }
        if (!EventScheduler.#categoryMap.has(category)) {
            console.warn(`[EventScheduler] Could not find any events in category '${category}'. Cannot set time scale of events.`);
            return false;
        }
        let allTimeScalesSet = true;
        const eventsInCategory = EventScheduler.#categoryMap.get(category);
        for (const eventAlias of eventsInCategory) {
            if (!EventScheduler.setTimeScale(eventAlias, timeScale)) {
                allTimeScalesSet = false;
            }
        }
        return allTimeScalesSet;
    }

     /**
     * Set the time scale of events by type. This takes effect immediately.
     * @param {string} type the name of the event type
     * @param {number} timeScale a modifier on the timer accumulation. values < 1 will slow the event timers (making the events take longer to trigger) and values > 1 will speed up the event timers.
     * @returns {boolean} true if the timers were scaled, false otherwise
     */
    static setTypeTimeScale(type, timeScale) {
        if (typeof type !== 'string' || type.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'type' to be a non-empty string. Cannot set time scale of events.`);
            return false;
        }
        if (typeof timeScale !== 'number' || timeScale < 0) {
            console.error(`[EventScheduler] TypeError: Expected 'timeScale' to be a number greater or equal to 0. Cannot set time scale of events of type '${type}'.`);
            return false;
        }
        if (!EventScheduler.#typeMap.has(type)) {
            console.warn(`[EventScheduler] Could not find any events of type '${type}'. Cannot set time scale of events.`);
            return false;
        }
        let allTimeScalesSet = true;
        const eventsOfType = EventScheduler.#typeMap.get(type);
        for (const eventAlias of eventsOfType) {
            if (!EventScheduler.setTimeScale(eventAlias, timeScale)) {
                allTimeScalesSet = false;
            }
        }
        return allTimeScalesSet;
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
     * Get read-only snapshots of scheduled events in a category.
     * @param {string} category the category that scheduled events fall under
     * @returns {Map<string, object>} a map of aliases to read-only objects containing event metadata
     */
    static peekAtCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot peek at events.`);
            return new Map();
        }
        if (!EventScheduler.#categoryMap.has(category)) {
            console.warn(`[EventScheduler] '${category}' was not found to have an associated events. Cannot peek at events.`);
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
     * Get read-only snapshots of scheduled events of a specific type.
     * @param {string} type the type of event
     * @returns {Map<string, object>} a map of aliases to read-only objects containing event metadata
     */
    static peekAtType(type) {
        if (typeof type !== 'string' || type.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'type' to be a non-empty string. Cannot peek at events.`);
            return new Map();
        }
        if (!EventScheduler.#typeMap.has(type)) {
            console.warn(`[EventScheduler] No events of type '${type}' were found. Cannot peek at events.`);
            return new Map();
        }
        const eventSnapshotMap = new Map();
        const eventAliases = Array.from(EventScheduler.#typeMap.get(type));
        for (const alias of eventAliases) {
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
     * Cancel scheduled events by type.
     * @returns {boolean} true if the scheduled events were cancelled, false otherwise.
     */
    static cancelType(type) {
        if (typeof type !== 'string' || type.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'type' to be a non-empty string. Cannot cancel events.`);
            return false;
        }
        if (!EventScheduler.#typeMap.has(type)) {
            console.warn(`[EventScheduler] No events of type '${type}' were found. Cannot cancel events.`);
            return false;
        }
        let allEventsCancelled = true;
        const eventAliases = Array.from(EventScheduler.#typeMap.get(type));
        for (const alias of eventAliases) {
            if (!EventScheduler.cancel(alias)) allEventsCancelled = false;
        }
        return allEventsCancelled;
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
     * Invokes the callback of a scheduled event immediately, bypassing it's delay. Any waiting events will be scheduled immediately after.
     * @param {string} alias the name representing the event
     * @returns {boolean} true if the event was successfully triggered, false otherwise.
     */
    static trigger(alias) {
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
     * Invoke the callbacks of all scheduled events in the given category immediately. Any waiting events will be scheduled immediately after.
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
            if (!EventScheduler.trigger(alias)) allEventsTriggered = false;
        }
        return allEventsTriggered;
    }

    /**
     * Invoke the callbacks of all scheduled events in the given category immediately. Any waiting events will be scheduled immediately after.
     * @param {string} category the category the events are associated with
     * @returns {boolean} true if all events within the category were successfully triggered, false otherwise.
     */
    static triggerType(type) {
        if (typeof type !== 'string' || type.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'type' to be a non-empty string. Cannot trigger events.`);
            return false;
        }
        if (!EventScheduler.#typeMap.has(type)) {
            console.warn(`[EventScheduler] No events of type '${type}' were found. Cannot trigger events.`);
            return false;
        }
        let allEventsTriggered = true;
        const eventAliases = Array.from(EventScheduler.#typeMap.get(type));
        for (const alias of eventAliases) {
            if (!EventScheduler.trigger(alias)) allEventsTriggered = false;
        }
        return allEventsTriggered;
    }

    /**
     * Invoke all currently scheduled events immediately. Any waiting events will be scheduled immediately after.
     * @returns {boolean} true if all resources were successfully disposed, false otherwise.
     */
    static triggerAllActive() {
        if (EventScheduler.size === 0) {
            console.log(`[EventScheduler] No events currently scheduled, cannot trigger callbacks.`)
            return true;
        }

        let allEventsTriggered = true;
        const aliases = Array.from(EventScheduler.#eventMap.keys());
        for (const alias of aliases) {
            if (!EventScheduler.trigger(alias)) {
                allEventsTriggered = false;
            }
        }
        return allEventsTriggered;
    }

    /**
     * Update the internal state of the EventScheduler. If any event's delay time expires, this invokes their respective callbacks.
     * @param {number} dt - the amount of time since the last frame/update
     */
    static update(dt) {
        if (typeof dt !== 'number' || dt < 0) {
            console.error(`[EventScheduler] TypeError: Expected 'dt' to be a non-negative number. Cannot update.`);
            return;
        }
        if (EventScheduler.size === 0) return; // nothing to update
        if (!EventScheduler.#shouldUpdate) return; // event timers paused
        
        // events can cancel future events, so we need to copy the list over.
        const aliases = Array.from(EventScheduler.#eventMap.keys());
        for (const alias of aliases) {
            // this is needed in case an event cancels a separate event that hasn't been processed yet.
            if (!EventScheduler.#eventMap.has(alias)) continue;

            // invoke main callback if delay expired
            const event = EventScheduler.#eventMap.get(alias);
            if (event._timeSinceScheduled >= event.delay) {
                EventScheduler.#invokeCallback(alias, event); // this removes the event from the maps
            } else if (event._shouldUpdate) {
                event._timeSinceScheduled += dt * event.timeScale;
            }

            // first check if we should update onInterval dt
            if (event._shouldUpdate) {
                event._timeSinceLastInterval += dt * event.timeScale;
            }
            
            // then check if we can and should invoke onInterval
            const invalidIntervalFunc = typeof event.onInterval !== "function";
            const intervalCapPresent = event.maxIntervalInvocations > -1;
            const intervalCapReached = event.maxIntervalInvocations < event._intervalsInvoked;
            if (invalidIntervalFunc || (intervalCapPresent && intervalCapReached)) {
                continue;
            }

            // continue invocations until either the cap is reached or the time elapsed is less than the interval
            while (event._timeSinceLastInterval >= event.interval) {
                if (intervalCapPresent && event._intervalsInvoked >= event.maxIntervalInvocations) {
                    break; // Cap reached
                }
                EventScheduler.#invokeOnInterval(alias, event); // this updates the interval invocation count
                event._timeSinceLastInterval -= event.interval;
            }
        }
        // call zero delay events called only after other events
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
        if (typeof alias === 'string' && alias.trim() !== '') {
            if (EventScheduler.#eventMap.has(alias)) {
                console.log(`[EventScheduler] Pausing timer of event '${alias}'.`)
                EventScheduler.#eventMap.get(alias)._shouldUpdate = false;
                return true;
            } else {
                console.warn(`[EventScheduler] Cannot pause timer of unscheduled event '${alias}'.`);
                return false;
            }
        } else if (alias) {
            console.error(`[EventScheduler] Expected 'alias' to be a non-empty string. Cannot pause event timer.`);
            return false;
        } else {
            // in this case, no alias was defined, so pause globally
            EventScheduler.#shouldUpdate = false;
            return true;
        }
    }

    /**
     * Pause all timers of the events in the given category. All other event timers will continue as normal.
     * @param {string} category the category to match paused events with.
     */
    static pauseCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot pause event timers in category.`);
            return false;
        }
        if (!EventScheduler.#categoryMap.has(category)) {
            console.warn(`[EventScheduler] Category '${category}' was not found to have any associated events. Cannot pause event timers.`);
            return false;
        }
        let allEventsPaused = true;
        const categorizedAliasesArray = Array.from(EventScheduler.#categoryMap.get(category));
        for (const alias of categorizedAliasesArray) {
            if (!EventScheduler.pause(alias)) allEventsPaused = false;
        }
        return allEventsPaused;
    }

    /**
     * Pause all timers of the events of the given type. All other event timers will continue as normal.
     * @param {string} type the type of event
     */
    static pauseType(type) {
        if (typeof type !== 'string' || type.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'type' to be a non-empty string. Cannot pause event timers in category.`);
            return false;
        }
        if (!EventScheduler.#typeMap.has(type)) {
            console.warn(`[EventScheduler] Type '${type}' was not found to have any associated events. Cannot pause event timers.`);
            return false;
        }
        let allEventsPaused = true;
        const eventAliases = Array.from(EventScheduler.#typeMap.get(type));
        for (const alias of eventAliases) {
            if (!EventScheduler.pause(alias)) allEventsPaused = false;
        }
        return allEventsPaused;
    }

    /**
     * Resume event timers on one or all scheduled events.
     * @param {string | null} alias a name to a specific event
     */
    static resume(alias = null) {
        if (alias && typeof alias === 'string' && alias.trim() !== '') {
            if (EventScheduler.#eventMap.has(alias)) {
                console.log(`[EventScheduler] Resuming timer of event '${alias}'.`);
                EventScheduler.#eventMap.get(alias)._shouldUpdate = true;
                return true;
            } else {
                console.warn(`[EventScheduler] Cannot resume unscheduled event '${alias}'.`);
                return false;
            }
        } else if (alias) {
            console.error(`[EventScheduler] Expected 'alias' to be a non-empty string. Cannot resume event timer.`);
            return false;
        } else {
            // in this case, no alias was defined.
            EventScheduler.#shouldUpdate = true;
            return true;
        }
    }

    /**
     * Resume all timers of the events in the given category.
     * @param {string} category the category to match resumed events with.
     */
    static resumeCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot resume event timers in category.`);
            return false;
        }
        if (!EventScheduler.#categoryMap.has(category)) {
            console.warn(`[EventScheduler] Category '${category}' was not found to have any associated events. Cannot resume event timers.`);
            return false;
        }
        let allEventsResumed = true;
        const categorizedAliasesArray = Array.from(EventScheduler.#categoryMap.get(category));
        for (const alias of categorizedAliasesArray) {
            if (!EventScheduler.resume(alias)) allEventsResumed = false;
        }
        return allEventsResumed;
    }

    /**
     * Resume all timers of the events of the given type.
     * @param {string} type the type of event
     */
    static resumeType(type) {
        if (typeof type !== 'string' || type.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'type' to be a non-empty string. Cannot pause event timers in category.`);
            return false;
        }
        if (!EventScheduler.#typeMap.has(type)) {
            console.warn(`[EventScheduler] Category '${type}' was not found to have any associated events. Cannot pause event timers.`);
            return false;
        }
        let allEventsResumed = true;
        const eventAliases = Array.from(EventScheduler.#typeMap.get(category));
        for (const alias of eventAliases) {
            if (!EventScheduler.resume(alias)) allEventsResumed = false;
        }
        return allEventsResumed;
    }

    /** invokes the final callback of an event. Interally called by update() and triggerEvent() */
    static #invokeCallback(alias, event) {
        try {
            event.callback(alias, event.data);
        } catch (error) {
            console.error(`[EventScheduler] Error invoking callback for event '${alias}':`, error);
        } finally {
            const eventCategory = EventScheduler.#eventMap.get(alias).category;
            if (eventCategory) { // if the category exists, then it must have the alias
                EventScheduler.#categoryMap.get(eventCategory).delete(alias);
                if (EventScheduler.#categoryMap.get(eventCategory).size === 0) {
                    EventScheduler.#categoryMap.delete(eventCategory);
                }
            }
            const eventType = EventScheduler.#eventMap.get(alias).type;
            if (eventType) { // if the category exists, then it must have the alias
                EventScheduler.#typeMap.get(eventType).delete(alias);
                if (EventScheduler.#typeMap.get(eventType).size === 0) {
                    EventScheduler.#typeMap.delete(eventType);
                }
            }
            EventScheduler.#eventMap.delete(alias);

            // if any events were waiting on this event, we can schedule them now
            if (EventScheduler.#waitingMap.has(alias)) {
                const waitingEvents = EventScheduler.#waitingMap.get(alias);
                for (const [waitingAlias, waitingEvent] of waitingEvents.entries()) {
                    EventScheduler.#scheduleWaitingEvent(waitingAlias, waitingEvent);
                }
                EventScheduler.#waitingMap.delete(alias);
            }
        }
    }

    /** Schedules an event that was previously waiting on another to complete. */
    static #scheduleWaitingEvent(alias, event) {
        // Reset timers for the child event, as its 'active' life begins now
        event._timeSinceScheduled = 0;
        event._timeSinceLastInterval = 0;

        // Move the child event from waiting to the active maps
        if (event.delay <= 0) {
            EventScheduler.#zeroDelayEvents.set(alias, event);
            console.log(`[EventScheduler] Zero-delay chained event '${alias}' activated by completion of '${alias}'.`);
        } else {
            EventScheduler.#eventMap.set(alias, event);
            console.log(`[EventScheduler] Chained event '${alias}' activated by completion of '${alias}'.`);
        }

        // Add to category/type maps
        if (event.category) {
            if (!EventScheduler.#categoryMap.has(event.category)) {
                EventScheduler.#categoryMap.set(event.category, new Set());
            }
            EventScheduler.#categoryMap.get(event.category).add(alias);
        }
        if (event.type) {
            if (!EventScheduler.#typeMap.has(event.type)) {
                EventScheduler.#typeMap.set(event.type, new Set());
            }
            EventScheduler.#typeMap.get(event.type).add(alias);
        }
    }

    /** invokes the inverval callbacks of an event. Interally called by update() */
    static #invokeOnInterval(alias, event) {
        try {
            event.onInterval(alias, event._intervalsInvoked, event.data);
            event._intervalsInvoked++;
        } catch (error) {
            console.error(`[EventScheduler] Error invoking onInterval callback for event '${alias}':`, error);
        }
    }
}