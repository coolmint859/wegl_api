import { Vector2, Vector3, Vector4 } from "../../utilities/math/vector.js";
import { Matrix2, Matrix3, Matrix4 } from "../../utilities/math/matrix.js";
import Texture from "./texture.js";
import Shader from "../shading/shader.js";
import Color from "../../utilities/containers/color.js";
import EventScheduler from "../../utilities/scheduler.js";

/**
 * Used to give renderable objects a 'look', with optional textures. Capable of being used by multiple consumers.
 * 
 * @interface Proxy - classes that implement this are proxies to underlying resources, typically managed by ResourceCollector
 * @method acquire - acquire the underlying resource for use - returns a promise
 * @method release - release the underlying resource from use
 * @method reload - reload the underlying resource - returns a promise
 * @method snapshot - get a snapshot of the metadata associated with the underlying resource
 */
export default class Material {
    static #ID_COUNTER = 0;
    static #defaultColor = Color.WHITE;
    static #defaultColorName = 'diffuseColor';
    #refCount // materials can be shared, so we need to track how many

    // static registry of common properties. This allows for loose type checking
    static #propertyRegistry = new Map([
        // common scalar properties
        ['shininess', 'number'],
        ['roughness', 'number'],
        ['metallic', 'number'],
        ['alphaCutoff', 'number'],

