/**
 * Represents a generic collection of objects with unique names.
 * 
 * Provides the ability to assign an arbitrary number of tags to each entry.
 * 
 * Instances of this class are used implicitly by the Renderer, Scene, Model, Material, and Texture classes.
 */
export default class Collection {
    static #BASE_TAG = 'base'; // this is put on entries with no given tag so they can still be retrieved by tag

    #entriesByName = new Map();
    #entriesByTag = new Map();
    #tagsByEntry = new Map();

    #name;
    #collectionID;
    static #ID_COUNTER = 0;

    /**
     * Create a new collection
     * @param {string} collectionName the name of the collection
     */
    constructor(collectionName) {
        // intitialize the entry->tag map to have the base tag
        this.#entriesByTag.set(Collection.#BASE_TAG, new Set());

        this.#name = collectionName;
        this.#collectionID = Collection.#ID_COUNTER++;
    }

    /**
     * Return the name of this collection.
     * @returns {string} the collection name
     */
    getCollectionName() {
        return this.#name;
    }

    /**
     * Return the ID of this collection.
     * @returns {number} the collection ID
     */
    getID() {
        return this.#collectionID;
    }

    /**
     * Add a new entry into the collection. If the entry with the specified name has already been added, that entry's reference is overwritten.
     * @param {string} entryName the name of the entry. This must be unique per entry.
     * @param {any} entryInstance a reference to the instance to be stored
     * @param {Array} tags optional array of entry tags
     * @returns {boolean} true if the entry was successfully added, false otherwise
     */
    add(entryName, entryInstance, ...tags) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a non-empty string. Unable to add entry to collection '${this.#name}'.`);
            return false;
        }

        // remove entry if it already exists.
        if (this.#entriesByName.has(entryName)) {
            this.removeByName(entryName);
        }

        this.#entriesByName.set(entryName, entryInstance);
        this.#tagsByEntry.set(entryName, new Set());

        // user didn't specify any tags, add base tag
        if (tags.length === 0) tags.push(Collection.#BASE_TAG);
        // iterate through array of tags
        for (const entryTag of tags) {
            if (typeof entryTag !== 'string' || entryTag.trim() === '') {
                console.warn(`TypeError: Expected 'tag' for entry '${entryName}' from tags Array to be a non-empty string. Skipping this tag.`);
                continue;
            }

            // check if the tag has't already been added
            if (!this.#entriesByTag.has(entryTag)) {
                this.#entriesByTag.set(entryTag, new Set()); // create a new set mapped to the tag
            }
            this.#entriesByTag.get(entryTag).add(entryName);
            this.#tagsByEntry.get(entryName).add(entryTag);
        }

        return true; // entry successfully added
    }

    /**
     * Assign a new tag to an entry.
     * @param {string} entryName the name of the entry.
     * @param {string} entryTag the tag to be associated with the entry
     * @returns {boolean} true if the tag was successfully associated with the entry, false otherwise
     */
    addTagTo(entryName, entryTag) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a non-empty string. Unable to associate tag with entry in collection '${this.#name}.`);
            return false;
        }
        if (typeof entryTag !== 'string' || entryTag.trim() === '') {
            console.warn(`TypeError: Expected 'entryTag' to be a non-empty string. Unable to associate tag with entry '${entryName} in collection '${this.#name}'.`);
            return false;
        }
        if (!this.#entriesByName.has(entryName)) {
            console.warn(`ValueError: Couldn't find entry '${entryName}' in collection '${this.#name}. Unable to associate tag with entry.`);
            return false;
        }
        // check first if the tag is not in the collection
        if (!this.#entriesByTag.has(entryTag)) {
            this.#entriesByTag.set(entryTag, new Set());
        }
        this.#entriesByTag.get(entryTag).add(entryName);
        this.#tagsByEntry.get(entryName).add(entryTag);
        return true;
    }

    /**
     * Assign an array of new tags to an entry.
     * @param {string} entryName the name of the entry.
     * @param {Array<string>} tags the tags to be associated with the entry
     * @returns {boolean} true if all tags were successfully associated with the entry, false otherwise
     */
    addTagsTo(entryName, ...tags) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a non-empty string. Unable to associate tags with entry in collection '${this.#name}.`);
            return false;
        }
        if (tags.length <= 0) {
            console.warn(`ValueError: Expected 'tags' to be an array with at least one element. Unable to associate any tags to entry '${entryName}' in collection '${this.#name}.`);
            return false;
        }

        // add tag one at a time
        let addedAllTags = true;
        for (const entryTag of tags) {
            // let addTagTo handle type validation
            if (!(this.addTagTo(entryName, entryTag))) {
                addedAllTags = false;
            }
        }
        return addedAllTags;
    }

    /**
     * Retrieve an entry with the given name from the collection, if it exists.
     * @param {string} entryName the name of the model
     * @returns {any} a reference to an entry instance
     */
    getByName(entryName) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a non-empty string. Unable to provide instance in collection '${this.#name}.`);
            return null;
        }
        if (!this.#entriesByName.has(entryName)) {
            console.warn(`ValueError: Unable to find an entry with the name '${entryName}' in collection '${this.#name}.`);
            return null;
        }
        return this.#entriesByName.get(entryName);
    }

    /**
     * Retrieves all entry names with the specified tag from the collection. If the tag is not found, returns an empty array.
     * @param {string} entryTag the tag associated with the entry
     * @returns {Array<string>} an array of strings
     */
    getNamesByTag(entryTag) {
        if (typeof entryTag !== 'string' || entryTag.trim() === '') {
            console.error(`TypeError: Expected 'entryTag' to be a non-empty string for collection '${this.#name}. Returning an empty array.`);
            return [];
        }
        if (!this.#entriesByTag.has(entryTag)) {
            console.warn(`${entryTag} is not a known entry tag in collection '${this.#name}. Returning an empty array.`);
            return [];
        }

        // the tag->entry map stores *names* of entries, so can use it directly
        const entryNamesWithTag = [];
        for (const entryName of this.#entriesByTag.get(entryTag)) {
            // we know the entry exists if it has a name, so we can safely retrieve it from the name->entry map
            entryNamesWithTag.push(entryName);
        }
        return entryNamesWithTag;
    }

    /**
     * Retrieves all entry instances with the specified tag from the collection. If the tag is not found, it returns an empty array.
     * @param {string} entryTag the tag associated with the entries
     * @returns {Array<any>} an array of objects
     */
    getByTag(entryTag) {
        if (typeof entryTag !== 'string' || entryTag.trim() === '') {
            console.error(`TypeError: Expected 'entryTag' to be a non-empty string for collection '${this.#name}. Returning an empty array.`);
            return [];
        }
        if (!this.#entriesByTag.has(entryTag)) {
            console.warn(`${entryTag} is not a known entry tag in collection '${this.#name}. Returning an empty array.`);
            return [];
        }

        // entriesByTag stores *names* of entries, so we need to find all entries with those names
        const entriesWithTag = [];
        for (const entryName of this.#entriesByTag.get(entryTag)) {
            // we know the entry exists if it has a name, so we can safely retrieve it from the name->entry map
            entriesWithTag.push(this.#entriesByName.get(entryName));
        }
        return entriesWithTag;
    }

    /**
     * Retrieves all tags associated with the given entry from the collection. If no entry is found, returns an empty array.
     * @param {string} entryName the name of the entry with the associated tags
     * @returns {Array<string>} an array of strings
     */
    getTagsOf(entryName) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a non-empty string in collection '${this.#name}. Returning an empty array.`);
            return [];
        }
        if (!this.#tagsByEntry.has(entryName)) {
            console.warn(`${entryName} is not a known entry name in collection '${this.#name}. Returning an empty array.`);
            return [];
        }
        return Array.from(this.#tagsByEntry.get(entryName));
    }

    /**
     * Retrieve all entries in the collection as an array.
     * @returns {Array<any>} a flat array of all entries in the scene
     */
    getAll() {
        return Array.from(this.#entriesByName.values());
    }

    /**
     * Removes the entry with the given name from the collection, if it exists.
     * @param {string} entryName the name of the entry
     * @param {boolean} [removeTags = true] flag to remove the entry's associated tags if it was the last entry to have them.
     * @returns {boolean} true if a entry was removed, false otherwise
     */
    removeByName(entryName, removeTags = true) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a non-empty string. Unable to remove instance from collection '${this.#name}.`);
            return false;
        }
        // no need to remove a entry that isn't in the collection
        if (!this.#entriesByName.has(entryName)) return false;

        // entry is in system, need to remove it
        this.#entriesByName.delete(entryName);

        // iterate through all of the tags associated with the entry and remove the entry with that tag
        for (const entryTag of this.#tagsByEntry.get(entryName)) {
            // we know the entry has this tag, so we can safely remove it without worry
            this.#entriesByTag.get(entryTag).delete(entryName);

            // remove the tag if this was the last associated entry
            if (removeTags && this.#entriesByTag.get(entryTag).size === 0) {
                this.#entriesByTag.delete(entryTag);
            }
        }
        this.#tagsByEntry.delete(entryName);
        return true;
    }

    /**
     * Removes all entries with the specified tag from the collection, if they exist.
     * @param {string} entryTag the tag associated with the entries
     * @returns {boolean} true if one or more entries were removed, false otherwise
     */
    removeByTag(entryTag) {
        if (typeof entryTag !== 'string' || entryTag.trim() === '') {
            console.error(`TypeError: Expected 'entryTag' to be a non-empty string. Unable to remove tagged entries in collection '${this.#name}.`);
            return false;
        }
        // no need to remove a entry that isn't in the scene
        if (!this.#entriesByTag.has(entryTag) || this.#entriesByTag.get(entryTag).size === 0) {
            return false;
        }

        // Iterate through the entry names that should be removed
        const entriesToRemoveArray = Array.from(this.#entriesByTag.get(entryTag));
        for (const entryName of entriesToRemoveArray) {
            // remove the entry from the entriesByName map
            this.#entriesByName.delete(entryName);

            // we need to remove the entries from the tag->entry map to maintain data consistency
            for (const tag of this.#tagsByEntry.get(entryName)) {
                this.#entriesByTag.get(tag).delete(entryName);

                // if this was the last entry with that tag, remove the tag (except if it's the base tag)
                if (this.#entriesByTag.get(tag).size === 0 && tag !== Collection.#BASE_TAG) {
                    this.#entriesByTag.delete(tag);
                }
            }
            // remove the tags associated with this entry
            this.#tagsByEntry.delete(entryName);
        }
        // remove all the entries with the specified tag
        this.#entriesByTag.delete(entryTag);
        return true;
    }

    /**
     * Removes the tag from the specified entry, if the entry and tag exist. 
     * If this was the only tag associated with the entry, automatically associates it with the 'base' tag
     * @param {string} entryName the name of the entry
     * @param {string} entryTag the tag associated with the entry
     * @returns {boolean} true if the entry was removed, false otherwise
     */
    removeTag(entryName, entryTag) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a string. Unable to remove tag in collection '${this.#name}.`);
            return false;
        }
        if (typeof entryTag !== 'string' || entryTag.trim() === '') {
            console.error(`TypeError: Expected 'entryTag' to be a string. Unable to remove tag from entry '${entryName}' in collection '${this.#name}.`);
            return false;
        }
        if (!this.#entriesByName.has(entryName)) {
            console.error(`ValueError: Unable to find '${entryName}' in collection. Cannot remove tag.`);
            return false;
        }

        // remove the tag from the entry->tag map
        const entryTags = this.#tagsByEntry.get(entryName);
        entryTags.delete(entryTag);

        // remove the entry from the tag->entry map
        this.#entriesByTag.get(entryTag).delete(entryName);

        // ensure that the entry is associated with the base tag if it has no other tags
        if (entryTags.size === 0) {
            console.warn(`Warning: '${entryName}' in collection '${this.#name} no longer has any tags after removing '${entryTag}'. Assigned the base tag to this entry.`);
            entryTags.add(Collection.#BASE_TAG);
            this.#entriesByTag.get(Collection.#BASE_TAG).add(entryName);
        }
        return true;
    }

    /**
     * Removes all custom tags from the specified entry, if the entry exists, leaving it with only the base tag. 
     * @param {string} entryName the name of the entry
     * @returns {boolean} true if the tags were removed, false otherwise
     */
    removeAllTags(entryName) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a string. Unable to remove tag in collection '${this.#name}.`);
            return false;
        }
        if (!this.#entriesByName.has(entryName)) {
            console.error(`ValueError: Unable to find '${entryName}' in collection. Unable to remove tags.`);
            return false;
        }

        for (const entryTag of this.#tagsByEntry.get(entryName)) {
            this.#entriesByTag.get(entryTag).delete(entryName);

            // remove the tag if it's no longer associated with any tags (and the tag isn't the base tag)
            if (this.#entriesByTag.get(entryTag).size === 0 && entryTag !== Collection.#BASE_TAG) {
                this.#entriesByTag.delete(entryTag);
            }
        }
        // clear tags from the entry->tag map, add back base tag to entry
        this.#tagsByEntry.get(entryName).clear();
        return this.addTagTo(entryName, Collection.#BASE_TAG);
    }

    /**
     * Checks if a entry with the specified name exists in the collection.
     * @param {string} entryName the name associated with the entry
     * @returns {boolean} true if the entry was found, false otherwise
     */
    contains(entryName) {
        if (typeof entryName !== 'string') return false;
        return this.#entriesByName.has(entryName);
    }

    /**
     * Checks if the given entry exists in the collection.
     * @param {any} entryInstance the entry instance
     * @returns {boolean} true if the entry was found, false otherwise
     */
    containsInstance(entryInstance) {
        for (const entry of this.#entriesByName.values()) {
            if (entry === entryInstance) return true;
        }
        return false
    }

    /**
     * Checks if at least one entry in the collection has the provided tag.
     * @param {string} entryTag the name of the tag
     * @returns {boolean} true if at least one entry has the tag, false otherwise
     */
    containsTag(entryTag) {
        if (typeof entryTag !== 'string') return false;
        return this.#entriesByTag.has(entryTag) && this.#entriesByTag.get(entryTag).size !== 0;
    }

    /**
     * Checks if the given entry is associated with the provided tag
     * @param {string} entryName the name of the entry
     * @param {string} entryTag the name of the tag
     * @returns {boolean} true if the entry is associated with the tag, false otherwise
     */
    entryHasTag(entryName, entryTag) {
        if (typeof entryName !== 'string' || entryName.trim() === '') {
            console.error(`TypeError: Expected 'entryName' to be a string. Unable to check for tag association in collection '${this.#name}.`);
            return false;
        }
        if (typeof entryTag !== 'string' || entryTag.trim() === '') {
            console.error(`TypeError: Expected 'entryTag' to be a string. Unable to check for tag association in collection '${this.#name}.`);
            return false;
        }
        if (!this.#entriesByName.has(entryName)) {
            console.error(`ValueError: Unable to find '${entryName}' in collection. Unable to find tag associations.`);
            return false;
        }
        return this.#tagsByEntry.get(entryName).has(entryTag);
    }

    /**
     * Returns the number of entries in this collection.
     * @returns {number}
     */
    size() {
        return this.#entriesByName.size;
    }

    /**
     * Retrieve all of the names currently in the collection
     * @returns {Iterable<string>} an iterable of names
     */
    getNames() {
        return this.#entriesByName.keys();
    }
    
    /**
     * Retrieve all of the tags currently in the collection
     * @returns {Iterable<string>} an iterable of names
     */
    getTags() {
        return this.#tagsByEntry.keys();
    }

    /**
     * Remove all entries (and tags) in the collection.
     * @param {boolean} [removeTags = true] if true, will remove all tags and entries from the collection. 
     * If false, will only remove the entries, but their tags will remain.
     */
    clear(removeTags = true) {
        console.log(`Clearing all entries in collection '${this.#name}'`);
        this.#entriesByName.clear();
        this.#tagsByEntry.clear();

        if (removeTags) {
            this.#entriesByTag.clear();
            this.#entriesByTag.set(Collection.#BASE_TAG, new Set());
        } else {
            for (const tag of this.#entriesByTag.keys()) {
                // clear the set associated with the tag, but keep the tag itself.
                this.#entriesByTag.get(tag).clear();
            }
        }
    }
}
