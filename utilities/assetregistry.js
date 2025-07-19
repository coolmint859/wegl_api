/**
 * Utility class for loading and caching common assets 
 * */
class AssetRegistry {
    static AssetState = {
        LOADING: 'loading',
        LOADED: 'loaded',
        FAILED: 'failed',
    }
    static #cache = new Map();

    /**
     * Asyncronously load an asset (image, audio, text, etc..) into main memory
     * @param {string} assetPath the path/url to the asset
     * @param {Function} loadFunction the primary loading function for the asset. Must by asyncronous and should return an object of desired stored information.
     * @param {Function} disposeFunction called when this asset is deleted from memory (i.e no has no references). Only called when release(), delete() or deleteAll() are called. Should receive the stored data provided by loadFunction as a parameter.
     * @returns {Promise} a promise indicating success or failure of loading the asset
     */
    static async load(assetPath, loadFunction, disposeFunction = null) {
        if (AssetRegistry.#cache.has(assetPath)) {
            const assetInfo = AssetRegistry.#cache.get(assetPath);
            if (assetInfo.loadState !== AssetRegistry.AssetState.FAILED) {
                assetInfo.refCount++;
                console.log(`[AssetLoader]: Using existing asset '${assetPath}'. Reference Count: ${assetInfo.refCount}.`);
                return assetInfo.loadPromise;
            } else {
                return Promise.reject(new Error(`Asset '${assetPath}' previously failed to load. Try reloading data to resolve any issues.`));
            }
        } else {
            let resolveFunc, rejectFunc;
            const loadPromise = new Promise((resolve, reject) => {
                resolveFunc = resolve;
                rejectFunc = reject;
            });

            const assetInfo = {
                refCount: 1,
                loadState: AssetRegistry.AssetState.LOADING,
                data: null,
                _disposeFunc: disposeFunction,
                _loadFunc: loadFunction,
                loadPromise: loadPromise,
                _resolve: resolveFunc,
                _reject: rejectFunc
            }
            AssetRegistry.#cache.set(assetPath, assetInfo);

            console.log(`[AssetLoader]: Initiating load for asset '${assetPath}'. Reference Count: ${assetInfo.refCount}.`);
            try {
                const assetData = await loadFunction(assetPath);
                AssetRegistry.#onLoadSuccess(assetPath, assetData)
                // console.log(assetData);
                return assetData;
            } catch (error) {
                AssetRegistry.#onLoadFailure(assetPath, error);
                throw error;
            }
        }
    }

    /**
     * Reload the data from the given path to memory, if it exists. Uses the loadFunction and disposalFunction provided at first load.
     * If the reload attempt fails, this will fall back to the last known state of the data.
     * @param {string} assetPath the path/url to the asset
     * @returns {Promise} a promise inidicating success or failure on reloading
     */
    static async reload(assetPath) {
        const assetInfo = AssetRegistry.#cache.get(assetPath);
        if (!assetInfo) {
            console.error(`[AssetLoader]: Asset '${assetPath}' was not found in the registry. Cannot reload.`)
            return Promise.reject(new Error(`Asset '${assetPath}' was not found in the registry.`));
        }

        const oldData = assetInfo.data;
        const oldState = assetInfo.loadState;

        // obtain new load promise
        let newResolveFunc, newRejectFunc;
        const newLoadPromise = new Promise((resolve, reject) => {
            newResolveFunc = resolve;
            newRejectFunc = reject;
        });

        // update state to prepare for reloading
        assetInfo.loadState = AssetRegistry.AssetState.LOADING;
        assetInfo.loadPromise = newLoadPromise;
        assetInfo._resolve = newResolveFunc;
        assetInfo._reject = newRejectFunc;

        try {
            // attempt to load in new data
            const newAssetData = await assetInfo._loadFunc(assetPath);

            // dispose old data
            if (assetInfo._disposeFunc && assetInfo.data) {
                assetInfo._disposeFunc(assetInfo.data);
            }

            AssetRegistry.#onLoadSuccess(assetPath, newAssetData);
            return newAssetData;
        } catch (error) {
            // reload failed, fallback to old data
            assetInfo.data = oldData;
            assetInfo.loadState = oldState;
            assetInfo._reject(error);

            console.error(`[AssetLoader] Attempt to reload data at ${assetPath} failed. Reverting back to old state. Error: ${error}`)
            throw error;
        }
    }

    /**
     * Checks if an asset has successfully loaded into memory
     * @param {string} assetPath the path/url to the asset
     * @returns {boolean} true if the asset was successfully loaded, false otherwise
     */
    static isLoaded(assetPath) {
        if (AssetRegistry.#cache.has(assetPath)) {
            const assetInfo = AssetRegistry.#cache.get(assetPath);
            return assetInfo.loadState === AssetRegistry.AssetState.LOADED;
        }
        return false;
    }

    /**
     * Checks if an asset had failed loading into memory
     * @param {string} assetPath the path/url to the asset
     * @returns {boolean} true if the asset was failed loading, false otherwise
     */
    static isFailed(assetPath) {
        if (AssetRegistry.#cache.has(assetPath)) {
            const assetInfo = AssetRegistry.#cache.get(assetPath);
            return assetInfo.loadState === AssetRegistry.AssetState.FAILED;
        }
        return false;
    }

