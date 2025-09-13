import ResourceCollector from "../utilities/containers/collector.js";
import Graphics3D from "../rendering/renderer.js";
import ShaderMapGenerator from "./shader-map-gen.js";

/**
 * Represents a fully compiled shader program
 */
export default class ShaderProgram {
    static #gl;
    static #ID_COUNTER = 0;

    // status variables
    #id;

    // shader configuration
    #name;
    #vertexSource;
    #fragmentSource;
    #config;

    // shader lookup maps
    #aliasMap;                  // maps uniform/attribute aliases to true names
    #dataMap;                   // maps true uniform names to data storage objects
    #capabilityMap;             // a filtered version of the alias map that doesn't include array types
    #capabilityList;            // list of standalone uniform names and uniform array types, used for best fit logic
    #locationConfigMap;         // temp map for location map generation after shader linking
    #locationMap;               // maps true uniform/attribute names to WebGL locations

    /**
     * Create a new ShaderProgram instance.
     * @param {string} shaderName the name of the shader. Must be unique amongst all known shader names (including those in the shader configs)
     * @param {string} vertexSource the vertex source string
     * @param {string} fragmentSource the fragment source string
     * @param {object} config an object containing the uniform, attribute and block definitions. See 'graphics/shading/configs/' for examples
     */
    constructor(shaderName, vertexSource, fragmentSource, config) {
        if (!ShaderProgram.#gl) {
            ShaderProgram.#gl = Graphics3D.getGLContext();
        }

        this.#id = ShaderProgram.#ID_COUNTER++;
        
        this.#name = shaderName;
        this.#vertexSource = vertexSource;
        this.#fragmentSource = fragmentSource;
        this.#config = config;

        const shaderMaps = ShaderMapGenerator.generate(config);
        this.#aliasMap = shaderMaps.aliasMap;
        this.#dataMap = shaderMaps.dataMap;
        this.#capabilityMap = shaderMaps.capabilityMap;
        this.#capabilityList = shaderMaps.capabilityList;
        this.#locationConfigMap = shaderMaps.locationConfigMap;

        this.#locationMap = new Map();
    }

    /**
     * Get the ID of the shader program instance (not the webgl program ID)
     */
    get ID() {
        return this.#id;
    }

    /**
     * Get the name of this shader
     */
    get name() {
        return this.#name
    }

    /**
     * Get the capabilities of this shader program as a map of property aliases to true names. Does not include array types.
     */
    get capabilityMap() {
        return this.#capabilityMap;
    }

    /**
     * Get a flat list of the true property names and array types that this shader supports
     */
    get trueCapabilities() {
        return this.#capabilityList;
    }

