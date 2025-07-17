class Material {
    static #ID_COUNTER = 0;
    // static registry of common properties. This allows for loose type checking
    static #propertyRegistry = new Map([
        // common scalar properties
        ['shininess', Number],
        ['roughness', Number],
        ['metallic', Number],
        ['alphaCutoff', Number],

        // common Color properties
        ['specularColor', Color],
    ]);

    // instance variables
    #contextName;           // the name of the WebGL context. Needed for textures
    #baseColor;             // the base color
    #properties;            // map of material properties
    #textures;              // map of material textures
    #materialID;

    /**
     * Create a new Material Instance
     * @param {string} contextName the name of the WebGL context. This is needed for consistency with attaching Textures
     * @param {Color} baseColor default color to fall back to if shaders fail. Also serves as the diffuse color in non-Textured Materials
     * @param {object} properties optional set of additional properties, like 'shininess' or 'roughness'. Do NOT place Texture instances here.
     */
    constructor(contextName, baseColor, properties={}) {
        this.#contextName = contextName;
        this.#materialID = Material.#ID_COUNTER++;
        
        let color;
        if (!(baseColor instanceof Color)) {
            console.warn("TypeError: Expected 'baseColor' to be an instance of Color. Assigning default color Color.WHITE.");
            color = Color.WHITE;
        } else { color = baseColor };
        this.#baseColor = color;

        this.#properties = new Map();
        Object.keys(properties).forEach(propName => {
            // map property name to property value
            this.setProperty(propName, properties[propName]);
        });

        // create texture map, initially empty
        this.#textures = new Map();
    }

    /**
     * Get the ID of this material
     * @returns {number} this material's id
     */
    getID() {
        return this.#materialID;
    }

    /**
     * Get the WebGL context name that this material was created with.
     * @returns {string} This material's webGL context's name
     */
    getGLContextName() {
        return this.#contextName;
    }

    /**
     * Set the base (diffuse) color for this Material
     * @param {Color} color the new base color
     * @returns {boolean} true if the base color was successfully set, false otherwise
     */
    setBaseColor(color) {
        if (!(color instanceof Color)) {
            console.warn(`TypeError: Expected 'color' to be an instance of Color. Cannot set baseColor of this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return false;
        }
        this.#baseColor = color;
        return true;
    }

    /**
     * Retrieve the current base color from this Material
     * @returns {Color} the base color
     */
    getBaseColor() {
        return this.#baseColor.clone();
    }

    /**
     * Add/set a property for this material.
     * @param {string} propertyName the name of the property
     * @param {any} value the value for this property. Must match the associated type, if the propertyName is a known property. 
     * 
     * Note: Cannot be a Texture instance, use attachTexture() to add Textures
     * @returns {boolean} true if the property was successfully set, false otherwise
     */
    setProperty(propertyName, value) {
        if (typeof propertyName !== 'string' || propertyName.trim() === '') {
            console.error(`TypeError: Expected 'propertyName' to be a non-empty string. Cannot set property of this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return false;
        }
        if (!(Material.validProperty(propertyName, value) || value instanceof Texture)) {
            console.warn(`ValueError: The provided value for 'value' does not match the expected type for '${propertyName}', or the value is of type Texture. Cannot set property of this material ID@${this.#materialID} (Context @${this.#contextName})`);
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
            console.error(`TypeError: Expected 'propertyName' to be a non-empty string. Cannot get property of this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return undefined;
        }
        if (!(this.#properties.has(propertyName))) {
            console.warn(`KeyError: '${propertyName}' is not a known property for this Material ID@${this.#materialID} (Context @${this.#contextName}). Cannot get property value.`);
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
        return true;
    }

    /**
     * Attach a new texture to this property. The type of texture (e.g Texture.Type.DIFFUSE) must not have already been attached.
     * @param {Texture.Type} type the type of texture to attach.
     * @param {Texture} texture the texture instance to attach.
     * @returns {boolean} true if the texture was successfully attached, false otherwise.
     */
    attachTexture(type, texture) {
        if (!(texture instanceof Texture)) {
            console.error(`TypeError: Expected 'texture' to be an instance of Texture. Cannot add texture to this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return false;
        }
        if (texture.getGLContextName() !== this.#contextName) {
            console.error(`ValueError: ${texture.getGLContextName()} does not match this material's WebGL context name ${this.#contextName}. Cannot attach texture to this material ID@${this.#materialID}.`);
            return false;
        }
        if (!(Object.values(Texture.Type).includes(type))) {
            console.error(`TypeError: Expected 'type' to be a known texture type (e.g Texture.Type.DIFFUSE). Cannot add texture to this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return false;
        }
        if (this.#textures.has(type)) {
            console.error(`ValueError: This material already has texture type ${type} attached. Cannot add texture to this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return false;
        }
        // all checks pass, attach texture to material
        this.#textures.set(type, texture);
        return true;
    }

    /**
     * Get this material's texture instance given the texture's type.
     * @param {Texture.Type} type the texture type
     * @returns {Texture | null} the texture instance, if it exists. (returns null otherwise).
     */
    getTexture(type) {
        if (!(Object.values(Texture.Type).includes(type))) {
            console.error(`TypeError: Expected 'type' to be a known texture type (e.g Texture.Type.DIFFUSE). Cannot retreive texture from this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return null;
        }
        if (!this.#textures.has(type)) {
            console.error(`ValueError: This material doesn't have texture type ${type} attached. Cannot retreive texture from this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return null;
        }
        return this.#textures.get(type);
    }

    /**
     * Detaches the texture matching the type if it exists, allowing for another to take it's place (if desired)
     * @param {Texture.Type} type the type of texture
     * @returns {boolean} true if the texture was successfully detached, false otherwise
     */
    detachTexture(type) {
        if (!(Object.values(Texture.Type).includes(type))) {
            console.error(`TypeError: Expected 'type' to be a known texture type (e.g Texture.Type.DIFFUSE). Cannot detach texture from this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return false;
        }
        if (!this.#textures.has(type)) {
            console.error(`ValueError: This material doesn't have texture type '${type}' attached. Cannot detach texture from this material ID@${this.#materialID} (Context @${this.#contextName})`);
            return false;
        }
        return this.#textures.delete(type);
    }


    /**
     * Get a list of property names and texture types in a javascript object.
     * @returns {{properties: Array<string>, textures: Array<string>}} the lists of properties and textures.
     */
    getCapabilities() {
        // get property names
        let propertyNames = Array.from(this.#properties.keys());
        propertyNames.push('baseColor'); // all materials have a base color

        // get texture types (if texture is valid)
        let validTextures = [];
        for (const [texType, texture] of this.#textures.entries()) {
            // only include the texture if it's valid (and loaded)
            if (texture.isValid()) validTextures.push(texType);
        }

        // create immutable object of properties and types
        return Object.freeze({ properties: propertyNames, textures: validTextures });
    }

    /**
     * Creates an exact replica of this Material, including Textures
     * @returns {Material} a copy of this Material
     */
    clone(contextName = null) {
        let glContextName;
        if (contextName === null) {
            glContextName = this.#contextName;
        } else if (!Graphics3D.getGLContext(contextName)) {
            console.warn("ValueError: Expected 'contextName' to be a non-empty string, refering to a valid WebGL context. Creating Texture in current context.");
            glContextName = this.#contextName;
        } else {
            glContextName = contextName;
        }

        // create object from properties map
        const properties = Object.fromEntries(this.#properties);

        // create a material copy
        const materialCopy = new Material(this.#contextName, this.#baseColor, properties);
        for (const [texType, texture] of this.#textures.entries()) {
            // copy texture over
            const textureCopy = texture.clone(glContextName);
            if (textureCopy === null) continue; // skip invalid textures

            // attach texture to material copy
            materialCopy.attachTexture(texType, textureCopy);
        }
        // return the new material instance
        return materialCopy;
    }

    /**
     * Clear the textures and properties with this Material, effectively resetting it.
     */
    dispose() {
        const texturesToRelease = Array.from(this.#textures.values());
        for (const texture of texturesToRelease) {
            const texturePath = texture.getTexturePath();
            const textureContext = texture.getGLContextName();
            Texture.release(textureContext, texturePath);
        }
        this.#textures.clear();
        this.#properties.clear();
    }

    /**
     * Apply this Material's properties and textures to the given Shader instance. 
     * 
     * NOTE: The shader program given must ALREADY be active. 
     * @param {Shader} shaderProgram the shader program istance to set the uniforms for
     * @param {boolean} renderTextures if the a mesh doesn't support textures, the material shouldn't attempt to pass them
     */
    applyToShader(shaderProgram, renderTextures) {
        if (!(shaderProgram instanceof Shader && shaderProgram.isActive())) {
            console.error(`TypeError: Expected 'shaderProgram' to be an active instance of Shader. Cannot set material uniforms ID@${this.#materialID}.`);
        }
        // from here on out, we know that the given shader program is already active.

        // materials always have a base color, but the shader might not
        // 'best fit' logic should provide loose matching with base color (i.e. if the shader supports diffuse maps, it doesn't need to support the base color)
        const baseColorUniform = 'material.diffuseColor';
        if (shaderProgram.hasUniform(baseColorUniform)) {
            shaderProgram.setColor(baseColorUniform, this.#baseColor);
        }

        // iterate through properties and set their uniforms
        for (const [propName, value] of this.#properties.entries()) {
            const uniformName = `material.${propName}`;
            // check to see if the shader has the uniform variable. This shouldn't happen with the best fit logic, but just in case.
            if (!shaderProgram.hasUniform(uniformName)) {
                console.warn(`ValueError: Expected '${propName}' to be a uniform name of ${shaderProgram.getName()}. Skipping this uniform for material ID@${this.#materialID}. `);
                continue;
            }
            this.#setUniform(shaderProgram, uniformName, value);
        }

        // skip setting texture uniforms if not allowed by mesh
        if (renderTextures) {
            // iterate through properties and set their uniforms
            let textureIndex = 0;
            for (const [texType, texture] of this.#textures.entries()) {
                // only set texture if the shader program supports it and the texture is valid.
                // these two things should be either both true or both false, but we need to be sure
                if (shaderProgram.supportsTexture(texType) && texture.isValid()) {
                    const texUniformName = `material.${texType}Map`; // uniform name formatted like 'material.diffuseMap'
                    texture.bind(textureIndex);
                    // WebGL uses the index to reference textures in GPU memory, so setInt is fine here
                    shaderProgram.setInt(texUniformName, textureIndex);
                    textureIndex++;
                }
            }
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
            // somehow differentiate between an int and a float? - this is fine for now
            shaderProgram.setFloat(uniformName, uniformValue);
        } else {
            // property is some weird type! Theoretically this shouldn't happen if we check if the shader program supports it, but gotta be sure
            console.warn(`Material: Skipping uniform for property '${uniformName}'. Value type '${typeof uniformValue}' not supported for automatic uniform setting.`);
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
     * @param {string} name the name of the property (e.g. 'baseColor')
     * @param {function | string} Type the expected type the property should have (e.g. Color, Matrix4...);
     * @returns {boolean} true if the property name and type were successfully added to the registry, false otherwise
     */
    static addKnownProperty(propertyName, Type) {
        if (typeof propertyName !== 'string' || propertyName.trim() === '') {
            console.error(`TypeError: Expected 'propertyName' to be a non-empty string. Cannot add property type to internal registry.`);
            return false;
        }
        Material.#propertyRegistry.set(propertyName, Type);
        return true;
    }
}