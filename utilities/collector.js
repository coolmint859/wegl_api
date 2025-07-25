import EventScheduler from "./scheduler.js";

/**
 * Utility class for loading and caching shared resources and disposing of them when they no longer referenced.
 * Uses reference counting as the lifetime management paradigm. Supports multiple retries, timeouts, and abort controlling when timeout reached.
 * 
 * Possible resource states:
 * @LOADING a resource is currently loading using a given loading function
 * @LOADED a resource has finished loading and it's data is stored in the cache
 * @FAILED a resource failed to load. From here you decide if you want to try reloading it or delete it
 * @PENDING_DISPOSAL a resource is pending disposal, meaning ResourceDisposer is tracking it's disposal time
 * */
export default class ResourceCollector {
    static States = Object.freeze({
        LOADING: 'loading',
        LOADED: 'loaded',
        FAILED: 'failed',
        PENDING_DISPOSAL: 'pending_disposal',
    });
    static #cache = new Map();
    static #categoryMap = new Map();

    /**
     * Asyncronously load a resource (image, audio, text, etc..) into memory.
     * 
     * Note: it as assumed that the resource has at least 1 reference when this function is called. Do not call acquire() if you intend for the resource to have only one consumer.
     * @param {string} resourcePath the path/url to the resource
     * @param {Function} loadFunction the primary loading function for the resource. Must be asyncronous, should accept the resourcePath and a AbortSignal object as parameters, and should return the data to be stored.
     * @param {string | null} options.category an string representing a group of resources, allowing for aggregate operations
     * @param {number | null} options.maxRetries the maximum number of times that the resource will attempt to load if prior attempts fail. Default is 0.
     * @param {number | null} options.loadTimeout the amount of time in seconds before a load function is told to abort. Default is 3 seconds.
     * @param {Function | null} options.onLoadTimeout function called each time a timeout is made on the load function. Should accept the resourcePath and an error object as parameters.
     * @param {AbortSignal | null} options.signal an abort signal used to propogate signals up to nested load calls. Useful for loading interdependent files.
     * @param {Function | null} options.onLoadFailure function called if the resource failed to load after all load attempts are exhausted. Should accept the resourcePath and an error object as parameters.
     * @param {Function | null} options.disposalCallback a function which is called when this resource is deleted from the cache if it loaded successfully beforehand. Should accept the stored data as a parameter.
     * @param {number | null} options.disposalDelay the amount of time in seconds before the resource is disposed when all consumers have released it
     * @returns {Promise} a promise indicating success or failure of loading the resource
     */
    static async load(resourcePath, loadFunction, options={}) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot load in resource.`);
            return Promise.reject(new Error(`[ResourceCollector] '${resourcePath}' is not a non-empty string.`));
        }
        if (ResourceCollector.#cache.has(resourcePath)) {
            console.error(`[ResourceCollector] Cannot load '${resourcePath}' as resource already exists in cache. Use acquire() if you wish to have a new consumer use this resource.`);
            return Promise.reject(new Error(`[ResourceCollector] '${resourcePath}' already exists in cache, cannot load.`));
        }
        if (typeof loadFunction !== 'function') {
            console.error(`[ResourceCollector] TypeError: Expected 'loadFunction' to be a function. Cannot load in resource ${resourcePath}.`);
            return Promise.reject(new Error(`[ResourceCollector] '${loadFunction}' is not a function.`));
        }
        // now we know this is the first time attempting to load the resource

        let resolveFunc, rejectFunc;
        const loadPromise = new Promise((resolve, reject) => {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        const resourceInfo = {
            data: null,
            refCount: 1,
            currentState: ResourceCollector.States.LOADING,
            priorState: null,
            loadFunction: loadFunction,
            disposalCallback: options.disposalCallback,
            disposalDelay: options.disposalDelay ? options.disposalDelay : 1,
            loadPromise: loadPromise,
            _resolve: resolveFunc,
            _reject: rejectFunc
        }
        // cache the metadata before attempting to load
        ResourceCollector.#cache.set(resourcePath, resourceInfo);

        // add resource to category map if requested
        const category = options.category;
        if (category && typeof category === 'string' && category.trim() !== '') {
            if (!ResourceCollector.#categoryMap.has(category)) {
                ResourceCollector.#categoryMap.set(category, new Set());
            }
            ResourceCollector.#categoryMap.get(category).add(resourcePath);
            resourceInfo.category = category;
        } else if (category) {
            console.warn(`[ResourceCollector] TypeError: Expected 'category' to be a non-empty string. Cannot associate resource with category.`);
        }

        // attempt to load in the resource
        try {
            const loadedData = await ResourceCollector.#loadResource(resourcePath, loadFunction, options);
            ResourceCollector.#onLoadSuccess(resourcePath, loadedData, resourceInfo.disposalCallback);
            console.log(`[ResourceCollector] Load successful for resource '${resourcePath}'; data cached and ready for use.`);
            return loadedData;
        } catch (error) {
            // cache data remains null
            // update current/prior state
            if (resourceInfo.currentState === ResourceCollector.States.PENDING_DISPOSAL) {
                resourceInfo.priorState = ResourceCollector.States.FAILED;
            } else {
                resourceInfo.currentState = ResourceCollector.States.FAILED;
            }
            console.error(`[ResourceCollector] Error attempting to load resource '${resourcePath}': ${error}`);
            resourceInfo._reject(error);
            return Promise.reject(error);
        }
    }

    /**
     * Reload the resource from the given path to memory, if it exists. Uses the loadFunction and disposalFunction provided at first load.
     * If the reload attempt fails, this will fall back to the last known state of the resource.
     * 
     * Allowed resource states: LOADED, FAILED
     * @param {string} resourcePath the path/url to the resource
     * @param {number | null} options.maxRetries the maximum number of times that the resource will attempt to load if the prior attempts fail.
     * @param {number | null} options.loadTimeout the amount of time in seconds before a load function is told to abort. Default is 3 seconds.
     * @param {Function | null} options.onLoadTimeout function called each time a timeout is made on the load function.
     * @param {Function | null} options.onLoadFailure function called if the resource failed to load after all load attempts are exhausted. Should accept the resourcePath and an error object as parameters.
     * @param {AbortSignal | null} options.signal an abort signal used to propogate signals up to nested load calls. Useful for loading interdependent files.
     * @returns {Promise} a promise inidicating success or failure on reloading
     */
    static async reload(resourcePath, options={}) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot attempt reload.`);
            return Promise.reject(new Error(`[ResourceCollector] '${resourcePath}' is not a non-empty string.`));
        }
        if (ResourceCollector.isLoading(resourcePath) || ResourceCollector.isPendingDisposal(resourcePath)) {
            console.error(`[ResourceCollector] Resource '${resourcePath}' is either currently loading, pending disposal, or doesn't exist. Cannot attempt reload.`);
            return Promise.reject(new Error(`[ResourceCollector] Resource '${resourcePath}' is in an invalid state for reload attempt.`));
        }
        // resource should exist at this point, but it needs a load function to be able to reload it
        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        if (!resourceInfo.loadFunction) {
            console.error(`[ResourceCollector] Resource '${resourcePath}' does not have an associated loadFunction. Cannot attempt reload.`);
            return Promise.reject(new Error(`[ResourceCollector] Resource '${resourcePath}' missing loadFunction.`));
        }

        // save old states in case reload fails
        const oldCurrentState = resourceInfo.currentState;
        const oldPriorState = resourceInfo.priorState;

        // obtain new load promise
        let newResolveFunc, newRejectFunc;
        const newLoadPromise = new Promise((resolve, reject) => {
            newResolveFunc = resolve;
            newRejectFunc = reject;
        });

        // update state to prepare for reloading
        resourceInfo.currentState = ResourceCollector.States.LOADING;
        resourceInfo.loadPromise = newLoadPromise;
        resourceInfo._resolve = newResolveFunc;
        resourceInfo._reject = newRejectFunc;

        // Note: the old data will say in the cache until a reload is successful
        try {
            const loadedData = await ResourceCollector.#loadResource(resourcePath, resourceInfo.loadFunction, options);
            ResourceCollector.#onLoadSuccess(resourcePath, loadedData, resourceInfo.disposalCallback);
            console.log(`[ResourceCollector] Reload successful for resource '${resourcePath}'; new data is cached and ready for use.`)
            return loadedData;
        } catch (error) {
            // old data stays in cache
            // update current/prior state
            if (resourceInfo.currentState === ResourceCollector.States.PENDING_DISPOSAL) {
                resourceInfo.priorState = oldPriorState;
            } else {
                resourceInfo.currentState = oldCurrentState;
            }
            console.error(`[ResourceCollector] Loading resource '${resourcePath}' failed: ${error}`);
            resourceInfo._reject(error);
            return Promise.reject(error);
        }
    }

    /**
     * Store an already loaded resource into the cache. Useful for programatically created resources that are stored in places that the Javascript GC can't access (like GPU memory)
     * @param {string} alias a unique identifier to use when operating on the resource in the cache.
     * @param {any} resourceData the preloaded resource to store in the cache.
     * @param {Function} options.loadFunction an optional loading function for the resource. Must be asyncronous and should return the data to be stored. Note, if this is not provided, the stored resource cannot be reloaded with ResourceCollector.reload()
     * @param {Function | null} options.disposalCallback called when this resource is deleted from memory (i.e no has no references). Should accept the stored data as a parameter.
     * @param {number | null} options.disposalDelay the amount of time in seconds before the resource is disposed when all consumers have released it.
     * @param {string | null} options.category an string representing a group of resources, allowing for aggregate operations
     * @returns {boolean} true if the preloaded resource was successfully stored, false otherwise
     */
    static store(alias, resourceData, options={}) {
        if (typeof alias !== 'string' || alias.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'alias' to be a non-empty string. Cannot store resource.`);
            return false;
        }
        if (ResourceCollector.#cache.has(alias)) {
            const resourceInfo = ResourceCollector.#cache.get(alias);
            console.info(`[ResourceCollector] Reusing cached resource '${alias}'`)
            resourceInfo.refCount++;
            return true;
        } else {
            const resourceInfo = {
                refCount: 1,
                currentState: ResourceCollector.States.LOADED,
                priorState: null,
                data: resourceData,
                loadFunction: options.loadFunction,
                disposeCallback: options.disposalCallback,
                disposalDelay: options.disposalDelay ? options.disposalDelay : 1,
            }

            // add resource to category map if requested
            const category = options.category;
            if (category && typeof category === 'string' && category.trim() !== '') {
                if (!ResourceCollector.#categoryMap.has(category)) {
                    ResourceCollector.#categoryMap.set(category, new Set());
                }
                ResourceCollector.#categoryMap.get(category).add(alias);
                resourceInfo.category = category;
            } else if (category) {
                console.warn(`[ResourceCollector] TypeError: Expected 'category' to be a non-empty string. Cannot associate resource with category.`);
            }
            // cache the resource once before attempting to load with retries
            ResourceCollector.#cache.set(alias, resourceInfo);
            console.log(`[ResourceCollector] Successfully stored preloaded resource '${alias}'.`)
            return true;
        }
    }

    /**
     * Checks if an resource is currently being loaded into memory
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource is loading, false otherwise
     */
    static isLoading(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot check resource status.`);
            return false;
        }
        if (ResourceCollector.#cache.has(resourcePath)) {
            const resourceInfo = ResourceCollector.#cache.get(resourcePath);
            return resourceInfo.currentState === ResourceCollector.States.LOADING;
        }
        return false;
    }

    /**
     * Checks if an resource has successfully loaded into memory
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource was successfully loaded, false otherwise
     */
    static isLoaded(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot check resource status.`);
            return false;
        }
        if (ResourceCollector.#cache.has(resourcePath)) {
            const resourceInfo = ResourceCollector.#cache.get(resourcePath);
            return resourceInfo.currentState === ResourceCollector.States.LOADED;
        }
        return false;
    }

    /**
     * Checks if an resource had failed loading into memory
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource was failed loading, false otherwise
     */
    static isFailed(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot check resource status.`);
            return false;
        }
        if (ResourceCollector.#cache.has(resourcePath)) {
            const resourceInfo = ResourceCollector.#cache.get(resourcePath);
            return resourceInfo.currentState === ResourceCollector.States.FAILED;
        }
        return false;
    }

    /**
     * Checks if a resource is currently pending disposal
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource is pending disposal, false otherwise
     */
    static isPendingDisposal(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot check resource status.`);
            return false;
        }
        if (ResourceCollector.#cache.has(resourcePath)) {
            const resourceInfo = ResourceCollector.#cache.get(resourcePath);
            return resourceInfo.currentState === ResourceCollector.States.PENDING_DISPOSAL;
        }
        return false;
    }

    /**
     * Retrieve the resource data, if it exists and has successfully loaded.
     * 
     * Allowed resource states: LOADED
     * @param {string} resourcePath the path/url to the resource
     * @returns {object | null} the resource data. If the resource has not finished loading, failed loading, or doesn't exist, null is returned.
     */
    static get(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot get resource data.`);
            return null;
        }
        if (ResourceCollector.isLoaded(resourcePath)) {
            return ResourceCollector.#cache.get(resourcePath).data;
        }
        return null;
    }

    /**
     * Retrieve resource data of a specific category, if they exist and have successfully loaded.
     *
     * Allowed resource states: LOADED
     * @param {string} category the category the resources are associated with
     * @returns {Map<string, any>} the resource data as a map
     */
    static getCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'category' to be a non-empty string. Cannot get resource data.`);
            return new Map();
        }
        const resourcesInCategory = new Map();
        for (const path of ResourceCollector.#categoryMap.get(category)) {
            if (ResourceCollector.isLoaded(path)) {
                resourcesInCategory.set(path, ResourceCollector.#cache.get(path).data);
            }
        }
        return resourcesInCategory;
    }

    /**
     * Check if a resource is in the cache, regardless of state.
     * 
     * Allowed resource states: LOADED, LOADING, FAILED, PENDING_DISPOSAL
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource was found, false otherwise
     */
    static contains(resourcePath) {
        return ResourceCollector.#cache.has(resourcePath);
    }

    /**
     * Check if at least one resource with the category is in the cache.
     * 
     * Allowed resource states: LOADED, LOADING, FAILED, PENDING_DISPOSAL
     * @param {string} category the path/url to the resource
     * @returns {boolean} true if the category is known (at least one resource has it), false otherwise
     */
    static containsCategory(category) {
        return ResourceCollector.#categoryMap.has(category);
    }

    /**
     * Signal that an additional reference to this resource should be made.
     * 
     * Allowed resource states: LOADED, LOADING
     * @param {string} resourcePath the path/url to the resource
     * @returns true if the resource exists and was acquired, false otherwise
     */
    static acquire(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot acquire resource.`);
            return false;
        }
        // isloaded/isloading implicitly also check for existance. Both will return false if the resource doesn't exist
        if (ResourceCollector.isFailed(resourcePath)) {
            console.error(`[ResourceCollector] Cannot acquire resource '${resourcePath}' because it previously failed to load. Try reloading it before calling acquire()`);
            return false;
        }
        if (ResourceCollector.isLoading(resourcePath)) {
            console.warn(`[ResourceCollector] Acquiring resource '${resourcePath}' while still loading, the load may fail. Use with caution.`);
        }
        // if the resource was previously scheduled for disposal and it's prior state wasn't failed, cancel the disposal.
        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        if (ResourceCollector.isPendingDisposal(resourcePath)) {
            if (resourceInfo.priorState === ResourceCollector.States.FAILED) {
                console.error(`[ResourceCollector] Cannot acquire resource '${resourcePath}' that is pending disposal and whose prior state was failed.`);
                return false;
            }
            resourceInfo.currentState = resourceInfo.priorState; // reset state to state prior to scheduled disposal
            resourceInfo.priorState = null; // reset prior state;
            EventScheduler.cancel(resourcePath);
        }
        resourceInfo.refCount++;
        console.log(`[ResourceCollector] Acquired resource '${resourcePath}'. Current Reference count: ${resourceInfo.refCount}.`)
        return true;
    }

    /**
     * Acquire the resources associated with a category.
     * 
     * Allowed resource states: LOADED, LOADING
     * @param {string} category the category of the resources
     * @returns {boolean} true if all resources in the category were acquired, false otherwise
     */
    static acquireCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'category' to be a non-empty string. Cannot release resources.`);
            return false;
        }
        if (!ResourceCollector.#categoryMap.has(category)) {
            console.error(`[ResourceCollector] '${category}' is not a known resource category. Cannot acquire resources.`);
            return false;
        }
        let acquiredAll = true;
        for (const path of ResourceCollector.#categoryMap.get(category)) {
            if (!ResourceCollector.acquire(path)) acquiredAll = false;
        }
        return acquiredAll;
    }

    /**
     * Signal that a reference to this resource is no longer needed. If there are no more consumers for this resource, it's scheduled for disposal.
     * 
     * Allowed resource states: LOADED, LOADING, FAILED
     * @param {string} resourcePath the path/url to the asset
     * @returns {boolean} true if the asset was successfully released, false otherwise
     */
    static release(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot release resource.`);
            return false;
        }
        if (!ResourceCollector.contains(resourcePath)) {
            console.warn(`[ResourceCollector] Resource '${resourcePath}' was not found in the cache. Cannot release resource.`);
            return false;
        }
        if (ResourceCollector.isPendingDisposal(resourcePath)){
            console.error(`[ResourceCollector] Cannot release resource '${resourcePath}' as it is already scheduled for disposal.`);
            return false;
        }
        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        resourceInfo.refCount--;
        console.log(`[ResourceCollector] Successfully released resource '${resourcePath}'. Current Reference count: ${resourceInfo.refCount}'`)
        if (resourceInfo.refCount <= 0 ) {
            console.log(`[ResourceCollector] No more consumers are using resource '${resourcePath}'. Scheduling for disposal.`);
            ResourceCollector.#scheduleForDisposal(resourcePath, resourceInfo);
        }
        return true;
    }

    /**
     * Release the resources associated with a category.
     * 
     * Allowed resource states: LOADED, LOADING, FAILED
     * @param {string} category the category of the resources
     * @returns {boolean} true if all resources in the category were acquired, false otherwise
     */
    static releaseCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'category' to be a non-empty string. Cannot release resources.`);
            return false;
        }
        if (!ResourceCollector.#categoryMap.has(category)) {
            console.error(`[ResourceCollector] '${category}' is not a known resource category. Cannot release resources.`);
            return false;
        }
        let releasedAll = true;
        for (const path of ResourceCollector.#categoryMap.get(category)) {
            if (!ResourceCollector.release(path)) releasedAll = false;
        }
        return releasedAll;
    }

    /**
     * Remove all references to the given resource.
     * 
     * If the resource was in the process of loading, then the disposal callback given will be called on the loaded data after completion.
     * 
     * Allowed resource states: LOADED, LOADING, FAILED, PENDING_DISPOSAL
     * @param {string} resourcePath the path to the asset
     * @returns {boolean} true if the asset was successfully deleted, false otherwise.
     */
    static delete(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot delete resource.`);
            return false;
        }
        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        if (!resourceInfo) {
            console.warn(`[ResourceCollector] Resource '${resourcePath}' was not found in the cache. Cannot delete resource.`);
            return false;
        }
        // cancel deletion from resource disposer as deletion already handled
        if (ResourceCollector.isPendingDisposal(resourcePath)) {
            EventScheduler.cancel(resourcePath);
        }

        const disposalInfo = {
            data: resourceInfo.data,
            disposalCallback: resourceInfo.disposalCallback,
            category: resourceInfo.category
        }
        ResourceCollector.#dispose(resourcePath, disposalInfo);
        return true;
    }

    /**
     * Delete the resources associated with a category.
     * 
     * If any resource was in the process of loading, then the disposal callback given will be called on the loaded data after completion.
     * 
     * Allowed resource states: LOADED, LOADING, FAILED, PENDING_DISPOSAL
     * @param {string} category the category of the resources
     * @returns {boolean} true if the resource was successfully deleted, false otherwise
     */
    static deleteCategory(category) {
        if (typeof category !== 'string' || category.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'category' to be a non-empty string. Cannot delete resources.`);
            return false;
        }
        if (!ResourceCollector.#categoryMap.has(category)) {
            console.error(`[ResourceCollector] '${category}' is not a known resource category. Cannot delete resources.`);
            return false;
        }
        let deletedAll = true;
        for (const path of ResourceCollector.#categoryMap.get(category)) {
            if (!ResourceCollector.delete(path)) deletedAll = false;
        }
        return deletedAll;
    }

    /**
     * Deletes all registered resources from memory. Invokes each of their associated disposal callbacks.
     * 
     * If any resource was in the process of loading, then the disposal callback given will be called on the loaded data after completion.
     * 
     * Allowed resource states: LOADED, LOADING, FAILED, PENDING_DISPOSAL
     * @returns {boolean} true if all assets were successfully deleted, false otherwise.
     */
    static deleteAll() {
        let allAssetsDeleted = true;
        const resourcePathsArray = Array.from(ResourceCollector.#cache.keys());
        for (const resourcePath of resourcePathsArray) {
            if (!ResourceCollector.delete(resourcePath)) allAssetsDeleted = false;
        }
        return allAssetsDeleted;
    }

    /** 
     * Loads a resource, handling max retries, timeouts and errors. 
     * @returns {Promise} if the resource loads, the promise resolves with the loaded data
    */
    static async #loadResource(resourcePath, loadFunction, options) {
        // its assumed at this point that the parameters are validated and prepared for loading
        const maxRetries = options.maxRetries ? options.maxRetries : 0;
        const loadTimeout = options.loadTimeout ? Math.trunc(options.loadTimeout * 1000) : 3000;
        let loadError;
        for (let loadAttempt = 0; loadAttempt <= maxRetries; loadAttempt++) {
            try {
                // combine inner and outer abort signals
                const timeoutController = new AbortController();
                const compositeController = new AbortController();

                timeoutController.signal.addEventListener('abort', () => {
                    compositeController.abort('timeout');
                }, { once: true });

                if (options.signal && options.signal instanceof AbortSignal) {
                    options.signal.addEventListener('abort', () => {
                        compositeController.abort(options.signal.reason || 'aborted');
                    }, { once : true });
                }

                // create timeout and load promise
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => {
                    loadError = new Error(`[ResourceCollector] Failed to load resource due to timeout. (Attempt # ${loadAttempt+1}; Retries left: ${maxRetries-loadAttempt})`);
                    if (options.onLoadTimeout && typeof options.onLoadTimeout === 'function') {
                        options.onLoadTimeout(resourcePath, loadError);
                    } else if (options.onLoadTimeout) {
                        console.error(`${loadError.message}. Invalid onLoadTimeout function given.`)
                    }
                    timeoutController.abort(loadError.message);
                    reject(loadError);
                }, loadTimeout));
                const loadPromise = loadFunction(resourcePath, { signal: compositeController.signal });

                // race the promises to see who wins!
                const loadedData = await Promise.race([loadPromise, timeoutPromise]);
                if (loadedData === null || loadedData === undefined) {
                    // reject immediately if the load function resolved but gave unusable data
                    return Promise.reject(new Error("[ResourceCollector] Load function resolved but didn't return usable data. Cannot store data in cache."));
                }
                return loadedData; // load succeeded with valid data, we're done
            } catch (error) {
                loadError = error;
                // break out of the loop if the error was caused by an external abort signal (not a timeout)
                if (error instanceof DOMException && error.name === 'AbortError') {
                    if (error.reason !== 'timeout') {
                        throw error;
                    }
                }
            }
        }
        // max retry attempts reached, resource failed to load
        try {
            if (options.onLoadFailure && typeof options.onLoadFailure === 'function') {
                console.warn(`[ResourceCollector] Maximum load attempts (${maxRetries}) reached for resource '${resourcePath}'. Calling load failure callback.`)
                options.onLoadFailure(resourcePath, loadError);
            } else if (options.onLoadFailure) {
                console.warn(`[ResourceCollector] Maximum load attempts (${maxRetries}) reached for resource '${resourcePath}'. No valid failure callback specified.`)
            }
        } catch (failureError) {
            console.error(`[ResourceCollector] Error calling failure callbacks for '${resourcePath}': ${failureError}`);
        } finally {
            throw loadError;
        }
    }

    /** Called if loading a resource was successful */
    static #onLoadSuccess(resourcePath, loadedData, disposalCallback = null) {
        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        if (!resourceInfo) {
            console.warn(`[ResourceCollector] Async load/reload of '${resourcePath}' successful, but the resource was removed from the cache during loading. Loaded resource data discarded.`);
            if (disposalCallback) {
                try {
                    disposalCallback(loadedData);
                } catch (disposalError) {
                    console.error(`[ResourceCollector] Disposal callback for resource '${resourcePath}' encountered an error: ${disposalError}`);
                }
            }
            return;
        }

        // update resource info
        if (resourceInfo.currentState === ResourceCollector.States.PENDING_DISPOSAL) {
            resourceInfo.priorState = ResourceCollector.States.LOADED;
        } else {
            resourceInfo.currentState = ResourceCollector.States.LOADED;
        }
        resourceInfo.data = loadedData;
        resourceInfo._resolve(loadedData);
    }

    /** called when a resource should be scheduled for deletion */
    static #scheduleForDisposal(resourcePath, resourceInfo) {
        resourceInfo.priorState = resourceInfo.currentState; // save prior load state to handle reloads/disposal cancelations
        resourceInfo.currentState = ResourceCollector.States.PENDING_DISPOSAL;
        const delay = resourceInfo.disposalDelay;
        const disposalInfo = {
            category: resourceInfo.category ? resourceInfo.category : null,
            data: resourceInfo.data,
            disposalCallback: resourceInfo.disposalCallback
        }
        EventScheduler.schedule(resourcePath, delay, ResourceCollector.#dispose, { eventData: disposalInfo});
    }

    /** callback function for ResourceDisposer, invoked when disposal delay time is expired */
    static #dispose(resourcePath, disposalInfo) {
        if (disposalInfo.disposalCallback && disposalInfo.data) {
            disposalInfo.disposalCallback(disposalInfo.data);
        }

        // remove from caches
        ResourceCollector.#cache.delete(resourcePath);
        const category = disposalInfo.category;
        if (category) {
            ResourceCollector.#categoryMap.get(category).delete(resourcePath);
            if (ResourceCollector.#categoryMap.get(category).size === 0) {
                ResourceCollector.#categoryMap.delete(category);
            }
        }
    }

    /**
     * Fetch an image file from the server. Aborts loading if the provided signal fires.
     * 
     * Note: This function is intented to be a potential load function for ResourceCollector.load() - it does not store the data it loads in the cache.
     * @param {string} imagePath the path to the image
     * @param {AbortSignal} loadOptions.signal a signal used to determine if the client should abort the fetch request. 
     * @returns {Promise} a promise that resolves to a decoded image object
     */
    static async fetchImageFile(imagePath, loadOptions) {
        // fetch image binary from server
        const response = await fetch(imagePath, { signal: loadOptions.signal });
        if (!response.ok) {
            return Promise.reject(new Error(`[Server] Error loading image file '${imagePath}'. Status:${response.status}.`))
        }

        const imageBinary = await response.blob();
        return await createImageBitmap(imageBinary);
    }

    /**
     * Fetch a text file from the server. Aborts loading if the provided signal fires.
     * 
     * Note: This function is intented to be a potential load function for ResourceCollector.load() - it does not store the data it loads in the cache.
     * @param {string} imagePath the path to the image
     * @param {AbortSignal} loadOptions.signal a signal used to determine if the client should abort the fetch request. 
     * @returns {Promise} a promise resolving with the loaded text
     */
    static async fetchTextFile(filePath, loadOptions) {
        const response = await fetch(filePath, { signal: loadOptions.signal });
        if (!response.ok) {
            return Promise.reject(new Error(`[Server] Error loading text file '${filePath}'. Status:${response.status}.`))
        }

        return response.text();
    }
}