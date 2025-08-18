import Color from "../../utilities/color.js";
import Model from "../modeling/3d-primitive.js";
import Camera from "../cameras/camera.js";
import Light from "../lighting/light.js";

/**
 * Represents a renderable set of models, lights, and cameras in flat collections.
 * 
 * NOTE: The class keeps track of a default camera. This is unremovable, which ensures the scene always has a camera.
 * You can do whatever you want with the instance (it's name is 'defaultCamera' and it's tagged with 'default'), but you will not be
 * able to add any camera that has the same name or the same tag. This system ensures the default camera is always available as a failsafe.
 */
export default class Scene {
    // collections for each object
    #models;
    #lights;
    #cameras;

    // light and camera type maps
    #lightsByType = new Map();
    #camerasByType = new Map();

    // camera data
    #defaultCamera;
    #currentCamera;
    #currentViewAspectRatio = 0;
    #defaultCameraName = 'defaultCamera';
    #defaultCameraTag = 'default';

    // General scene data
    #ambientColor = new Color(0.1, 0.1, 0.1);
    #defaultClearColor = Color.BLACK
    #clearColor = this.#defaultClearColor;
    #normalClearColor = this.#clearColor.clone();
    #sceneName;
    #sceneID;

    // debug mode data
    #debugMode = false;
    #debugClearColor = Color.CF_BLUE;
    #defaultDebugShaderName = 'normals';
    #debugShaderName;

    static #ID_COUNTER = 0;