        // common Color properties
        ['specularColor', Color],
        ['diffuseColor', Color],
    ]);

    // instance variables
    #properties;            // map of material properties
    #textures;              // map of material textures
    #materialID;

    /**
     * Create a new Material Instance
     * @param {object} properties optional set of properties, like 'shininess' or 'roughness'. Do NOT place Texture instances here.
     */
    constructor(properties={}) {
        this.#materialID = Material.#ID_COUNTER++;
        this.#refCount = 0; // a material is only 'used' when it attached to a renderable object (like a mesh)

        this.#properties = new Map();
        Object.keys(properties).forEach(propName => {
            this.setProperty(propName, properties[propName]);
        });

        if (!this.#properties.has(Material.#defaultColorName)) {
            this.#properties.set(Material.#defaultColorName, Material.#defaultColor);
        }

        // create texture map, initially empty
        this.#textures = new Map();
    }

    /**
     * Get the ID of this material
     * @returns {number} this material's id
     */
    get id() {
        return this.#materialID;
    }

    acquire() {
        // cancel releases of textures if the ref count was 0
        if (this.#refCount === 0 && this.#textures.size !== 0) {
            for (const texType of this.#textures.keys()) {
                EventScheduler.cancel(texType);
            }
        }
        this.#refCount++;
    }

    release() {
        this.#refCount--;
        if (this.#refCount === 0) {
            console.log(`[Material ID#${this.#materialID}] No more consumers using this material, scheduling textures for release.`)
            EventScheduler.schedule('texRelease', 1, this.#releaseTextures.bind(this));
        }
    }

    /**
     * Check if all currently attached textures have loaded into GPU memory.
     * @returns {boolean} true if all textures have loaded, false otherwise
     */
    allTexturesLoaded() {
        let texturesLoaded = true;
        for (const texture of this.#textures.values()) {
            if (!texture.loadSuccess()) texturesLoaded = false;
        }
        return texturesLoaded;
    }

    /**
     * Add/set a property for this material.
     * @param {string} propertyName the name of the property
     * @param {any} value the value for this property. Must match the associated type.
     * 
     * Note: Cannot be a Texture instance, use attachTexture() to add Textures
     * @returns {boolean} true if the property was successfully set, false otherwise
     */
    setProperty(propertyName, value) {
        if (typeof propertyName !== 'string' || propertyName.trim() === '') {
            console.error(`[Material ID#${this.#materialID}] TypeError: Expected 'propertyName' to be a non-empty string. Cannot set property of this material.`);
            return false;
        }
        if (!Material.validProperty(propertyName, value) || value instanceof Texture) {
            console.warn(`[Material ID#${this.#materialID}] ValueError: The provided value for 'value' does not match the expected type for '${propertyName}', or the value is of type Texture. Cannot set property of this material.`);
            return false;
        }
        this.#properties.set(propertyName, value);
        return true;
    }
    
    /**
     * Get a property associated with this Material, if it exists
     * @param {string} propertyName 
     * @returns {any | undefined} the property instance associated with the type, if it exists (returns undefined otherwise)
     */
    getProperty(propertyName) {
        if (typeof propertyName !== 'string' || propertyName.trim() === '') {
            console.error(`[Material ID#${this.#materialID}] TypeError: Expected 'propertyName' to be a non-empty string. Cannot get property of this material.`);
            return undefined;
        }
        if (!(this.#properties.has(propertyName))) {
            console.warn(`[Material ID#${this.#materialID}] KeyError: '${propertyName}' is not a known property for this material. Cannot get property value.`);
            return undefined;
        }
        return this.#properties.get(propertyName);
    }

    /**
     * Check if the given property is a member of this Material
     * @param {string} propertyName the name of the property
     * @returns {boolean} true if this material has a property with the given name, false otherwise
     */
    hasProperty(propertyName) {
        if (typeof propertyName !== 'string' || propertyName.trim() === '') {
            return false;
        }
        return this.#properties.has(propertyName);
    }

    /**
     * removes the given property from the Material, if the property exists
     * @param {string} propertyName the name of the property
     * @returns {boolean} true if the property was successfully removed, false otherwise
     */
    removeProperty(propertyName) {
        if (typeof propertyName !== 'string' || propertyName.trim() === '') {
            return false;
        }
        this.#properties.delete(propertyName);

        // add back in defualt color if it was removed
        if (!this.#properties.has(Material.#defaultColorName)) {
            console.warn(`[Material ID#${this.#materialID}]: Default color '${Material.#defaultColorName}' was removed. Applying default color ${Material.#defaultColor.str()}`);
            this.#properties.set(Material.#defaultColorName, Material.#defaultColor);
        }
        return true;
    }

    /**
     * Attach a new texture to this property. The type of texture (e.g Texture.Type.DIFFUSE) must not have already been attached.
     * @param {Texture.Type} type the type of texture to attach.
     * @param {Texture} texture the texture instance to attach.
     * @returns {boolean} true if the texture was successfully attached, false otherwise.
     */
    attachTexture(texture, type) {
        if (!(texture instanceof Texture)) {
            console.error(`[Material ID#${this.#materialID}] TypeError: Expected 'texture' to be an instance of Texture. Cannot add texture to this material.`);
            return false;
        }
        if (!(Object.values(Texture.Type).includes(type))) {
            console.error(`[Material ID#${this.#materialID}] TypeError: Expected 'type' to be a known texture type (e.g Texture.Type.DIFFUSE). Cannot add texture to this material.`);
            return false;
        }
        if (this.#textures.has(type)) {
            console.error(`[Material ID#${this.#materialID}] ValueError: This material already has texture type ${type} attached. Cannot add texture to this material.`);
            return false;
        }
        // all checks pass, attach texture to material
        try {
            texture.acquire();
            this.#textures.set(type, texture);
            console.log(`[Material ID#${this.#materialID}] Attached texture '${texture.assignedImage}' as ${type}.`);
            return true;
        } catch (error) {
            console.error(`[Material ID#${this.#materialID}] An error occured while attempting to attach material: ${error}`);
            return false;
        }
    }

    /**
     * Get this material's texture instance given the texture's type.
     * @param {Texture.Type} type the texture type 
     * @returns {Texture | null} the texture instance, if it exists. (returns null otherwise).
     */
    getTexture(type) {
        if (!(Object.values(Texture.Type).includes(type))) {
            console.error(`[Material ID#${this.#materialID}] TypeError: Expected 'type' to be a known texture type (e.g Texture.Type.DIFFUSE). Cannot retreive texture from this material.`);
            return null;
        }
        if (!this.#textures.has(type)) {
            console.error(`[Material ID#${this.#materialID}] ValueError: This material doesn't have texture type ${type} attached. Cannot retreive texture from this material.`);
            return null;
        }
        return this.#textures.get(type);
    }

    /**
     * Check if this Material currently has the provided texture type attached to it.
     * @param {Texture.Type} type the texture type
     * @returns {boolean} true if this material has a texture of the given type, false otherwise
     */
    hasTexture(type) {
        return this.#textures.has(type);
    }

    /**
     * Detaches the texture matching the type if it exists, allowing for another to take it's place (if desired)
     * @param {Texture.Type} type the type of texture
     * @returns {boolean} true if the texture was successfully detached, false otherwise
     */
    detachTexture(type) {
        if (!(Object.values(Texture.Type).includes(type))) {
            console.error(`[Material ID#${this.#materialID}] TypeError: Expected 'type' to be a known texture type (e.g Texture.Type.DIFFUSE). Cannot detach texture from this material.`);
            return false;
        }
        if (!this.#textures.has(type)) {
            console.error(`[Material ID#${this.#materialID}] ValueError: This material doesn't have texture type '${type}' attached. Cannot detach texture from this material.`);
            return false;
        }
        this.#textures.get(type).release();
        return this.#textures.delete(type);
    }

    /**
     * Retrieve a list of property names and texture types
     * @returns {Array<string>} a list of property names and texture types.
     */
    getCapabilities() {
        // get property names
        let capabilities = Array.from(this.#properties.keys());

        // get texture types (if texture is valid)
        for (const [texType, texture] of this.#textures.entries()) {
            // only include the texture if it's valid (and loaded)
            if (texture.loadSuccess()) capabilities.push(texType);
        }

        return capabilities.sort();
    }

    /**
     * Creates an exact replica of this Material, including Textures
     * @returns {Material} a copy of this Material
     */
    clone() {
        // create object from properties map
        const properties = Object.fromEntries(this.#properties);

        // create a material copy
        const materialCopy = new Material(properties);
        for (const [texType, texture] of this.#textures.entries()) {
            // copy texture over
            const textureCopy = texture.clone();
            if (textureCopy === null) continue; // skip invalid textures

            // attach texture to material copy
            materialCopy.attachTexture(texType, textureCopy);
        }
        // return the new material instance
        return materialCopy;
    }

    /**
     * Clear the textures and properties with this Material, effectively resetting it.
     * @returns {boolean} true if the textures and properties were successfully disposed, false otherwise
     */
    dispose() {
        let allTexturesDisposed = true;
        const texturesToRelease = Array.from(this.#textures.values());
        for (const texture of texturesToRelease) {
            if (!texture.release()) allTexturesDisposed = false;
        }
        this.#textures.clear();
        this.#properties.clear();

        return allTexturesDisposed;
    }

    /**
     * Apply this Material's properties and textures to the given Shader instance. 
     * 
     * NOTE: The shader program given must ALREADY be active. 
     * @param {Shader} shaderProgram the shader program instance to set the uniforms for
     * @param {boolean} renderTextures if the a mesh doesn't support textures, the material shouldn't attempt to pass them
     */
    applyToShader(shaderProgram, renderTextures) {
        if (!(shaderProgram instanceof Shader && shaderProgram.isActive())) {
            console.error(`[Material ID#${this.#materialID}] TypeError: Expected 'shaderProgram' to be an active instance of Shader. Cannot set material uniforms.`);
            return;
        }
        // iterate through properties and set their uniforms
        for (const [propName, value] of this.#properties.entries()) {
            const uniformName = `material.${propName}`;
            // check to see if the shader has the uniform variable. This shouldn't happen with the best fit logic, but just in case.
            if (!shaderProgram.supports(uniformName)) {
                console.warn(`[Material ID#${this.#materialID}] ValueError: Expected '${uniformName}' to be a uniform name of ${shaderProgram.getName()}. Skipping this uniform for material.`);
                continue;
            }
            this.#setUniform(shaderProgram, uniformName, value);
        }

        // only set texture uniforms if allowed by mesh
        if (renderTextures) {
            let textureIndex = 0;
            for (const [texType, texture] of this.#textures.entries()) {
                // only set texture if the shader program supports it and the texture is valid.
                // these two things should be either both true or both false, but we need to be sure
                if (shaderProgram.supports(texType) && texture.isLoaded) {
                    // console.log(`[Material ID#${this.#materialID}] Applying texture ${texture.getActiveTexture()} as ${texType}`);
                    const texUniformName = `material.${texType}Map`; // uniform name formatted like 'material.diffuseMap'
                    texture.bind(textureIndex);

                    shaderProgram.setInt(texUniformName, textureIndex);
                    textureIndex++;
                }
            }
        }
    }

    /**
     * Goes through this material's textures and unbinds them from GPU memory
     */
    unbindTextures() {
        let textureIndex = 0;
        for (const texture of this.#textures.values()) {
            texture.unbind(textureIndex);
            textureIndex++;
        }
    }

    /** using the shader program, apply the value to the uniform name in the shader */
    #setUniform(shaderProgram, uniformName, uniformValue) {
        // no other easy way to do this other than guess and check
        if (uniformValue instanceof Vector2) {
            shaderProgram.setVector2(uniformName, uniformValue);
        } else if (uniformValue instanceof Vector3) {
            shaderProgram.setVector3(uniformName, uniformValue);
        } else if (uniformValue instanceof Vector4) {
            shaderProgram.setVector4(uniformName, uniformValue);
        } else if (uniformValue instanceof Matrix2) {
            shaderProgram.setMatrix2(uniformName, uniformValue);
        } else if (uniformValue instanceof Matrix3) {
            shaderProgram.setMatrix3(uniformName, uniformValue);
        } else if (uniformValue instanceof Matrix4) {
            shaderProgram.setMatrix4(uniformName, uniformValue);
        } else if (uniformValue instanceof Color) {
            shaderProgram.setColor(uniformName, uniformValue);
        // check if boolean first, then if number
        } else if (typeof uniformValue === 'boolean') {
            shaderProgram.setBool(uniformName, uniformValue);
        } else if (typeof uniformValue === 'number') {
            shaderProgram.setFloat(uniformName, uniformValue);
        } else {
            // property is some weird type! Theoretically this shouldn't happen if we check if the shader program supports it, but gotta be sure
            console.warn(`[Material ID#${this.#materialID}]: Skipping uniform for property '${uniformName}'. Value type '${typeof uniformValue}' not supported for automatic uniform setting.`);
        }
    }

    #releaseTextures() {
        for (const texture of this.#textures) {
            texture.release();
        }
    }

    /**
     * Loose Material property type validation - allows for type checking if desired. Assumes unknown types are valid.
     * @param {string} name the name of the property
     * @param {any} value the value of the type (can be anything, like a primitive or a class)
     * @returns {boolean} true if the value matches the type in the registry, or the name isn't in the registry. False otherwise.
     */
    static validProperty(name, value) {
        if (Material.#propertyRegistry.has(name)) {
            const ExpectedType = Material.#propertyRegistry.get(name);
            // first case - the expected property type is a primitive (like 'number', 'string', 'boolean', etc...)
            if (typeof ExpectedType === 'string') {
                return typeof value === ExpectedType;
            // second case - the expected property type is a constructor function for a class
            } else if (typeof ExpectedType === 'function') {
                return value instanceof ExpectedType;
            }
            // third case - type in the registry is not well-defined. Return false for safe measure.
            return false;
        }
        // if the registry does't have the type at all, return true (allows for arbitrary properties)
        return true;
    }

    /**
     * Add a known Material property type to a registy
     * @param {string} name the name of the property (e.g. 'diffuseColor')
     * @param {function | string} Type the expected type the property should have (e.g. Color, Matrix4...);
     * @returns {boolean} true if the property name and type were successfully added to the registry, false otherwise
     */
    static addKnownProperty(propertyName, Type) {
        if (typeof propertyName !== 'string' || propertyName.trim() === '') {
            console.error(`[Material] TypeError: Expected 'propertyName' to be a non-empty string. Cannot add property type to internal registry.`);
            return false;
        }
        Material.#propertyRegistry.set(propertyName, Type);
        return true;
    }
}