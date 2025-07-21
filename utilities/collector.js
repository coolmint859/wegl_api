/**
 * Utility class for loading and caching common assets and disposal when no longer referenced.
 * */
export default class ResourceCollector {
    static States = Object.freeze({
        LOADING: 'loading',                         // currently being loaded
        LOADED: 'loaded',                           // loaded and ready for use
        FAILED: 'failed',                           // failed to load
        PENDING_DISPOSAL: 'pending_disposal',       // scheduled for deletion
    });
    static #cache = new Map();

    /**
     * Asyncronously load a resource (image, audio, text, etc..) into memory, with maxRetries and optional failed load callback
     * @param {string} resourcePath the path/url to the resource
     * @param {Function} loadFunction the primary loading function for the resource. Must be asyncronous and should return the data to be stored.
     * @param {number | null} [options.maxRetries = 0] the maximum number of times that the resource will attempt to load if the first attempt fails.
     * @param {Function | null} options.onMaxRetriesReached called if the maximum number of retries was reached when attempting to load in the resource. Should accept the resourcePath and an error message as parameters.
     * @param {Function | null} options.disposeCallback called when this resource is deleted from memory (i.e no has no references). Should accept the stored data as a parameter.
     * @param {number | null} [options.disposalDelay = 1] the amount of time in seconds before the resource is disposed when all consumers have released it
     * @returns {Promise} a promise indicating success or failure of loading the resource
     */
    static async load(resourcePath, loadFunction, options={}) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot load in resource.`);
            return Promise.reject(new Error(`[ResourceCollector] '${resourcePath}' is not a non-empty string.`));
        }
        if (typeof loadFunction !== 'function') {
            console.error(`[ResourceCollector] TypeError: Expected 'loadFunction' to be a function. Cannot load in resource ${resourcePath}.`);
            return Promise.reject(new Error(`[ResourceCollector] '${loadFunction}' is not a function.`));
        }
        if (ResourceCollector.#cache.has(resourcePath)) {
            const resourceInfo = ResourceCollector.#cache.get(resourcePath);
            if (!ResourceCollector.loadFailure(resourcePath)) {
                console.info(`[ResourceCollector] Reusing cached resource '${resourcePath}'`)
                resourceInfo.refCount++;
                return resourceInfo.loadPromise;
            }
        }

        // Either this is the first attempt loading in the resource, or the asset was present but failed to load before.
        // Before we attempt to load, we set up load promise and cache asset metadata
        let resolveFunc, rejectFunc;
        const loadPromise = new Promise((resolve, reject) => {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        const resourceInfo = {
            refCount: 1,
            loadState: ResourceCollector.States.LOADING,
            priorState: null,
            data: null,
            _disposeCallback: options.disposalCallback,
            _disposeDelay: options.disposalDelay ? options.disposalDelay : 1,
            _loadFunc: loadFunction,
            loadPromise: loadPromise,
            _resolve: resolveFunc,
            _reject: rejectFunc
        }
        // cache the resource once before attempting to load with retries
        ResourceCollector.#cache.set(resourcePath, resourceInfo);
        
        let maxRetries = options.maxRetries ? options.maxRetries : 0;
        let loadError;
        for (let loadAttempt = 0; loadAttempt <= maxRetries; loadAttempt++) {
            try {
                const resourceData = await loadFunction(resourcePath);
                ResourceCollector.#onLoadSuccess(resourcePath, resourceData)
                console.log(`[ResourceCollector] Load successful for resource '${resourcePath}'. Resource is cached and ready for use.`)
                return resourceData;
            } catch (error) {
                loadError = error;
                console.warn(`[ResourceCollector] Failed to load resource. Attempting to reload. (Retries made: ${loadAttempt}; Retries left: ${maxRetries-loadAttempt})`)
            }
        }
        // max retry attempts reached, but asset failed to load
        if (options.onMaxRetriesReached) {
            try {
                console.warn(`[ResourceCollector] Max reload attempts (${maxRetries}) reached for resource '${resourcePath}'. Calling max retry callback.`)
                options.onMaxRetriesReached(resourcePath, loadError);
            } catch (maxRetryError) {
                console.error(`[ResourceCollector] Error calling max retry callback function for '${resourcePath}': ${maxRetryError}`);
            } finally {
                ResourceCollector.#onLoadFailure(resourcePath, loadError);
                throw loadError;
            }
        } else {
            console.warn(`[ResourceCollector] Max reload attempts (${maxRetries}) reached for resource '${resourcePath}'. No max retry callback specified.`)
            ResourceCollector.#onLoadFailure(resourcePath, loadError);
            throw loadError;
        }
    }

    /**
     * Reload the resource from the given path to memory, if it exists. Uses the loadFunction and disposalFunction provided at first load.
     * If the reload attempt fails, this will fall back to the last known state of the resource.
     * @param {string} resourcePath the path/url to the resource
     * @param {number | null} [options.maxRetries = 0] the maximum number of times that the resource will attempt to load if the first attempt fails.
     * @param {Function | null} options.onMaxRetriesReached called if the maximum number of retries was reached when attempting to load in the resource. Should accept the resource path and an error message as parameters.
     * @returns {Promise} a promise inidicating success or failure on reloading
     */
    static async reload(resourcePath, options={}) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot attempt reload.`);
            return Promise.reject(new Error(`[ResourceCollector] '${resourcePath}' is not a non-empty string.`));
        }
        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        if (!resourceInfo) {
            console.error(`[ResourceCollector] Resource '${resourcePath}' was not found in the registry. Cannot attempt reload.`);
            return Promise.reject(new Error(`[ResourceCollector] Resource '${resourcePath}' was not found in the registry.`));
        }
        if (!resourceInfo._loadFunc) {
            console.error(`[ResourceCollector] Resource '${resourcePath}' does not have an associated loadFunction. Cannot attempt reload.`);
            return Promise.reject(new Error(`[ResourceCollector] Resource '${resourcePath}' missing loadFunction.`));
        }

        const oldData = resourceInfo.data;
        const oldState = resourceInfo.loadState;

        // obtain new load promise
        let newResolveFunc, newRejectFunc;
        const newLoadPromise = new Promise((resolve, reject) => {
            newResolveFunc = resolve;
            newRejectFunc = reject;
        });

        // update state to prepare for reloading
        resourceInfo.loadState = ResourceCollector.States.LOADING;
        resourceInfo.loadPromise = newLoadPromise;
        resourceInfo._resolve = newResolveFunc;
        resourceInfo._reject = newRejectFunc;

        let maxRetries = options.maxRetries ? options.maxRetries : 0;
        let reloadError;
        for (let loadAttempt = 0; loadAttempt <= maxRetries; loadAttempt++) {
            try {
                const newResourceData = await resourceInfo._loadFunc(resourcePath);

                // dispose old data (if dispose callback given). We do this immediately as new data has replaced it
                if (resourceInfo._disposeCallback && resourceInfo.data) {
                    try {
                        resourceInfo._disposeCallback(resourceInfo.data);
                    } catch (disposeError) {
                        console.error(`[ResourceCollector] Reload successful for resource '${resourcePath}', but the disposal callback of the old resource data encountered an error: ${disposeError}`);
                    }
                }

                ResourceCollector.#onLoadSuccess(resourcePath, newResourceData);
                console.log(`[ResourceCollector] Reload successful for resource '${resourcePath}'. Resource is cached and ready for use.`);
                return newResourceData;
            } catch (error) {
                reloadError = error;
                console.warn(`[ResourceCollector] Failed to load resource. Attempting to reload. (Retries made: ${loadAttempt}; Retries left: ${maxRetries-loadAttempt})`)
            }
        }
        // reload attempts failed, fallback to old data
        resourceInfo.data = oldData;
        resourceInfo.loadState = oldState;

        if (options.onMaxRetriesReached) {
            try {
                console.warn(`[ResourceCollector] Max reload attempts (${maxRetries}) reached for resource '${resourcePath}'. Calling max retry callback.`)
                options.onMaxRetriesReached(resourcePath, reloadError);
            } catch (maxRetryError) {
                console.error(`[ResourceCollector] Error calling max retry callback for '${resourcePath}': ${maxRetryError}`);
            } finally {
                ResourceCollector.#onLoadFailure(resourcePath, reloadError);
                throw reloadError;
            }
        } else {
            console.warn(`[ResourceCollector] Attempt to reload resource at ${resourcePath} failed, and max retries reached. No max retry callback specified. Reverting back to old state. Error: ${reloadError}`)
            ResourceCollector.#onLoadFailure(resourcePath, reloadError);
            throw reloadError;
        }
    }

    /**
     * Store an already loaded resource into the cache. Useful for programatically created resources that are stored in places that the Javascript GC can't access (like GPU memory)
     * @param {string} alias a unique identifier to use when operating on the resource in the cache.
     * @param {any} resourceData the preloaded resource to store in the cache.
     * @param {Function} options.loadFunction an optional loading function for the resource. Must be asyncronous and should return the data to be stored. Note, if this is not provided, the stored resource cannot be reloaded with ResourceCollector.reload()
     * @param {Function | null} options.disposalCallback called when this resource is deleted from memory (i.e no has no references). Should accept the stored data as a parameter.
     * @param {number | null} options.disposalDelay the amount of time in seconds before the resource is disposed when all consumers have released it.
     * @returns {boolean} true if the preloaded resource was successfully stored, false otherwise
     */
    static storePreloaded(alias, resourceData, options={}) {
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
                loadState: ResourceCollector.States.LOADED,
                priorState: null,
                data: resourceData,
                _loadFunc: options.loadFunction,
                _disposeCallback: options.disposalCallback,
                _disposeDelay: options.disposalDelay ? options.disposalDelay : 1,
            }
            // cache the resource once before attempting to load with retries
            ResourceCollector.#cache.set(alias, resourceInfo);
            return true;
        }
    }

    /**
     * Checks if an resource has successfully loaded into memory
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource was successfully loaded, false otherwise
     */
    static loadSuccess(resourcePath) {
        if (ResourceCollector.#cache.has(resourcePath)) {
            const resourceInfo = ResourceCollector.#cache.get(resourcePath);
            return resourceInfo.loadState === ResourceCollector.States.LOADED;
        }
        return false;
    }

    /**
     * Checks if an resource had failed loading into memory
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource was failed loading, false otherwise
     */
    static loadFailure(resourcePath) {
        if (ResourceCollector.#cache.has(resourcePath)) {
            const resourceInfo = ResourceCollector.#cache.get(resourcePath);
            return resourceInfo.loadState === ResourceCollector.States.FAILED;
        }
        return false;
    }

    /**
     * Checks if a resource is currently pending disposal
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource is pending disposal, false otherwise
     */
    static pendingDisposal(resourcePath) {
        if (ResourceCollector.#cache.has(resourcePath)) {
            const resourceInfo = ResourceCollector.#cache.get(resourcePath);
            return resourceInfo.loadState === ResourceCollector.States.PENDING_DISPOSAL;
        }
        return false;
    }

    /**
     * Retrieve the resource data, if it exists and has successfully loaded.
     * @param {string} resourcePath the path/url to the resource
     * @returns {object | null} the resource data. If the resource has not finished loading, failed loading, or doesn't exist, null is returned.
     */
    static get(resourcePath) {
        if (ResourceCollector.loadSuccess(resourcePath)) {
            return ResourceCollector.#cache.get(resourcePath).data;
        }
        return null;
    }

    /**
     * Check if a resource (regardless of state) is in the cache.
     * @param {string} resourcePath the path/url to the resource
     * @returns {boolean} true if the resource was found, false otherwise
     */
    static contains(resourcePath) {
        return ResourceCollector.#cache.has(resourcePath);
    }

    /**
     * Acquire this resource. Useful for cases when the resource consumer itself can be shared.
     * @param {string} resourcePath the path/url to the resource
     * @returns true if the resource exists and was acquired, false otherwise
     */
    static acquire(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot acquire resource.`);
            return false;
        }
        if (!ResourceCollector.#cache.has(resourcePath)) {
            console.warn(`[ResourceCollector] Resource '${resourcePath}' was not found in the cache. Cannot acquire resource. If was previously in a failed state, try loading it again.`);
            return false;
        }

        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        if (ResourceCollector.loadFailure(resourcePath)) {
            console.warn(`[ResourceCollector] Resource '${resourcePath}' was found but previously failed to load. Cannot acquire resource. Try reloading it prior to acquisition.`);
            return false;
        }
        // if the resource was previously scheduled for disposal, cancel that.
        if (ResourceDisposer.isScheduled(resourcePath)) {
            resourceInfo.loadState = resourceInfo.priorState; // reset load state to state prior to scheduled disposal
            resourceInfo.priorState = null; // reset prior state;
            ResourceDisposer.cancel(resourcePath);
        }
        resourceInfo.refCount++;
        return true;
    }

    /**
     * Release this resource. If there are no more consumers for this resource, it's scheduled for disposal.
     * @param {string} resourcePath the path/url to the asset
     * @returns {boolean} true if the asset was successfully released, false otherwise
     */
    static release(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot release resource.`);
            return false;
        }
        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        if (!resourceInfo) {
            console.warn(`[ResourceCollector] Resource '${resourcePath}' was not found in the registry. Cannot release asset.`);
            return false;
        }
        resourceInfo.refCount--;

        if (resourceInfo.refCount <= 0 ) {
            console.log(`[ResourceCollector] No more consumers are using resource '${resourcePath}'. Scheduling for removal.`);
            ResourceCollector.#scheduleForDisposal(resourcePath, resourceInfo);
        }
        return true;
    }

    /**
     * Remove all references to the given resource. Calls it's associated dispose function
     * @param {string} resourcePath the path to the asset
     * @returns {boolean} true if the asset was successfully deleted, false otherwise.
     */
    static delete(resourcePath) {
        if (typeof resourcePath !== 'string' || resourcePath.trim() === '') {
            console.error(`[ResourceCollector] TypeError: Expected 'resourcePath' to be a non-empty string. Cannot delete resource.`);
            return false;
        }
        const resourceInfo = ResourceCollector.#cache.get(resourcePath);
        if (resourceInfo) {
            if (resourceInfo._disposeCallback && resourceInfo.data) {
                try {
                    resourceInfo._disposeCallback(resourceInfo.data);
                } catch (error) {
                    console.error(`[ResourceCollector] Resource '${resourcePath}' was deleted and disposal callback invoked, but callback encountered an error: ${error}`);
                }
            }
            ResourceCollector.#cache.delete(resourcePath);

            // cancel deletion from resource disposer as deletion already handled
            if (ResourceDisposer.isScheduled(resourcePath)) {
                ResourceDisposer.cancel(resourcePath);
            }

            return true;
        } else {
            console.warn(`[ResourceCollector] Resource '${resourcePath}' was not found in the registry. Cannot delete resource.`);
            return false;
        }
    }

    /**
     * Deletes all registered resources from memory. Invokes each of their associated disposal callbacks.
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

    /** Called if loading a resource was successful */
    static #onLoadSuccess(resourcePath, loadedData) {
        if (loadedData === null) {
            console.warn(`[ResourceCollector] Provided loading function for '${resourcePath}' did not return usable data. Resource discarded.`);
            return;
        }

        const assetInfo = ResourceCollector.#cache.get(resourcePath);
        if (!assetInfo || assetInfo.loadState !== ResourceCollector.States.LOADING) {
            console.warn(`[ResourceCollector] Async load/reload of '${resourcePath}' completed, but the resource data was modified/removed. Resource discarded.`);
            return;
        }

        // update asset info
        assetInfo.data = loadedData;
        assetInfo.loadState = ResourceCollector.States.LOADED;
        assetInfo._resolve(loadedData);

        // If refCount dropped to 0 while loading, clean up immediately
        if (assetInfo.refCount <= 0) {
            ResourceCollector.release(resourcePath);
        }
    }

    /** Called if loading a resource was unsuccessful. */
    static #onLoadFailure(resourcePath, error) {
        const assetInfo = ResourceCollector.#cache.get(resourcePath);
        if (!assetInfo || assetInfo.loadState !== ResourceCollector.States.LOADING) {
            console.warn(`[ResourceCollector] Async load/reload of '${resourcePath}' failed, but the resource data was modified/removed.`);
            return;
        }

        // update asset info
        assetInfo.loadState = ResourceCollector.States.FAILED;
        assetInfo.data = null;
        assetInfo._reject(error);

        // If refCount dropped to 0, clean up immediately
        if (assetInfo.refCount <= 0) {
            ResourceCollector.release(resourcePath);
        }
    }

    /** called when a resource should be scheduled for deletion */
    static #scheduleForDisposal(resourcePath, resourceInfo) {
        resourceInfo.priorState = resourceInfo.loadState; // save in case disposal is canceled
        resourceInfo.loadState = ResourceCollector.States.PENDING_DISPOSAL;
        const delay = resourceInfo._disposeDelay;
        const disposalInfo = {
            data: resourceInfo.data,
            disposeCallback: resourceInfo._disposeCallback
        }
        ResourceDisposer.schedule(resourcePath, disposalInfo, delay, { disposalCallback: ResourceCollector.#dispose });
    }

    /** callback function for ResourceDisposer, invoked when disposal delay time is expired */
    static #dispose(resourcePath, disposalData) {
        if (disposalData.disposalCallback && disposalData.data) {
            disposalData.disposalCallback(disposalData.data);
        }
        ResourceCollector.#cache.delete(resourcePath);
    }

    /**
     * load an image file from the server.
     * 
     * Note: the loaded image is NOT stored in the cache. Use this function in conjunction with ResourceCollector.load()
     * @param {string} imagePath the path to the image
     */
    static async loadImage(imagePath) {
        try {
            let asset = new Image();
            asset.crossOrigin = "anonymous";
            asset.src = imagePath;
            await asset.decode();

            return asset;
        } catch (err) {
            throw err;
        }
    }

    /**
     * load a text file from the server.
     * 
     * Note: the loaded text is NOT stored in the registry. Use this function in conjunction with ResourceCollector.load()
     * @param {string} imagePath the path to the image
     */
    static async loadFile(filePath) {
        let result = await fetch(filePath);
        return result.text();
    }
}