    /**
     * Retrieve the data stored with the asset, if it exists and has successfully loaded.
     * @param {string} assetPath the path/url to the asset
     * @returns {object | null} an object containing the data stored with the asset as determined at load time. If the asset has not finished loading, failed loading, or doesn't exist, null is returned.
     */
    static getAssetData(assetPath) {
        if (AssetRegistry.isLoaded(assetPath)) {
            return AssetRegistry.#cache.get(assetPath).data;
        }
        return null;
    }

    /**
     * Check if an asset is in the registry. Note: does not check the status of the asset, only whether it's present.
     * @param {string} assetPath the path/url to the asset
     * @returns {boolean} true if the asset was found, false otherwise
     */
    static contains(assetPath) {
        return AssetRegistry.#cache.has(assetPath);
    }

    /**
     * Remove a reference from the given asset. If there are no more references to this asset, it's associated dispose function is called.
     * @param {string} assetPath the path/url to the asset
     * @returns {boolean} true if the asset was successfully released, false otherwise
     */
    static release(assetPath) {
        // then check if the collection has this specific texture defined
        const assetInfo = AssetRegistry.#cache.get(assetPath);
        if (!assetInfo) {
            console.warn(`[AssetLoader]: Asset '${assetPath}' was not found in the registry. Cannot release asset from memory.`);
            return false;
        }
        assetInfo.refCount--;
        console.log(`Released Asset '${assetPath}'. New reference count: ${assetInfo.refCount}.`);

        // if the reference count is <= 0, delete the texture from memory
        if (assetInfo.refCount <= 0 ) {
            console.log(`No more references exist for texture '${assetPath}'. Removing texture from GPU memory.`);
            if (assetInfo._disposeFunc && assetInfo.data) {
                assetInfo._disposeFunc(assetInfo.data);
            }
            AssetRegistry.#cache.delete(assetPath);
        }
        return true;
    }

    /**
     * Remove all references to the given asset and delete it from memory. Calls it's associated dispose function
     * @param {string} assetPath the path to the asset
     * @returns {boolean} true if the asset was successfully deleted, false otherwise.
     */
    static delete(assetPath) {
        const assetInfo = AssetRegistry.#cache.get(assetPath);
        if (assetInfo) {
            if (assetInfo._disposeFunc && assetInfo.data) {
                assetInfo._disposeFunc(assetInfo.data);
            }
            AssetRegistry.#cache.delete(assetPath);

            console.log(`Deleted Asset '${assetPath}' from memory. All references removed.`);
            return true;
        } else {
            console.warn(`[AssetLoader]: Asset '${assetPath}' was not found in the registry. Cannot release asset from memory.`);
            return false;
        }
    }

    /**
     * Deletes all registered resources from memory. Calls each of their associated dispose functions.
     * @returns {boolean} true if all assets were successfully deleted, false otherwise.
     */
    static deleteAll() {
        let allAssetsDeleted = true;
        const assetPathsArray = Array.from(AssetRegistry.#cache.keys());
        for (const assetPath of assetPathsArray) {
            if (!AssetRegistry.delete(assetPath)) allAssetsDeleted = false;
        }
        return allAssetsDeleted;
    }

    /** Called if loading a resource was successful */
    static #onLoadSuccess(assetPath, loadedData) {
        if (loadedData === null) {
            console.warn(`[AssetLoader]: Provided loading function for '${assetPath}' did not return usable data. Loaded data discarded.`);
            return;
        }

        const assetInfo = AssetRegistry.#cache.get(assetPath);
        if (!assetInfo || assetInfo.loadState !== AssetRegistry.AssetState.LOADING) {
            console.warn(`[AssetLoader]: Async load of '${assetPath}' completed, but assetInfo was modified/removed. Loaded data discarded.`);
            return;
        }

        // update asset info
        assetInfo.data = loadedData;
        assetInfo.loadState = AssetRegistry.AssetState.LOADED;
        assetInfo._resolve(loadedData);
        console.log(`[AssetLoader]: Asset '${assetPath}' successfully loaded.`);

        // If refCount dropped to 0 while loading, clean up immediately
        if (assetInfo.refCount <= 0) {
            AssetRegistry.release(assetPath);
        }
    }

    /** Called if loading a resource was unsuccessful. */
    static #onLoadFailure(assetPath, error) {
        const assetInfo = AssetRegistry.#cache.get(assetPath);
        if (!assetInfo || assetInfo.loadState !== AssetRegistry.AssetState.LOADING) {
            console.warn(`[AssetLoader]: Async load of '${assetPath}' failed, but assetInfo was modified/removed. Error discarded.`);
            return;
        }

        // update asset info
        assetInfo.loadState = AssetRegistry.LoadState.FAILED;
        assetInfo.data = null;
        assetInfo._reject(error);
        console.error(`[AssetLoader]: Failed to load asset '${assetPath}'. Error:`, error);

        // If refCount dropped to 0, clean up immediately
        if (assetInfo.refCount <= 0) {
            AssetRegistry.release(assetPath);
        }
    }
}