    /**
     * Get the webgl programID of this shader
     */
    get programID() {
        if (ResourceCollector.isLoaded(this.#name)) {
            return ResourceCollector.get(this.#name).programID;
        }
        return null;
    }

    /**
     * Get this shader's configuration object
     */
    get config() {
        return this.#config;
    }

    /**
     * Check if this shader has been built and loaded into gpu memory
     * @returns {boolean} true if the shader is built and ready to be used, false otherwise
     */
    get isReady() {
        return ResourceCollector.isLoaded(this.#name);
    }

    /**
     * Checks if this shader is in the process of being built
     * @returns {boolean} true if the shader is currently being built, false otherwise
     */
    get isBuilding() {
        return ResourceCollector.isLoading(this.#name);
    }

    /**
     * Check if this shader program is currently active.
     * @returns {boolean} true if this shader program is currently active, false otherwise
     */
    get isActive() {
        if (!this.isReady) return false;
        
        const gl = ShaderProgram.#gl;
        const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
        if (!currentProgram) return false;

        const shaderData = ResourceCollector.get(this.name);
        if (!shaderData) return false;

        return shaderData.programID === currentProgram;
    }

    /**
     * Mark this as the currently active program, allowing it to be used
     */
    use() {
        if (!this.isReady) return;

        ShaderProgram.#gl.useProgram(this.programID);
    }

    /**
     * Mark this program as inactive.
     */
    unuse() {
        ShaderProgram.#gl.useProgram(null);
    }

    /**
     * get the location of a vertex attribute
     * @param {string} attributeName the name of the attribute
     * @returns {number} the location of the given attribute
     */
    getAttributeLocation(attributeName) {
        if (this.#locationMap.has(attributeName)) {
            return this.#locationMap.get(attributeName);
        } else {
            console.error(`[ShaderProgram @${this.#name}] Expected 'attributeName' to be a vertex attribute supported by this shader. Cannot get attribute location.`)
            return undefined;
        }
    }

    /**
     * Set the value of a uniform (does not include textures)
     * @param {string} uniformName the name of the uniform
     * @param {object} uniformData the value to store. Must match the data type specified in the config
     * @param {number} index if the uniform is stored in array, the index can be used to access which element it is
     */
    setUniform(uniformName, uniformData) {
        if (!this.isActive) {
            console.error(`[ShaderProgram @${this.#name}] Cannot set uniform '${uniformName}' for this program as it is currently inactive.`)
        }

        if (this.#aliasMap.has(uniformName)) {
            const trueName = this.#aliasMap.get(uniformName).trueName;
            const uniformInfo = this.#dataMap.get(trueName);
            uniformInfo.value = uniformData;
            uniformInfo.isDirty = true;
        } else {
            console.error(`[ShaderProgram @${this.#name}] Expected uniform '${uniformName}' to be supported by this shader. Cannot set uniform.`)
        }
    }

    /**
     * Send any pending uniform data to the shader program. Should be called every frame.
     */
    flush() {
        if (!this.isActive) {
            console.error(`[ShaderProgram @${this.#name}] Cannot flush uniforms for this program as it is currently inactive.`);
            return;
        }

        let textureBindUnit = 0;
        const gl = ShaderProgram.#gl;
        for (const [name, uniformInfo] of this.#dataMap) {
            const trueName = this.#aliasMap.get(name).trueName;
            const location = this.#locationMap.get(trueName);

            // separate logic for sampler types
            if (uniformInfo.type === 'sampler2D' || uniformInfo.type === 'sampler3D') {
                if (uniformInfo.isDirty) {
                    const glTextureType = uniformInfo.type === 'sampler2D' ? gl.TEXTURE_2D : gl.TEXTURE_3D;

                    gl.activeTexture(gl.TEXTURE0 + textureBindUnit);
                    gl.bindTexture(glTextureType, uniformInfo.value);
                    gl.unform1i(location, textureBindUnit);

                    uniformInfo.isDirty = false;
                }
                // always incremement bind unit to ensure textures are set consistently between flush calls
                textureBindUnit++;
                continue;
            }

            // skip the uniform if it's not dirty
            if (!uniformInfo.isDirty) continue;

            switch (uniformInfo.type) {
                case 'vec2': gl.uniform2fv(location, uniformInfo.value.asList()); break;
                case 'vec3': gl.uniform3fv(location, uniformInfo.value.asList()); break;
                case 'vec4': gl.uniform4fv(location, uniformInfo.value.asList()); break;
                case 'mat2': gl.uniformMatrix2fv(location, false, uniformInfo.value.transpose().asList()); break;
                case 'mat3': gl.uniformMatrix3fv(location, false, uniformInfo.value.transpose().asList()); break;
                case 'mat4': gl.uniformMatrix4fv(location, false, uniformInfo.value.transpose().asList()); break;
                case 'int': gl.uniform1i(location, uniformInfo.value); break;
                case 'float': gl.uniform1f(location, uniformInfo.value); break;
                case 'bool': gl.uniform1i(location, uniformInfo.value); break;
                default: console.warn(`[Shader @${this.#name}]: Cannot apply uniform '${name}' to shader. Value type '${uniformInfo.type}' not supported.`);
            }

            uniformInfo.isDirty = false;
        }
        
        // set the bound texture to null to refresh for next flush() call
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Compile and link this shader program, allowing it to be used.
     * @returns {WebGLProgram | null} the shader program ID if construction is successful, otherwise null is returned
     */
    async build() {
        if (this.isReady) return this.programID;

        if (ResourceCollector.contains(this.#name)) {
            const shaderInfo = await ResourceCollector.getWhenLoaded(
                this.#name, 
                { pollTimeout: 3, pollInterval: 0.2 }
            );
            if (shaderInfo === null) {
                console.error(`[ShaderProgram @${this.#name}] Load of shader program timed out before retreival or failed to link in a separate thread. Cannot build program.`);
                return null;
            }

            this.#generateLocationMap();
            return shaderInfo.programID;
        }

        try {
            const shaderInfo = await ResourceCollector.load(this.#name, this.#buildFromSources.bind(this));
            console.log(`[ShaderProgram @${this.#name}] Compiled and linked shader successfully.`);

            this.#generateLocationMap();

            console.log('Shader Name:', this.#name);
            console.log('AliasMap:', this.#aliasMap);
            console.log('DataMap:', this.#dataMap);
            console.log('LocationConfigMap:', this.#locationConfigMap);
            console.log('LocationMap:', this.#locationMap);
            
            return shaderInfo.programID;
        } catch (error) {
            console.error(`[ShaderProgram @${this.#name}] An error occurred during shader compilation:\n${error}`);
            return null;
        }
    }

    /** builds the shader program once the source files are loaded */
    async #buildFromSources(shaderName) {
        const gl = ShaderProgram.#gl;

        let shaderProgram = null;
        try {
            const vertexShader = this.#compileShader(shaderName, this.#vertexSource, gl.VERTEX_SHADER);
            const fragmentShader = this.#compileShader(shaderName, this.#fragmentSource, gl.FRAGMENT_SHADER);
            shaderProgram = this.#linkShaders(shaderName, vertexShader, fragmentShader); 
            
            // once program is linked, we don't need the individual shaders anymore
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);

            // this is stored in the ResourceCollector cache
            return {
                shaderName: shaderName,
                programID: shaderProgram
            }
        } catch (error) {
            if (gl.isProgram(shaderProgram)) {
                gl.deleteProgram(shaderProgram);
            }
            throw error;
        }
    }

    //** compiles a shader program */
    #compileShader(shaderName, sourceString, shaderType) {
        const gl = ShaderProgram.#gl;

        const shaderObject = gl.createShader(shaderType);
        gl.shaderSource(shaderObject, sourceString);
        gl.compileShader(shaderObject);

        const compileSuccess = gl.getShaderParameter(shaderObject, gl.COMPILE_STATUS);
        if (!compileSuccess) {
            const infoLog = gl.getShaderInfoLog(shaderObject);
            const shaderTypeName = shaderType === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
            console.error(`[ShaderProgram @${shaderName}] Failed to compile ${shaderTypeName} shader: ${infoLog}`);
        }
        return shaderObject;
    }

    /** links the vertex and fragment shader programs */
    #linkShaders(shaderName, vertexShader, fragmentShader) {
        const gl = ShaderProgram.#gl;

        const programID = gl.createProgram();
        gl.attachShader(programID, vertexShader);
        gl.attachShader(programID, fragmentShader);
        gl.linkProgram(programID);

        const linkSuccess = gl.getProgramParameter(programID, gl.LINK_STATUS);
        if (!linkSuccess) {
            const infoLog = gl.getProgramInfoLog(programID);
            console.error(`[ShaderProgram @${shaderName}] Failed to link shader program: ${infoLog}`);
        }

        return programID;
    }

    #generateLocationMap() {
        for (const propertyInfo of this.#aliasMap.values()) {
            let location;
            if (this.#locationConfigMap.has(propertyInfo.trueName)) {
                location = this.#locationConfigMap.get(propertyInfo.trueName);
            } else if (propertyInfo.isAttr) {
                location = ShaderProgram.#gl.getAttribLocation(this.programID, propertyInfo.trueName);
            } else {
                location = ShaderProgram.#gl.getUniformLocation(this.programID, propertyInfo.trueName);
            }
            this.#locationMap.set(propertyInfo.trueName, location);
        }
    }
}