    /**
     * Create a new scene instance.
     * @param {string} sceneName the name of the scene
     */
    constructor(sceneName) {
        this.#sceneName = sceneName;
        this.#sceneID = Scene.#ID_COUNTER++;

        // set up collections
        this.#models = new Collection(`${this.#sceneName}.Models`);
        this.#lights = new Collection(`${this.#sceneName}.Lights`);
        this.#cameras = new Collection(`${this.#sceneName}.Cameras`);

        // add default camera to camera collection
        this.#defaultCamera = new FPSCamera();
        this.#currentCamera = this.#defaultCamera;
        this.addCamera(this.#defaultCameraName, this.#defaultCamera, this.#defaultCameraTag);
    }

    /// ------- GENERAL SCENE METHODS ------- ///

    /**
     * Return the name of this scene.
     * @returns {string} the scene name
     */
    getSceneName() {
        return this.#sceneName;
    }

    /**
     * Return the ID of this scene.
     * @returns {number} the scene ID
     */
    getID() {
        return this.#sceneID;
    }

    /**
     * Resets the scene to default settings. Does not remove any model, light or camera instances.
     */
    reset() {
        this.#currentCamera = this.#defaultCamera;
        this.#ambientColor = new Color(0.1, 0.1, 0.1);
        this.#currentViewAspectRatio = 0;

        this.setClearColor(this.#defaultClearColor);
        this.setDebugMode(false);
    }

    /**
     * Updates the scene properties and current camera. 
     * @param {number} dt the amount of time since the last frame in seconds
     */
    update(dt) {
        // for (const model of this.#models.getAll()) {
        //     model.update(dt);
        // }
        for (const camera of this.#cameras.getAll()) {
            camera.update(dt, this.#currentViewAspectRatio);
        }
        // for (const light of this.#lights.getAll()) {
        //     light.update(dt);
        // }
    }

    /**
     * Set the ambient color for this scene.
     * @param {Color} color the new ambient color
     */
    setAmbientColor(color) {
        if (!(color instanceof Color)) {
            console.error(`TypeError: Expected 'color' to be an instance of Color. Unable to set ambient color for scene '${this.#sceneName}'.`);
            return;
        }
        this.#ambientColor = color.clone();
    }

    /**
     * Get the current ambient color of this scene.
     * @returns {Color} a Color instance
     */
    getAmbientColor() {
        return this.#ambientColor.clone();
    }

    /**
     * Set the clear (background) color for this scene.
     * @param {Color} color the new background color
     */
    setClearColor(color) {
        if (!(color instanceof Color)) {
            console.error(`TypeError: ${color} is not an instance of Color. Unable to set clear color for scene '${this.#sceneName}'.`);
            return;
        }
        this.#clearColor = color.clone();
    }

    /**
     * Get the current clear color of this scene.
     * @returns a Color instance
     */
    getClearColor() {
        return this.#clearColor.clone();
    }

    /**
     * Toggles the debug mode for the scene.
     * When enabled, the clear color changes to a distinct debug color (Cornflower Blue),
     * and a specific debug shader can be specified for models.
     * @param {boolean} enabled True to enable debug mode, false to disable.
     * @param {string} [debugModelShaderName=null] Optional. The name of the shader to use for models
     * when debug mode is enabled. If not provided, a default
     * debug visualization (e.g., normals) might be used by the renderer.
     */
    setDebugMode(enabled, debugModelShaderName = null) {
        if (typeof enabled !== 'boolean') {
            console.error(`TypeError: 'enabled' must be a boolean. Cannot set debug mode for scene '${this.#sceneName}'`);
            return;
        }
        if (enabled === this.#debugMode) return;

        this.#debugMode = enabled;
        if (this.#debugMode) {
            // Store current clear color only if not already in debug mode
            this.#normalClearColor = this.#clearColor.clone();
            this.setClearColor(this.#debugClearColor);

            if (typeof debugModelShaderName === 'string' && debugModelShaderName.trim() !== '') {
                this.#debugShaderName = debugModelShaderName;
            } else {
                console.warn(`Scene '${this.#sceneName}': Debug mode enabled, but no specific debug shader name provided for models. Using default debug shader (shows model normals).`);
                this.#debugShaderName = this.#defaultDebugShaderName;
            }
        } else {
            // Restore original clear color
            this.setClearColor(this.#normalClearColor);
            this.#debugShaderName = null; // Clear debug shader name
        }
    }

    /**
     * Checks if the scene is currently in debug mode.
     * @returns {boolean} True if debug mode is active, false otherwise.
     */
    isDebugMode() {
        return this.#debugMode;
    }

    /**
     * Returns the name of the shader that models should use when the scene is in debug mode.
     * @returns {string|null} The name of the debug shader, or null if no specific one is set
     * or debug mode is off.
     */
    getDebugShaderName() {
        return this.#debugShaderName;
    }

    /**
     * Retrieve the currently active camera in the scene
     * @returns {Camera} the current active camera instance (provides the reference to enable updating outside of scene instance)
     */
    getCurrentCamera() {
        return this.#currentCamera;
    }

    /**
     * Sets the currently active in the scene.
     * @param {string} cameraName the name of the camera
     */
    setCurrentCamera(cameraName) {
        if (typeof cameraName !== 'string' || cameraName.trim() === '') {
            console.error(`TypeError: Expected 'cameraName' to be a non-empty string. Unable to set current Camera for scene '${this.#sceneName}'.`);
            return;
        }
        if (!this.#cameras.contains(cameraName)) {
            console.error(`ValueError: Unable to find a camera with name '${cameraName}'. Cannot set current Camera for scene '${this.#sceneName}'.`);
            return;
        }
        this.#currentCamera = this.#cameras.getByName(cameraName);
    }

    /**
     * Set the aspectRatio of the viewing frustum used by the currently active camera.
     * @param {number} aspectRatio the aspectRatio of the viewing frustum
     */
    setViewAspectRatio(aspectRatio) {
        if (typeof aspectRatio !== 'number' || aspectRatio <= 0.0 || isNaN(aspectRatio)) {
            console.error(`TypeError: Expected ${aspectRatio} to be a number greater than 0.0. Unable to set aspect ratio for scene '${this.#sceneName}'.`);
            return;
        }
        this.#currentViewAspectRatio = aspectRatio;
    }

    /// ------------ ADDERS ------------ ///

    /**
     * Add a new model into the scene. If the model with the specified name has already been added, that model's reference is overwritten.
     * @param {string} modelName the name of the model
     * @param {Model} model a reference to the model instance
     * @param {Array} tags optional array of model tags
     * @returns {boolean} true if the model was successfully added, false otherwise
     */
    addModel(modelName, model, ...tags) {
        if (typeof modelName !== 'string' || modelName.trim() === '') {
            console.error(`TypeError: Expected 'modelName' to be a non-empty string. Unable to add Model instance into scene '${this.#sceneName}'.`);
            return false;
        }
        if (!(model instanceof Model)) {
            console.error(`TypeError: Expected ${model} to be an instance of Model. Unable to add Model instance into scene '${this.#sceneName}'.`);
            return false;
        }
        return this.#models.add(modelName, model, ...tags);
    }

    /**
     * Add a new light into this scene. If the light with the specified name has already been added, that light's reference is overwritten.
     * @param {string} lightName the name of the light
     * @param {Model} light a reference to the light instance
     * @param {string} [lightTag = 'base'] optional light tag
     * @returns {boolean} true if the light was successfully added, false otherwise
     */
    addLight(lightName, light, ...tags) {
        if (typeof lightName !== 'string' || lightName.trim() === '') {
            console.error(`TypeError: Expected 'lightName' to be a non-empty string. Unable to add Light instance into scene '${this.#sceneName}'.`);
            return false;
        }
        if (!(light instanceof Light)) {
            console.error(`TypeError: Expected ${light} to be an instance of Light. Unable to add Light instance into scene '${this.#sceneName}'.`);
            return false;
        }
        // check if the light type wasn't added yet
        const lightType = light.getType();
        if (!this.#lightsByType.has(lightType)) {
            this.#lightsByType.set(lightType, new Set()); // create a new set mapped to the tag
        }
        this.#lightsByType.get(lightType).add(lightName);

        return this.#lights.add(lightName, light, ...tags);;
    }

    /**
     * Add a new camera into the scene
     * @param {string} cameraName the name of the camera
     * @param {Camera} camera a reference to the camera instance
     * @param {Array<string>} tags optional array of camera tags
     * @returns {boolean} true if the camera was successfully added, false otherwise
     */
    addCamera(cameraName, camera, ...tags) {
        if (typeof cameraName !== 'string' || cameraName.trim() === '') {
            console.error(`TypeError: Expected 'cameraName' to be a non-empty string. Unable to add Camera instance into scene '${this.#sceneName}'.`);
            return false;
        }
        if (!(camera instanceof Camera)) {
            console.error(`TypeError: ${camera} is not a Camera instance. Unable to add camera.`);
            return false;
        }
        // prevent adding a camera with the default tag (unless the camera instance IS the default camera)
        const defaultTagPresent = tags.includes(this.#defaultCameraTag);
        if (defaultTagPresent && camera !== this.#defaultCamera) {
            console.error(`ValueError: ${this.#defaultCameraTag} is a reserved tag for the default camera. Unable to add Camera instance into scene '${this.#sceneName}'.`);
            return false;
        } else if (!defaultTagPresent && camera === this.#defaultCamera) {
            console.error(`ValueError: the default camera must have the tag ${this.#defaultCameraTag}. Unable to add Camera instance into scene '${this.#sceneName}'.`);
            return false;
        }

        // check if the camera type wasn't added yet
        const cameraType = camera.getType();
        if (!this.#camerasByType.has(cameraType)) {
            this.#camerasByType.set(cameraType, new Set()); // create a new set mapped to the tag
        }
        this.#camerasByType.get(cameraType).add(cameraName);

        return this.#cameras.add(cameraName, camera, ...tags);
    }

    /// ------------ GET BY NAME ------------ ///

    /**
     * Retrieve a model with the given name from the scene, if it exists.
     * @param {string} modelName the name of the model
     * @returns {Model} a reference to a model instance
     */
    getModelByName(modelName) {
        if (typeof modelName !== 'string' || modelName.trim() === '') {
            console.error(`TypeError: Expected 'modelName' to be a non-empty string. Unable to get Model instance from scene '${this.#sceneName}'.`);
            return null;
        }
        return this.#models.getByName(modelName);
    }

    /**
     * Retrieves the light with the specified name from the scene. 
     * @param {string} lightName the name associated with the light
     * @returns {Light} a reference to a light instance
     */
    getLightByName(lightName) {
        if (typeof lightName !== 'string' || lightName.trim() === '') {
            console.error(`TypeError: Expected 'lightName' to be a non-empty string. Unable to get Light instance from scene '${this.#sceneName}'.`);
            return;
        }
        return this.#lights.getByName(lightName);
    }

    /**
     * Retrieves the camera with the specified name from the scene. 
     * @param {string} cameraName the name associated with the camera
     * @returns {Camera} a reference to a camera instance
     */
    getCameraByName(cameraName) {
        if (typeof cameraName !== 'string' || cameraName.trim() === '') {
            console.error(`TypeError: Expected 'cameraName' to be a non-empty string. Unable to get Camera instance from scene '${this.#sceneName}'.`);
            return;
        }
        return this.#cameras.getByName(cameraName);
    }

    /**
     * Retrieves the model, light, or camera with the specified name from the scene. 
     * @param {string} objectName the name associated with the objects
     * @returns {{'model': Model, 'light': Light, 'camera': Camera}} a javascript object
     */
    getObjectsByName(objectName) {
        if (typeof objectName !== 'string' || objectName.trim() === '') {
            console.error(`TypeError: Expected 'objectName' to be a non-empty string. Unable to get instances from scene '${this.#sceneName}'.`);
            return;
        }
        return {
            'model': this.getModelByName(objectName),
            'light': this.getLightByName(objectName),
            'camera': this.getCameraByName(objectName)
        }
    }

    /// ------------ GET BY TAG ------------ ///

    /**
     * Retrieves all models with the specified tag from the scene. If no tag is found, returns an empty array.
     * @param {string} modelTag the tag associated with the model
     * @returns {Array<Model>} an array of model instances
     */
    getModelsByTag(modelTag) {
        if (typeof modelTag !== 'string' || modelTag.trim() === '') {
            console.error(`TypeError: Expected 'modelTag' to be a non-empty string for scene '${this.#sceneName}'. Returning an empty array.`);
            return [];
        }
        return this.#models.getByTag(modelTag);
    }

    /**
     * Retrieves lights with the specified tag from the scene. 
     * @param {string} lightTag the tag associated with the lights
     * @returns {Array<Light>} an array of light objects
     */
    getLightsByTag(lightTag) {
        if (typeof lightTag !== 'string' || lightTag.trim() === '') {
            console.error(`TypeError: Expected 'lightTag' to be a non-empty string for scene '${this.#sceneName}'. Returning an empty array.`);
            return [];
        }
        return this.#lights.getByTag(lightTag);
    }

    /**
     * Retrieves the cameras with the specified tag from the scene. 
     * @param {string} cameraTag the tag associated with the camera
     * @returns {Array<Camera>} an array of camera instances
     */
    getCamerasByTag(cameraTag) {
        if (typeof cameraTag !== 'string' || cameraTag.trim() === '') {
            console.error(`TypeError: Expected 'cameraTag' to be a non-empty string for scene '${this.#sceneName}'. Returning an empty array.`);
            return [];
        }
        return this.#cameras.getByTag(cameraTag);
    }

    /**
     * Retrieves all models, lights and cameras that have the specified tag
     * @param {string} objectTag the tag associated with the objects
     * @returns {{'models': Array<Model>, 'lights': Array<Light>, 'cameras': Array<Camera>}} a javascript object of arrays
     */
    getObjectsByTag(objectTag) {
        if (typeof objectTag !== 'string' || objectTag.trim() === '') {
            console.error(`TypeError: Expected 'objectTag' to be a non-empty string for scene '${this.#sceneName}'. Returning empty arrays for each object.`);
            return {'models': [],'lights': [], 'cameras': []};
        }
        return {
            'models': this.getModelsByTag(objectTag),
            'lights': this.getLightsByTag(objectTag),
            'cameras': this.getCamerasByTag(objectTag)
        }
    }

    /// ------------ GET TAGS ------------ ///

    /**
     * Retrieves all tags associated with the given model from the scene. If no model is found, returns an empty array.
     * @param {string} modelName the name of the model with the associated tags
     * @returns {Array<string>} an array of strings
     */
    getModelTags(modelName) {
        if (typeof modelName !== 'string' || modelName.trim() === '') {
            console.error(`TypeError: Expected 'modelName' to be a non-empty string for scene '${this.#sceneName}'. Returning an empty array.`);
            return [];
        }
        return this.#models.getTagsOf(modelName);
    }

    /**
     * Retrieves all tags associated with the given light from the scene. If no light is found, returns an empty array.
     * @param {string} lightName the name of the light with the associated tags
     * @returns {Array<string>} an array of strings
     */
    getLightTags(lightName) {
        if (typeof lightName !== 'string' || lightName.trim() === '') {
            console.error(`TypeError: Expected 'lightName' to be a non-empty string for scene '${this.#sceneName}'. Returning an empty array.`);
            return [];
        }
        return this.#lights.getTagsOf(lightName);
    }

    /**
     * Retrieves all tags associated with the given camera from the scene. If no camera is found, returns an empty array.
     * @param {string} cameraName the name of the camera with the associated tags
     * @returns {Array<string>} an array of strings
     */
    getCameraTags(cameraName) {
        if (typeof cameraName !== 'string' || cameraName.trim() === '') {
            console.error(`TypeError: Expected 'cameraName' to be a non-empty string for scene '${this.#sceneName}'. Returning an empty array.`);
            return [];
        }
        return this.#cameras.getTagsOf(cameraName);
    }

    /// ------------ GET BY TYPE ------------ ///

    /**
     * Retrieves lights with the specified type from the scene. 
     * @param {string} lightType the light type
     * @returns {Array<Light>} an array of Light instances
     */
    getLightsByType(lightType) {
        if (typeof lightType !== 'string' || lightType.trim() === '') {
            console.error(`TypeError: Expected 'lightType' to be a non-empty string. Unable to get Light instances from scene '${this.#sceneName}'.`);
            return [];
        }
        if (!Light.isValidLightType(lightType)) {
            console.error(`ValueError: '${lightType}' is not a valid light type. Unable to get Light instances from scene '${this.#sceneName}'.`);
            return [];
        }
        if (!this.#lightsByType.has(lightType)) {
            console.warn(`ValueError: '${lightType}' has no known lights in scene '${this.#sceneName}'. Returning an empty array.`);
            return [];
        }

        // interate through lightnames with the given type and add to array
        let lights = [];
        for (const lightName of this.#lightsByType.get(lightType)) {
            lights.push(this.#lights.getByName(lightName));
        }
        return lights;
    }

    /**
     * Retrieves the camera with the specified type from the scene. 
     * @param {string} cameraType the camera type
     * @returns {Array<Camera>} an array of camera instances
     */
    getCamerasByType(cameraType) {
        if (typeof cameraType !== 'string' || cameraType.trim() === '') {
            console.error(`TypeError: Expected 'cameraType' to be a non-empty string. Unable to get Camera instances from scene '${this.#sceneName}'.`);
            return [];
        }
        if (!Camera.validCameraType(cameraType)) {
            console.error(`ValueError: ${cameraType} is not a valid camera type. Unable to get Camera instances from scene '${this.#sceneName}'.`);
            return [];
        }
        if (!this.#camerasByType.has(cameraType)) {
            console.warn(`ValueError: ${cameraType} has no known cameras. Unable to get Camera instances from scene '${this.#sceneName}'.`);
            return [];
        }

        // interate through camera names with the given type and add to array
        let cameras = [];
        for (const cameraName of this.#camerasByType.get(cameraType)) {
            cameras.push(this.#cameras.getByName(cameraName));
        }
        return cameras;
    }

    /// ------------ GET ALL ------------ ///

    /**
     * Retrieves all models in the scene, excluding renderable light instances.
     * @returns {Array<Model>} a flat array of all Model instances in the scene
     */
    getAllModels() {
        return this.#models.getAll();
    }

    /**
     * Retrieves all lights from the scene
     * @returns {Array<Light>} an array of all light instances
     */
    getAllLights() {
        return this.#lights.getAll();
    }

    /**
     * Retrieve all cameras in the scene
     * @returns {Array<Camera>} an array of camera instances
     */
    getAllCameras() {
        return this.#cameras.getAll();
    }

    /**
     * Retrieves all renderable objects from the scene, excluding lights where debug is not enabled.
     * @returns {{'models': Array<Model>, 'lights': Array<Light>}} A javascript object of arrays
     */
    getRenderables() {
        let debugLights = new Set();
        for (const light of this.#lights.getAll()) {
            // skip directional lights, as they can't be 'rendered' like other objects
            if (light.getType() === Light.DIRECTIONAL) continue;

            // add a light to be rendered if the the scene's or the light's debug mode is enabled.
            if (this.#debugMode || light.debugEnabled()) {
                debugLights.add(light);
            }
        }

        return {
            'models': Array.from(this.#models.getAll()),
            'lights': Array.from(debugLights)
        }
    }

    /**
     * Retrieves all objects from the scene.
     * @returns {{'models': Array<Model>, 'lights': Array<Light>, 'cameras': Array<Camera>}} A javascript object of arrays
     */
    getAll() {
        return {
            'models': Array.from(this.#models.getAll()),
            'lights': Array.from(this.#lights.getAll()),
            'cameras': Array.from(this.#cameras.getAll())
        }
    }

    /// ------------ REMOVE BY NAME ------------ ///

    /**
     * Removes the model with the given name from the scene, if it exists.
     * @param {string} modelName the name of the model
     * @param {boolean} [removeTags = true] flag to remove the model's associated tags if it was the last model to have them.
     * @returns {boolean} true if a model was removed, false otherwise
     */
    removeModelByName(modelName, removeTags = true) {
        if (typeof modelName !== 'string' || modelName.trim() === '') {
            console.error(`TypeError: Expected 'modelName' to be a non-empty string. Unable to remove Model instance from scene '${this.#sceneName}'.`);
            return false;
        }
        return this.#models.removeByName(modelName, removeTags);
    }

    /**
     * Removes the light with the given name from the scene, if it exists.
     * @param {string} lightName the name of the light
     * @param {boolean} [removeTags = true] flag to remove the light's associated tags if it was the last light to have them.
     * @returns {boolean} true if a light was removed, false otherwise
     */
    removeLightByName(lightName, removeTags = true) {
        if (typeof lightName !== 'string' || lightName.trim() === '') {
            console.error(`TypeError: Expected 'lightName' to be a non-empty string. Unable to remove Light instance from scene '${this.#sceneName}'.`);
            return false;
        }
        // no need to remove a light that isn't in the scene
        if (!this.#lights.contains(lightName)) return false;

        // remove light from lightsByType map
        const lightType = this.#lights.getbyName(lightName).getType();
        this.#lightsByType.get(lightType).delete(lightName);
        if (this.#lightsByType.get(lightType).size === 0) {
            this.#lightsByType.delete(lightType);
        }

        return this.#lights.removeByName(lightName, removeTags);
    }

    /**
     * Removes the specified camera from the scene, if it exists.
     * If the current active camera is the one to be removed, the scene switches to the default camera.
     * @param {string} cameraName the name of the camera
     * @param {boolean} [removeTags = true] flag to remove the camera's associated tags if it was the last camera to have them.
     * @returns {boolean} true if the camera was removed, false otherwise
     */
    removeCameraByName(cameraName, removeTags = true) {
        if (typeof cameraName !== 'string' || cameraName.trim() === '') {
            console.error(`TypeError: Expected 'cameraName' to be a non-empty string. Unable to remove Camera instance from scene '${this.#sceneName}'.`);
            return false;
        }
        // can't remove a camera that isn't in the scene
        if (!this.#cameras.contains(cameraName)) return false;
        const camera = this.#cameras.getByName(cameraName);

        // dont want the user to remove the default camera
        if (camera === this.#defaultCamera) {
            console.error(`ValueError: Removing the default Camera instance from scene '${this.#sceneName}' is forbidden. This is to ensure a camera is always active`);
            return false;
        }
        // the user removed the currently active camera, set the current camera to the default
        if (camera === this.#currentCamera) {
            this.#currentCamera = this.#defaultCamera;
        }

        // remove camera from type->camera map
        const cameraType = this.#cameras.getByName(cameraName).getType();
        this.#camerasByType.get(cameraType).delete(cameraName);
        if (this.#camerasByType.get(cameraType).size === 0) {
            this.#camerasByType.delete(cameraType);
        }

        return this.#cameras.removeByName(cameraName, removeTags);
    }

    /// ------------ REMOVE BY TAG ------------ ///

    /**
     * Removes all models with the specified tag from the scene, if they exist.
     * @param {string} modelTag the tag associated with the models
     * @returns {boolean} true if one or more models were removed, false otherwise
     */
    removeModelsByTag(modelTag) {
        if (typeof modelTag !== 'string' || modelTag.trim() === '') {
            console.error(`TypeError: Expected 'modelTag' to be a non-empty string. Unable to remove Model instances from scene '${this.#sceneName}'.`);
            return false;
        }
        return this.#models.removeByTag(modelTag);
    }

    /**
     * Removes all lights with the specified tag from the scene, if they exist.
     * @param {string} lightTag the tag associated with the lights
     * @returns {boolean} true if a light was removed, false otherwise
     */
    removeLightsByTag(lightTag) {
        if (typeof lightTag !== 'string' || lightTag.trim() === '') {
            console.error(`TypeError: Expected 'lightTag' to be a non-empty string. Unable to remove Light instances from scene '${this.#sceneName}'.`);
            return false;
        }
        
        // iterate though lights with the associated tag and remove them from the light->type map
        for (const lightName of this.#lights.getByTag(lightTag)) {
            // remove light from lightsByType map
            const lightType = this.#lights.getByName(lightName).getType();
            this.#lightsByType.get(lightType).delete(lightName);
            if (this.#lightsByType.get(lightType).size === 0) {
                this.#lightsByType.delete(lightType);
            }
        }

        return this.#lights.removeByTag(lightTag);
    }

    /**
     * Removes the cameras with the specfied tag from the scene, if it exists, except for the default camera.
     * If the current active camera is one of the cameras to be removed, the scene switches to the default camera.
     * @param {string} cameraTag the tag of the camera
     * @returns {boolean} true if one or more cameras were removed, false otherwise 
     */
    removeCamerasByTag(cameraTag) {
        if (typeof cameraTag !== 'string' || cameraTag.trim() === '') {
            console.error(`TypeError: Expected 'cameraTag' to be a non-empty string. Unable to remove Camera instances from scene '${this.#sceneName}'.`);
            return false;
        }
        // dont want the user to remove the default camera
        if (cameraTag === this.#defaultCameraTag) {
            console.error(`Error: Removing default Camera instance from scene '${this.#sceneName}' is forbidden. This is to ensure a camera is always active`);
            return false;
        }

        // iterate though cameras with the associated tag and remove them from the type->camera map
        for (const cameraName of this.#cameras.getNamesByTag(cameraTag)) {
            const camera = this.#cameras.getByName(cameraName);
            // if current camera was removed, set current camera to the default
            if (camera === this.#currentCamera) {
                this.#currentCamera = this.#defaultCamera;
            }

            // remove camera from type->camera map
            const cameraType = camera.getType();
            this.#camerasByType.get(cameraType).delete(cameraName);
            if (this.#camerasByType.get(cameraType).size === 0) {
                this.#camerasByType.delete(cameraType);
            }
        }

        return this.#cameras.removeByTag(cameraTag);
    }

    /// ------------ REMOVE TAG OF ------------ ///

    /**
     * Removes the tag from the specified model, if the model and tag exist. 
     * If this was the only tag on the model, automatically associates it with the 'base' tag
     * @param {string} modelName the name of the model
     * @param {string} modelTag the tag associated with the model
     * @returns {boolean} true if a model was removed, false otherwise
     */
    removeModelTag(modelName, modelTag) {
        if (typeof modelName !== 'string' || modelName.trim() === '') {
            console.error(`TypeError: Expected 'modelName' to be a string. Unable to remove tag.`);
            return false;
        }
        if (typeof modelTag !== 'string' || modelTag.trim() === '') {
            console.error(`TypeError: Expected 'modelTag' to be a string. Unable to remove tag from Model ${modelName} in scene '${this.#sceneName}'.`);
            return false;
        }
        return this.#models.removeTag(modelName, modelTag);
    }

    /**
     * Removes the tag from the specified light, if the light and tag exist. 
     * If this was the only tag on the light, automatically associates it with the 'base' tag
     * @param {string} lightName the name of the light
     * @param {string} lightTag the tag associated with the light
     * @returns {boolean} true if a light was removed, false otherwise
     */
    removeLightTag(lightName, lightTag) {
        if (typeof lightName !== 'string' || lightName.trim() === '') {
            console.error(`TypeError: Expected 'lightName' to be a non-empty string for scene '${this.#sceneName}'. Unable to remove tag.`);
            return false;
        }
        if (typeof lightTag !== 'string' || lightTag.trim() === '') {
            console.error(`TypeError: Expected 'lightTag' to be a non-empty string for scene '${this.#sceneName}'. Unable to remove tag from Light ${lightName}.`);
            return false;
        }
        return this.#lights.removeTag(lightName, lightTag);
    }

    /**
     * Removes the tag from the specified light, if the light and tag exist. 
     * If this was the only tag on the light, automatically associates it with the 'base' tag
     * @param {string} cameraName the name of the light
     * @param {string} cameraTag the tag associated with the light
     * @returns {boolean} true if a light was removed, false otherwise
     */
    removeCameraTag(cameraName, cameraTag) {
        if (typeof cameraName !== 'string' || cameraName.trim() === '') {
            console.error(`TypeError: Expected 'cameraName' to be a non-empty string for scene '${this.#sceneName}'. Unable to remove tag.`);
            return false;
        }
        if (typeof cameraTag !== 'string' || cameraTag.trim() === '') {
            console.error(`TypeError: Expected 'cameraTag' to be a non-empty string for scene '${this.#sceneName}'. Unable to remove tag from Camera ${cameraName}.`);
            return false;
        }
        if (cameraName === this.#defaultCameraName || cameraTag === this.#defaultCameraTag) {
            console.error(`ValueError: Removing the default camera from scene '${this.#sceneName}' is forbidden. This is to ensure a camera is always available. Unable to remove tag from Camera ${cameraName}.`);
            return false;
        }
        // cameraName and cameraTag are valid, safe to remove tag
        return this.#cameras.removeTag(cameraName, cameraTag);
    }

    /// ------------ REMOVE BY TYPE ------------ ///

    /**
     * Removes all lights with the specified type from the scene, if they exist.
     * @param {string} lightType the type associated with the lights
     * @param {boolean} [removeTags = true] flag to remove the light's associated tags if it was the last light to have them.
     * @returns {boolean} true if a light was removed, false otherwise
     */
    removeLightsByType(lightType, removeTags = true) {
        if (typeof lightType !== 'string' || lightType.trim() === '') {
            console.error(`TypeError: Expected 'lightType' to be a non-empty string. Unable to remove Light instances from scene '${this.#sceneName}'.`);
            return false;
        }
        // no need to remove a light that isn't in the scene
        if (!this.#lightsByType.has(lightType) || this.#lightsByType.get(lightType).size === 0) { 
            return false;
        }

        // Iterate through the light names that should be removed
        for (const lightName of this.#lightsByType.get(lightType)) {
            this.#lights.removeByName(lightName, removeTags);
        }
        this.#lightsByType.delete(lightType);
        return true;
    }

    /**
     * Removes the specified cameras with the given type from the scene, if they exist, except for the default camera.
     * If the current active camera is one of these cameras, the scene switches to the default camera.
     * @param {string} cameraType the name of the camera
     * @param {boolean} [removeTags = true] flag to remove the camera's associated tags if it was the last camera to have them.
     * @returns {boolean} true if one or more cameras were removed, false otherwise
     */
    removeCamerasByType(cameraType, removeTags = true) {
        if (typeof cameraType !== 'string' || cameraType.trim() === '') {
            console.error(`TypeError: Expected 'cameraType' to be a non-empty string. Unable to remove Camera instances from scene '${this.#sceneName}'.`);
            return false;
        }
        // no need to remove a camera that isn't in the scene
        if (!this.#camerasByType.has(cameraType) || this.#camerasByType.get(cameraType).size === 0) { 
            return false;
        }

        // Iterate through the light names that should be removed
        for (const cameraName of this.#camerasByType.get(cameraType)) {
            const camera = this.#cameras.getByName(cameraName);
            // skip the camera if it's the default
            if (camera === this.#defaultCamera) continue;
            // set the current camera to default if the current camera is removed
            if (camera === this.#currentCamera) {
                this.#currentCamera = this.#defaultCamera;
            }
            // remove the camera
            this.#cameras.removeByName(cameraName, removeTags);
        }
        // remove the camera type
        this.#camerasByType.delete(cameraType);
        return true;
    }

    /// ------------ REMOVE ALL ------------ ///

    /**
     * Resets the scene to default settings, and removes all model, light and camera instances (except for the default camera).
     */
    clearAndResetScene() {
        this.removeAll();
        this.reset();
    }

    /**
     * Removes all model, light and camera instances (except for the default camera), but does not reset scene.
     */
    removeAll() {
        // clear collections
        this.removeAllModels();
        this.removeAllLights();
        this.removeAllCameras();

        // clear type maps
        this.#lightsByType = new Map();
        this.#camerasByType = new Map();
    }

    /**
     * Removes all models from the scene.
     */
    removeAllModels() {
        this.#models.clear();
    }

    /**
     * Removes all lights from the scene.
     */
    removeAllLights() {
        this.#lights.clear();
    }

    /**
     * Removes all cameras from the scene, except for the default camera.
     */
    removeAllCameras() {
        this.#cameras.clear();
        // add default camera back in
        this.addCamera(this.#defaultCameraName, this.#defaultCamera, this.#defaultCameraTag);
    }

    /// ------------ CONTAINS ------------ ///

    /**
     * Checks if a model with the specified name exists in the scene.
     * @param {string} modelName the name associated with the model
     * @returns {boolean} true if the model was found, false otherwise
     */
    containsModel(modelName) {
        return this.#models.contains(modelName);
    }

    /**
     * Checks if a light with the specified name exists in the scene.
     * @param {string} lightName the name associated with the light
     * @returns {boolean} true if the light was found, false otherwise
     */
    containsLight(lightName) {
        return this.#lights.contains(lightName);
    }

    /**
     * Checks if a camera with the specified name exists in the scene.
     * @param {string} cameraName the name associated with the camera
     * @returns {boolean} true if the camera was found, false otherwise
     */
    containsCamera(cameraName) {
        return this.#cameras.contains(cameraName);
    }

    /**
     * Checks if a light with the specified type exists in the scene.
     * @param {string} lightName the light type
     * @returns {boolean} true if the light was found, false otherwise
     */
    containsLightType(lightType) {
        if (typeof lightType !== 'string') return false;
        return this.#lightsByType.has(lightType);
    }

    /**
     * Checks if a camera with the specified type exists in the scene.
     * @param {string} cameraType the camera type
     * @returns {boolean} true if the camera was found, false otherwise
     */
    containsCameraType(cameraType) {
        if (typeof cameraType !== 'string') return false;
        return this.#camerasByType.has(cameraType);
    }

    /**
     * Checks if any model, light or camera with the specified name exists in the scene.
     * @param {string} objectName the name associated with the object
     * @returns {boolean} true if the object was found, false otherwise
     */
    containsObject(objectName) {
        if (typeof objectName !== 'string') return false;
        return this.containsModel(objectName) || this.containsLight(objectName) || this.containsCamera(objectName);
    }
}
