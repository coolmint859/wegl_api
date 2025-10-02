class Event {
    /**
     * Create a new Event instance
     * @param {string} alias a unique name representing this specific event
     * @param {number} delay the time in seconds for when the event should occur after it was first scheduled. Values <= 0 will trigger the event immediately
     * @param {Function} callback the function that is called after the delay time expires. Should accept the alias of the event and, if set, the data parameter
     * @param {object} options event schedule options
     * @param {Function | null} options.onInterval a function that is called repeatedly at an interval until the main callback is invoked. Should accept the alias and the current invocation count as a parameter, and if set, the optional data parameter.
     * @param {Function | null} options.onCanceled a function that is called if the event gets canceled. Should accept the alias of the event and a list of events that were waiting on this event's completion.
     * @param {number | null} options.interval the interval at which to call onInterval. Default is 1 second. If onInterval is not given, this value is ignored.
     * @param {number | null} options.maxIntervals the maximum number of times onInterval will be invoked. If not specified, the onInterval will be invoked regularly until the main callback is invoked.
     * @param {boolean | null} options.invokeLastInterval if true and the interval is an even divider of delay, then onInterval will be invoked at the same time as callback. If false, then onInterval on only invoked strictly before the delay time is up. Default is true.
     * @param {any | null} options.eventData optional data that should get passed in to the callbacks (except onTimeout).
     * @param {string | null} options.category place the event into a category. (i.e what the event affects);
     * @param {string | null} options.eventType place the event into a type (ie what the event does)
     * @param {number | null} options.timeScale a modifier on the timer accumulation. values < 1 will slow the event timer (making it take longer to trigger) and values > 1 will speed up the event timer . Default is 1 (no effect)
     * @returns {boolean} true if the event was successfully scheduled, false otherwise.
     */
    constructor(alias, delay, callback, options={}) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            throw new Error(`TypeError: Expected 'alias' to be a non-empty string. Cannot create event.`);
        }
        if (typeof delay !== 'number' || delay < 0) {
            throw new Error(`TypeError: Expected 'delay' to be a number greater than or equal to 0. Cannot create event '${alias}'.`);
        }
        if (typeof callback !== 'function') {
            throw new Error(`TypeError: Expected 'callback' to be a function. Cannot create event '${alias}'.`);
        }

        // basic attributes
        this.alias = alias
        this.delay = delay;
        this.mainCallback = callback;
        this.data = options.eventData ?? null;
        this.category = options.category ?? null;
        this.type = options.type ?? null;
        this.onCanceled = options.onCanceled ?? null;

        // time scaling
        const validTimescale = typeof options.timeScale === 'number' && options.timeScale >= 0;
        this.timeScale = validTimescale ? options.timeScale : 1;

        // intervals
        this.maxIntervals = options.maxIntervals ?? null;
        this.interval = options.interval ?? 1;
        this.invokeLastInterval = options.invokeLastInterval !== undefined ? options.invokeLastInterval : true;
        this.onInterval = options.onInterval ?? null;
        const validInterval = typeof this.interval === 'number' && this.interval > 0;
        this._doIntervals = validInterval && typeof this.onInterval == 'function';
        this._hasMaxIntervals = typeof this.maxIntervals === 'number' && this.maxIntervals >= 0;

        // internal tracking variables 
        this._intervalsInvoked = 0;
        this._timeSinceLastInterval = 0;
        this._timeSinceScheduled = 0;
        this._isPaused = false;
    }

    pause() {
        this._isPaused = true;
    }

    resume() {
        this._isPaused = false;
    }

    /**
     * Update this event's internal state based on it's currently set parameters
     * @param {number} dt the amount time since the last frame
     */
    update(dt) {
        if (this._isPaused) return;

        // normal callback
        this._timeSinceScheduled += dt * this.timeScale;
        if (this._timeSinceScheduled > this.delay) {
            EventScheduler._invokeCallback(this.alias, this);
            EventScheduler._removeEvent(this.alias, this);
            if (!this.invokeLastInterval) return;
        }

        // intervals
        this._timeSinceLastInterval += dt * this.timeScale;
        const maxIntervalsReached = this._hasMaxIntervals && this._intervalsInvoked > this.maxIntervals;
        if (this._doIntervals && !maxIntervalsReached) {
            while (this._timeSinceLastInterval >= this.interval) {
                this._intervalsInvoked++;
                EventScheduler._invokeOnInterval(this.alias, this._intervalsInvoked, this);
                this._timeSinceLastInterval -= this.interval;

                if (this._intervalsInvoked > this.maxIntervals) {
                    break;
                }
            }
        }
    }
}


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
     * Schedule a new event to happen after some delay.
     * @param {string} alias a unique name representing this specific event
     * @param {number} delay the time in seconds for when the event should occur after it was first scheduled. Values <= 0 will trigger the event immediately
     * @param {Function} callback the function that is called after the delay time expires.
     * @param {object} options event schedule options
     * @param {Function | null} options.onInterval a function that is called repeatedly at an interval untl the main callback is invoked. Should accept the alias and the current invocation count as a parameter, and if set, the optional data parameter
     * @param {number | null} options.interval the interval at which to call onInterval. Default is 1 second. If onInterval is not given, this value is ignored.
     * @param {number | null} options.maxIntervalInvocations the maximum number of times onInterval will be invoked. If not specified, the onInterval will be invoked regularly until the main callback is invoked.
     * @param {Function | null} options.onCanceled a function that is called if the event gets canceled. Should accept the alias of the event and a list of events that were waiting on this event's completion.
     * @param {string | null} options.eventData optional data that should get passed in to the callbacks (including onInterval).
     * @param {string | null} options.category place the event into a category. (i.e what the event affects);
     * @param {string | null} options.eventType place the event into a type (ie what the event does)
     * @param {number | null} options.timeScale a modifier on the timer accumulation. values < 1 will slow the event timer (making it take longer to trigger) and values > 1 will speed up the event timer . Default is 1 (no effect)
     * @returns {boolean} true if the event was successfully scheduled, false otherwise.
     */
    static schedule(alias, delay, callback, options={}) {      
        let event;
        try { 
            event = new Event(alias, delay, callback, options); 
        } catch (error) { 
            console.error(`[[EventScheduler] An error occured creating new event: ${error}`); 
            return false;
        }

        if (EventScheduler.#eventMap.has(alias)) {
            console.warn(`[EventScheduler] Event '${alias}' was already scheduled. Overwriting existing schedule.`);
        }

        if (delay > 0) {
            EventScheduler.#eventMap.set(alias, event);
        } else {
            EventScheduler.#zeroDelayEvents.set(alias, event);
        }

        const category = event.category;
        if (typeof category === 'string' && category.trim() !== '') {
            EventScheduler.#addToCategory(alias, category);
            EventScheduler.#eventMap.get(alias).category = category;
        } else if (category !== null) {
            console.warn(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot place event in category.`);
        }

        const type = options.eventType;
        if (typeof type === 'string' && type.trim() !== '') {
            EventScheduler.#addAsType(alias, type);
            EventScheduler.#eventMap.get(alias).type = type;
        } else if (type) {
            console.warn(`[EventScheduler] TypeError: Expected 'eventType' to be a non-empty string. Cannot associate event with type.`);
        }
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
     * Schedule a event to happen after an another event and after some delay.
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
    static scheduleAfter(otherEventAlias, alias, delay, callback, options={}) {
        if (typeof otherEventAlias !== 'string' || otherEventAlias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot schedule event.`);
            return false;
        }
        if (!EventScheduler.#eventMap.has(otherEventAlias)) {
            console.error(`[EventScheduler] Cannot schedule event to occur after an event that doesn't exist.`);
            return false;
        }

        let event;
        try { 
            event = new Event(alias, delay, callback, options); 
        } catch (error) { 
            console.error(`[[EventScheduler] An error occured creating new event: ${error}`); 
            return false;
        }

        if (EventScheduler.#waitingMap.has(otherEventAlias)) {
            if (EventScheduler.#waitingMap.get(otherEventAlias).has(alias)) {
                console.log(`[EventScheduler] Event '${alias}' was already scheduled to happen after event '${otherEventAlias}' completes.`);
                return true;
            }
            EventScheduler.#waitingMap.get(otherEventAlias).set(alias, event);
        } else {
            EventScheduler.#waitingMap.set(otherEventAlias, new Map());
            EventScheduler.#waitingMap.get(otherEventAlias).set(alias, event);
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
     * Check if any events in the specfied category are currently scheduled
     * @param {string} category the event category
     * @returns true if the events are currently scheduled, false otherwise
     */
    static isCategoryScheduled(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot check if event category is scheduled.`);
            return false;
        }
        return EventScheduler.#categoryMap.has(category);
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
     * @returns {readonly object} a js object containing metadata about the event, excluding the callbacks
     */
    static peekAt(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot peek at event.`);
            return {};
        }
        const event = EventScheduler.#eventMap.get(alias)
        if (event === undefined) {
            console.warn(`[EventScheduler] Event '${alias}' was not previously scheduled. Cannot peek at event.`);
            return {};
        }
        const readOnlyData = {
            alias: alias,
            category: event.category,
            type: event.type,
            delay: event.delay,
            interval: event.interval,
            maxIntervals: event.maxIntervals,
            timeScale: event.timeScale,
            timeSinceLastInterval: event._timeSinceLastInterval,
            timeSinceScheduled: event._timeSinceScheduled,
        }
        return Object.freeze(readOnlyData);
    }

    /**
     * Get read-only snapshots of scheduled events in a category.
     * @param {string} category the category that scheduled events fall under
     * @returns {Map<string, readonly object>} a map of aliases to read-only objects containing event metadata
     */
    static peekAtCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'category' to be a non-empty string. Cannot peek at events.`);
            return new Map();
        }
        if (!EventScheduler.#categoryMap.has(category)) {
            console.warn(`[EventScheduler] '${category}' was not found to have an associated events.`);
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
     * @returns {Map<string, readonly object>} a map of aliases to read-only objects containing event metadata
     */
    static peekAtType(type) {
        if (typeof type !== 'string' || type.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'type' to be a non-empty string. Cannot peek at events.`);
            return new Map();
        }
        if (!EventScheduler.#typeMap.has(type)) {
            console.warn(`[EventScheduler] No events of type '${type}' were found.`);
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
     * @returns {Map<string, readonly(object)>} a map of aliases to read-only objects containing event metadata
     */
    static peekAll() {
        const eventSnapshotMap = new Map();
        for (const alias of EventScheduler.#eventMap.keys()) {
            eventSnapshotMap.set(alias, EventScheduler.peekAt(alias));
        }
        return eventSnapshotMap;
    }

    /**
     * Cancel either a scheduled or waiting event. If scheduled, All events waiting on this event to complete will be canceled as well. if onCanceled is specified, this function is called first.
     * @param {string} alias the name representing the event
     * @param {boolean} callWaitingOnCancelled if true, will invoke the onCanceled function of the waiting event(s). Default is false. onCanceled will always be called for a scheduled event
     * @returns {boolean} true if the event was found and cancelled, false otherwise.
     */
    static cancel(alias, callWaitingOnCancelled = false) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[EventScheduler] TypeError: Expected 'alias' to be a non-empty string. Cannot cancel event.`);
            return false;
        }
        if (EventScheduler.#eventMap.has(alias)) {
            return EventScheduler.#cancelActive(alias);
        } else {
            return EventScheduler.#cancelWaiting(alias, callWaitingOnCancelled);
        }
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
            console.log(`[EventScheduler] No events currently scheduled.`);
        } else {
            console.log(`[EventScheduler] Cancelling ${EventScheduler.size} currently scheduled event(s).`);
            EventScheduler.#eventMap.clear();
            EventScheduler.#categoryMap.clear();
            EventScheduler.#typeMap.clear();
            EventScheduler.#waitingMap.clear();
        }
        return true;
    }

    static #cancelActive(alias) {
        if (EventScheduler.#waitingMap.has(alias)) {
            const waitingEventsMap = EventScheduler.#waitingMap.get(alias);
            for (const waitingAlias of Array.from(waitingEventsMap.keys())) {
                const waitingEvent = waitingEventsMap.get(waitingAlias);
                if (typeof waitingEvent.onCanceled === 'function') {
                    EventScheduler._invokeOnCanceled(waitingAlias, waitingEvent);
                }

                waitingEventsMap.delete(waitingAlias);
                if (waitingEventsMap.size === 0) {
                    EventScheduler.#waitingMap.delete(alias);
                }
            }
        }
        const activeEvent = EventScheduler.#eventMap.get(alias);
        if (typeof activeEvent.onCanceled === 'function') {
            EventScheduler._invokeOnCanceled(alias, activeEvent);
        }
        return EventScheduler.#eventMap.delete(alias);
    }

    static #cancelWaiting(alias, callCancel) {
        let waitingEvent, parentAlias;
        const activeAliases = Array.from(EventScheduler.#waitingMap.keys());
        for (const activeAlias of activeAliases) {
            const waitingAliases = Array.from(EventScheduler.#waitingMap.get(activeAlias));
            for (const waitingAlias of waitingAliases) {
                if (waitingAlias === alias) {
                    waitingEvent = EventScheduler.#waitingMap.get(activeAlias).get(waitingAlias);
                    parentAlias = activeAlias;
                }
            }
        }
        if (!waitingEvent) {
            console.error(`[EventScheduler] '${alias}' is not a scheduled or waiting event. Cannot cancel.`);
            return false;
        }

        if (callCancel) {
            EventScheduler._invokeOnCanceled(alias, waitingEvent);
        }
        EventScheduler.#waitingMap.get(parentAlias).delete(alias);
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
        EventScheduler._invokeCallback(alias, EventScheduler.#eventMap.get(alias));
        EventScheduler._removeEvent(alias, EventScheduler.#eventMap.get(alias));
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
        
        const aliases = Array.from(EventScheduler.#eventMap.keys());
        for (const alias of aliases) {
            // this is needed in case an event cancels a separate event that hasn't been processed yet.
            if (!EventScheduler.#eventMap.has(alias)) continue;
            
            // event.update() invokes it's own callbacks through the scheduler
            EventScheduler.#eventMap.get(alias).update(dt);
        }
        // call zero delay events only after other events
        const zeroDelayEvents = Array.from(EventScheduler.#zeroDelayEvents.keys());
        for (const eventAlias of zeroDelayEvents) {
            const event = EventScheduler.#zeroDelayEvents.get(eventAlias);
            EventScheduler._invokeCallback(eventAlias, event);
            EventScheduler._removeEvent(eventAlias, event);
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
                EventScheduler.#eventMap.get(alias).pause();
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
                EventScheduler.#eventMap.get(alias).resume();
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

    static #addToCategory(alias, category) {
        if (!EventScheduler.#categoryMap.has(category)) {
            EventScheduler.#categoryMap.set(category, new Set());
        }
        EventScheduler.#categoryMap.get(category).add(alias);
        console.log(`[EventScheduler] Added event '${alias}' to category '${category}'.`);
    }

    static #addAsType(alias, type) {
        if (!EventScheduler.#typeMap.has(type)) {
            EventScheduler.#typeMap.set(type, new Set());
        }
        EventScheduler.#typeMap.get(type).add(alias);
        console.log(`[EventScheduler] Added event '${alias}' as type '${type}'.`);
    }

    static #addToWaiting(activeAlias, waitingAlias, waitingEvent) {
        if (!EventScheduler.#waitingMap.has(activeAlias)) {
            EventScheduler.#waitingMap.set(activeAlias, new Set());
        }
        EventScheduler.#waitingMap.get(activeAlias).set(waitingAlias, waitingEvent);
    }

    /** invokes the final callback of an event. Interally called by update() and triggerEvent() */
    static _invokeCallback(alias, event) {
        try {
            event.mainCallback(alias, event.data);
        } catch (error) {
            console.error(`[EventScheduler] Error invoking callback for event '${alias}':`, error);
        } finally {
            // if any events were waiting on this event, we can schedule them now
            if (EventScheduler.#waitingMap.has(alias)) {
                const waitingEvents = EventScheduler.#waitingMap.get(alias);
                for (const [waitingAlias, waitingEvent] of waitingEvents.entries()) {
                    EventScheduler._scheduleWaitingEvent(waitingAlias, waitingEvent);
                }
                EventScheduler.#waitingMap.delete(alias);
            }
        }
    }

    /** Schedules an event that was previously waiting on another to complete. */
    static _scheduleWaitingEvent(parentAlias, alias, event) {
        // Reset timers for the child event, as its 'active' life begins now
        event._timeSinceScheduled = 0;
        event._timeSinceLastInterval = 0;

        // Move the child event from waiting to the active maps
        if (event.delay <= 0) {
            EventScheduler.#zeroDelayEvents.set(alias, event);
            console.log(`[EventScheduler] Zero-delay chained event '${alias}' activated by completion of '${parentAlias}'.`);
        } else {
            EventScheduler.#eventMap.set(alias, event);
            console.log(`[EventScheduler] Chained event '${alias}' activated by completion of '${parentAlias}'.`);
        }

        // Add to category/type maps
        if (event.category) {
            EventScheduler.#addToCategory(alias, event.category);
        }
        if (event.type) {
            EventScheduler.#addAsType(alias, event.type);
        }
    }

    /** invokes the inverval callbacks of an event. Interally called by update() */
    static _invokeOnInterval(alias, intervalsInvoked, event) {
        try {
            event.onInterval(alias, intervalsInvoked, event.data);
        } catch (error) {
            console.error(`[EventScheduler] Error invoking onInterval callback for event '${alias}':`, error);
        }
    }

     /** 
      * invokes the onCanceled callback of an event. Handles rerouting logic based on onCanceled() return value.
      *  */
    static _invokeOnCanceled(canceledAlias, canceledEvent) {
        try {
            let waitingAliases;
            if (EventScheduler.#waitingMap.has(canceledAlias)) {
                waitingAliases = new Set(EventScheduler.#waitingMap.get(canceledAlias).keys());
            } else { 
                waitingAliases = new Set(); 
            }

            const reroutedEvents = canceledEvent.onCanceled(canceledAlias, waitingAliases, canceledEvent.data);
            if (!reroutedEvents) return;

            // handle rerouted events
            for (const reroute in reroutedEvents) {
                const waitingAlias = reroute.waitingAlias;
                const newActiveAlias = reroute.activeAlias;

                // waiting event now waiting on another active event
                if (waitingAliases.has(waitingAlias) && EventScheduler.#eventMap.has(newActiveAlias)) {
                    const waitingEvent = EventScheduler.#waitingMap.get(canceledAlias).get(waitingAlias);
                    EventScheduler.#addToWaiting(canceledAlias, waitingAlias, waitingEvent);
                // waiting event is now active
                } else if (waitingAliases.has(waitingAlias)) {
                    EventScheduler.#eventMap.set(waitingAlias, EventScheduler.#waitingMap.get(canceledAlias).get(waitingAlias));
                }
            }
            // finally remove all waiting aliases from waiting map
            EventScheduler.#waitingMap.delete(canceledAlias);
        } catch (error) {
            console.error(`[EventScheduler] Error invoking onCanceled callback for event '${canceledAlias}':`, error);
        }
    }

    static _removeEvent(alias, event) {
        const eventCategory = event.category;
        if (eventCategory) { // if the category exists, then the map must have the alias
            EventScheduler.#categoryMap.get(eventCategory).delete(alias);
            if (EventScheduler.#categoryMap.get(eventCategory).size === 0) {
                EventScheduler.#categoryMap.delete(eventCategory);
            }
        }
        const eventType = event.type;
        if (eventType) { // if the type exists, then the map must have the alias
            EventScheduler.#typeMap.get(eventType).delete(alias);
            if (EventScheduler.#typeMap.get(eventType).size === 0) {
                EventScheduler.#typeMap.delete(eventType);
            }
        }
        EventScheduler.#eventMap.delete(alias);
    }
}