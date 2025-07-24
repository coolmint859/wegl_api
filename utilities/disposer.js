/**
 * Schedules resources for disposal after a specified delay, with optional disposal callbacks.
 */
class ResourceDisposer {
    static #resourceMap = new Map();
    static #categoryMap = new Map();
    static #shouldUpdate = true; // for global pauses

    /**
     * Get the size of the set of currently scheduled resources
     * @returns {number} the size of the set of resources currently scheduled
     */
    static get size() {
        return ResourceDisposer.#resourceMap.size;
    }

    /**
     * Schedules a resource to be disposed after some delay.
     * @param {string} alias a name representing the resource data
     * @param {any} resourceData the resource data to dispose
     * @param {number} delay the time in seconds for when disposal should occur after it was first scheduled
     * @param {Function | null} options.disposalCallback an optional callback function for when disposal occurs. Should accept the alias and resourceData as parameters
     * @param {string | null} options.category an optional category for the resource, allowing for aggregate operations on disposals.
     * @returns {boolean} true if the resource was successfully scheduled for disposal, false otherwise.
     */
    static schedule(alias, resourceData, delay, options={}) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'alias' to be a non-empty string. Cannot schedule resource for disposal.`);
            return false;
        }
        if (typeof delay !== 'number' || delay < 0) {
            console.error(`[ResourceDisposer] TypeError: Expected 'delay' to be a number greater than or equal to 0. Cannot schedule resource '${alias}' for disposal.`);
            return false;
        }
        if (options.disposalCallback !== null && typeof options.disposalCallback !== 'function') {
            console.error(`[ResourceDisposer] TypeError: Expected 'options.disposalCallback' to be a function. Cannot schedule resource '${alias}' for disposal.`);
            return false;
        }

        if (ResourceDisposer.#resourceMap.has(alias)) {
            console.warn(`[ResourceDisposer] Resource '${alias}' was already scheduled for disposal. Overwriting existing schedule.`);
        }
        const resourceInfo = {
            resourceData, delay, 
            disposalCallback: options.disposalCallback,
            timeSinceScheduled: 0, 
            shouldUpdate: true,
        }
        ResourceDisposer.#resourceMap.set(alias, resourceInfo);

        const category = options.category;
        if (category && typeof category === 'string' && category.trim() !== '') {
            if (!ResourceDisposer.#categoryMap.has(category)) {
                ResourceDisposer.#categoryMap.set(category, new Set());
            }
            ResourceDisposer.#categoryMap.get(category).add(alias);
            ResourceDisposer.#resourceMap.get(alias).category = category;
        } else if (category) {
            console.warn(`[ResourceDisposer] TypeError: Expected 'category' to be a non-empty string. Cannot associate resource with category.`);
        }
        return true;
    }

    /**
     * Check if a resource is currently scheduled for disposal
     * @param {string} alias a name representing the resource data
     * @returns true if the resource is currently scheduled, false otherwise
     */
    static isScheduled(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'alias' to be a non-empty string. Cannot check if resource is scheduled for disposal.`);
            return false;
        }
        return ResourceDisposer.#resourceMap.has(alias);
    }

    /**
     * Get a read-only snapshot of a scheduled resource.
     * @param {string} alias a name representing the resource data
     * @returns {object} a js object containing metadata about the resource, excluding the callback and raw data.
     */
    static peekAt(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'alias' to be a non-empty string. Cannot check if resource is scheduled for disposal.`);
            return {};
        }
        const resourceInfo = ResourceDisposer.#resourceMap.get(alias)
        if (!resourceInfo) {
            console.warn(`[ResourceDisposer] Resource '${alias}' was not previously scheduled. Cannot peek at resource metadata.`);
            return false;
        }
        const readOnlyData = {
            delay: resourceInfo.delay,
            timeSinceScheduled: resourceInfo.timeSinceScheduled,
        }
        if (resourceInfo.category) {
            readOnlyData.category = resourceInfo.category;
        }
        return Object.freeze(readOnlyData);
    }

    /**
     * Get read-only snapshots of scheduled resources assiocated with a category.
     * @param {string} category the category that scheduled resources fall under
     * @returns {Map<string, object>} a map of aliases to read-only objects containing resource metadata
     */
    static peekAtCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'alias' to be a non-empty string. Cannot peek at resource metadata.`);
            return new Map();
        }
        if (!ResourceDisposer.#categoryMap.has(category)) {
            console.warn(`[ResourceDisposer] '${category}' was not found to have an associated resources. Cannot peek at resource metadata.`);
            return new Map();
        }
        const resourceSnapshotMap = new Map();
        const categorizedAliasesArray = Array.from(ResourceDisposer.#categoryMap.get(category));
        for (const alias of categorizedAliasesArray) {
            resourceSnapshotMap.set(alias, ResourceDisposer.peekAt(alias));
        }
        return resourceSnapshotMap;
    }

    /**
     * Get read-only snapshots of all scheduled resources.
     * @returns {Map<string, object>} a map of aliases to read-only objects containing resource metadata
     */
    static peekAll() {
        const resourceSnapshotMap = new Map();
        for (const alias of ResourceDisposer.#resourceMap.keys()) {
            resourceSnapshotMap.set(alias, ResourceDisposer.peekAt(alias));
        }
        return resourceSnapshotMap;
    }

    /**
     * Cancel a scheduled resource from being disposed. 
     * @param {string} alias the name representing the resource data
     * @returns {boolean} true if the resource was found and disposal was cancelled, false otherwise.
     */
    static cancel(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'alias' to be a non-empty string. Cannot cancel disposal of resource.`);
            return false;
        }
        if (!ResourceDisposer.#resourceMap.has(alias)) {
            console.warn(`[ResourceDisposer] Resource '${alias}' was not previously scheduled. Cannot cancel disposal of resource.`);
            return false;
        }
        return ResourceDisposer.#resourceMap.delete(alias);
    }

    /**
     * Cancel all scheduled disposals.
     * @returns {boolean} true if all scheduled disposals were cancelled, false otherwise.
     */
    static cancelAll() {
        if (ResourceDisposer.size === 0) {
            console.log(`[ResourceDisposer] No resources currently scheduled for disposal, no schedules to cancel.`)
        } else {
            console.log(`[ResourceDisposer] Cancelling ${ResourceDisposer.size} currently scheduled resources.`);
            ResourceDisposer.#resourceMap.clear();
        }
        return true;
    }

    /**
     * Cancel scheduled disposals by category.
     * @returns {boolean} true if the scheduled disposals were cancelled, false otherwise.
     */
    static cancelCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'category' to be a non-empty string. Cannot cancel resource disposals.`);
            return false;
        }
        if (!ResourceDisposer.#categoryMap.has(category)) {
            console.warn(`[ResourceDisposer] '${category}' was not found to have an associated resources. Cannot cancel disposal of category.`);
            return false;
        }
        let allDisposalsCancelled = true;
        const categorizedAliasesArray = Array.from(ResourceDisposer.#categoryMap.get(category));
        for (const alias of categorizedAliasesArray) {
            if (!ResourceDisposer.cancel(alias)) allDisposalsCancelled = false;
        }
        return allDisposalsCancelled;
    }

    /**
     * Disposes a scheduled resource immediately, bypassing it's delay. Invokes it's respective disposal callback.
     * @param {string} alias the name representing the resource data
     * @returns {boolean} true if the resource was successfully disposed, false otherwise.
     */
    static dispose(alias) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'alias' to be a non-empty string. Cannot dispose resource.`);
            return false;
        }
        if (!ResourceDisposer.#resourceMap.has(alias)) {
            console.error(`[ResourceDisposer] Resource '${alias}' was not scheduled for disposal. Cannot dispose resource.`);
            return false;
        }
        ResourceDisposer.#deleteResource(alias, ResourceDisposer.#resourceMap.get(alias));
        return true;
    }

    /**
     * Disposed all scheduled resources in the given category immediately. Invokes their respective disposal callbacks.
     * @param {string} category the category the resources are associated with
     * @returns {boolean} true if all resources within the category were successfully disposed, false otherwise.
     */
    static flushCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'category' to be a non-empty string. Cannot dispose resources.`);
            return false;
        }
        if (!ResourceDisposer.#categoryMap.has(category)) {
            console.warn(`[ResourceDisposer] '${category}' was not found to have an associated resources. Cannot flush category.`);
            return false;
        }
        let allResourcesDisposed = true;
        const categorizedAliasesArray = Array.from(ResourceDisposer.#categoryMap.get(category));
        for (const alias of categorizedAliasesArray) {
            if (!ResourceDisposer.dispose(alias)) allResourcesDisposed = false;
        }
        return allResourcesDisposed;
    }

    /**
     * Dispose all currently scheduled resources immediately. Invokes their respective disposal callbacks.
     * @returns {boolean} true if all resources were successfully disposed, false otherwise.
     */
    static flush() {
        if (ResourceDisposer.size === 0) {
            console.log(`[ResourceDisposer] No resources currently scheduled for disposal.`)
            return true;
        }

        let flushedAll = true;
        const aliases = Array.from(ResourceDisposer.#resourceMap.keys());
        for (const alias of aliases) {
            if (!ResourceDisposer.dispose(alias)) {
                flushedAll = false;
            }
        }
        return flushedAll;
    }

    /**
     * Dispose resources that were not previously scheduled. Useful for resources that are short lived and can't easily be handled by the Javascript GC.
     * @param {string} alias a name representing the resource data. Used for error logging.
     * @param {any} resourceData the resource data to dispose
     * @param {Function} disposalCallback called to handle disposal of the raw data that resourceData holds. Must accept both alias and resourceData as parameters
     * @returns {boolean} true if resource was successfully disposed, false otherwise
     */
    static disposeResource(alias, resourceData, disposalCallback) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'alias' to be a non-empty string. Cannot dispose resource.`);
            return false;
        }
        if (ResourceDisposer.isScheduled(alias)) {
            console.error(`[ResourceDisposer] '${alias}' is already scheduled to be disposed. For immediate disposal of scheduled resources, call dispose().`);
            return false;
        }
        if (disposalCallback !== null && typeof disposalCallback !== 'function') {
            console.error(`[ResourceDisposer] TypeError: Expected 'disposalCallback' to be a function. Cannot dispose resource '${alias}'.`);
            return;
        }
        try {
            disposalCallback(alias, resourceData);
            console.log(`[ResourceDisposer] Unscheduled resource '${alias}' successfully disposed.`);
        } catch (error) {
            console.error(`[ResourceDisposer] Error calling disposal callback for resource '${alias}':`, error);
        }
        return true;
    }

    /**
     * Update the internal state of the ResourceDisposer. If any resource's delay time expires, this invokes their respective disposal callbacks.
     */
    static update(dt) {
        if (typeof dt !== 'number' || dt < 0) {
            console.error(`[ResourceDisposer] TypeError: Expected 'dt' to be a non-negative number. Cannot update.`);
            return;
        }
        if (ResourceDisposer.size === 0) return; // nothing to update
        if (!ResourceDisposer.#shouldUpdate) return; // disposal update paused

        const aliases = Array.from(ResourceDisposer.#resourceMap.keys());
        for (const alias of aliases) {
            const resourceInfo = ResourceDisposer.#resourceMap.get(alias);
            if (resourceInfo.timeSinceScheduled > resourceInfo.delay) {
                ResourceDisposer.#deleteResource(alias, resourceInfo);
            } else if (resourceInfo.shouldUpdate) {
                resourceInfo.timeSinceScheduled += dt;
            }
        }
    }

    /**
     * Pause disposal on one or all scheduled assets.
     * @param {string | null} alias a name to a specific resource if it's disposal should be paused.
     */
    static pause(alias = null) {
        if (alias && typeof alias === 'string' && alias.trim() !== '') {
            if (ResourceDisposer.#resourceMap.has(alias)) {
                console.log(`[ResourceDisposer] Pausing disposal of resource '${alias}'.`)
                ResourceDisposer.#resourceMap.get(alias).shouldUpdate = false;
            } else {
                console.warn(`[ResourceDisposer] Cannot pause unscheduled resource '${alias}'.`);
            }
        } else if (alias) {
            console.error(`[ResourceDisposer] Expected 'alias' to be a non-empty string. Cannot pause resource disposal.`)
        } else {
            // in this case, no alias was defined.
            ResourceDisposer.#shouldUpdate = false;
        }
    }

    /**
     * Pause all disposals in the given category. All other resources will continue as normal.
     * @param {string} category the category to match paused resources with.
     */
    static pauseCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'category' to be a non-empty string. Cannot pause resource disposals.`);
            return;
        }
        if (ResourceDisposer.#categoryMap.has(category)) {
            const categorizedAliasesArray = Array.from(ResourceDisposer.#categoryMap.get(category));
            for (const alias of categorizedAliasesArray) {
                ResourceDisposer.pause(alias);
            }
        }
    }

    /**
     * Resume disposal on one or all scheduled assets.
     * @param {string | null} alias a name to a specific resource if it's disposal should be resumed.
     */
    static resume(alias = null) {
        if (alias && typeof alias === 'string' && alias.trim() !== '') {
            if (ResourceDisposer.#resourceMap.has(alias)) {
                console.log(`[ResourceDisposer] Resuming disposal of resource '${alias}'.`);
                ResourceDisposer.#resourceMap.get(alias).shouldUpdate = true;
            } else {
                console.warn(`[ResourceDisposer] Cannot resume unscheduled resource '${alias}'.`)
            }
        } else if (alias) {
            console.error(`[ResourceDisposer] Expected 'alias' to be a non-empty string. Cannot resume resource disposal.`)
        } else {
            // in this case, no alias was defined.
            ResourceDisposer.#shouldUpdate = true;
        }
    }

    /**
     * Pause all disposals in the given category. All other resources will continue as normal.
     * @param {string} category the category to match paused resources with.
     */
    static resumeCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceDisposer] TypeError: Expected 'category' to be a non-empty string. Cannot pause resource disposals.`);
            return;
        }
        if (ResourceDisposer.#categoryMap.has(category)) {
            const categorizedAliasesArray = Array.from(ResourceDisposer.#categoryMap.get(category));
            for (const alias of categorizedAliasesArray) {
                ResourceDisposer.resume(alias);
            }
        }
    }

    /** Disposes a resource. Interally called by update() and dispose() */
    static #deleteResource(alias, resourceInfo) {
        try {
            if (resourceInfo.disposalCallback) {
                resourceInfo.disposalCallback(alias, resourceInfo.resourceData);
                console.log(`[ResourceDisposer] '${alias}' successfully disposed after invoking disposal callback.`);
            } else {
                console.log(`[ResourceDisposer] '${alias}' successfully disposed. No disposal callback specified.`)
            }
        } catch (error) {
            console.error(`[ResourceDisposer] Error calling disposal callback for resource '${alias}':`, error);
        } finally {
            const resourceCategory = ResourceDisposer.#resourceMap.get(alias).category;
            if (resourceCategory) { // if the category exists, then it must have the alias
                ResourceDisposer.#categoryMap.get(resourceCategory).delete(alias);
            }
            ResourceDisposer.#resourceMap.delete(alias);
        }
    }
}