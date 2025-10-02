import { ResourceCollector } from "../../utilities/index.js";
import { ShaderHandler } from "../../handlers/index.js";
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
    #dataMap;                   // maps true uniform/attribute names to data storage objects
    #capabilityMap;             // a filtered version of the alias map that doesn't include array types
    #capabilityList;            // list of standalone uniform names and uniform array types, used for best fit logic
    #dirtyUniforms;             // maps true uniform names to uniforms whose values have changed
    #textureBindUnit;           // keeps track of the number of textures bound for a given flush call

    /**
     * Create a new ShaderProgram instance.
     * @param {string} shaderName the name of the shader. Must be unique amongst all known shader names (including those in the shader configs)
     * @param {string} vertexSource the vertex source string
     * @param {string} fragmentSource the fragment source string
     * @param {object} config an object containing the uniform, attribute and block definitions. See 'graphics/shading/configs/' for examples
     */
    constructor(shaderName, vertexSource, fragmentSource, config) {
        if (!ShaderProgram.#gl) {
            ShaderProgram.#gl = ShaderHandler.glContext;
        }

        this.#id = ShaderProgram.#ID_COUNTER++;
        
        this.#name = shaderName;
        this.#vertexSource = vertexSource;
        this.#fragmentSource = fragmentSource;
        this.#config = config;

        const { aliasMap, dataMap, capabilityMap } = ShaderMapGenerator.generate(config);
        this.#aliasMap = aliasMap;
        this.#dataMap = dataMap;
        this.#capabilityMap = capabilityMap;
        this.#capabilityList = Array.from(new Set(this.#capabilityMap.values()));

        this.#dirtyUniforms = new Map();
        this.#textureBindUnit = 0;
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
     * Check if this shader supports the given property (uniform/attribute)
     * @param {string} propertyName the name of the property
     * @returns {boolean} true if this shader supports the property, false otherwise
     */
    supports(propertyName) {
        return this.#aliasMap.has(propertyName);
    }

    /**
     * get the location of a vertex attribute
     * @param {string} attributeName the name of the attribute
     * @returns {number} the location of the given attribute
     */
    getAttributeLocation(attributeName) {
        if (this.#aliasMap.has(attributeName)) {
            const trueName = this.#aliasMap.get(attributeName);
            return this.#dataMap.get(trueName).location;
        } else {
            console.error(`[ShaderProgram @${this.#name}] Expected '${attributeName}' to be a vertex attribute supported by this shader. Cannot get attribute location.`)
            return undefined;
        }
    }

    /**
     * Set the value of a uniform (Does not include textures)
     * @param {string} name the name of the uniform. Must be the full name or a known alias of such.
     * @param {any} newValue the value to store. Must match the data type specified in the config
     */
    setUniform(name, newValue) {
        if (!this.isActive) {
            console.error(`[ShaderProgram @${this.#name}] Cannot set uniform '${name}' for this program as it is currently inactive.`)
        }
        if (this.#aliasMap.has(name)) {
            const trueName = this.#aliasMap.get(name);
            const uniform = this.#dataMap.get(trueName);

            if (['float', 'int', 'bool'].includes(uniform.type)) {
                if (uniform.value !== newValue) {
                    uniform.value = newValue;
                    this.#dirtyUniforms.set(trueName, uniform);
                }
            } else if (!uniform.value.equals(newValue)) {
                uniform.value = newValue;
                this.#dirtyUniforms.set(trueName, uniform);
            }
        } else {
            console.error(`[ShaderProgram @${this.#name}] Expected uniform '${name}' to be supported by this shader. Cannot set uniform.`)
        }
    }

    /**
     * Send a texture for a texture sampler to this shader
     * @param {string} name the name of the sampler uniform. Must be the full name or a known alias of such.
     * @param {any} texture the texture instance to send
     */
    setSampler(name, texture) {
        if (!this.isActive) {
            console.error(`[ShaderProgram @${this.#name}] Cannot set uniform '${name}' for this program as it is currently inactive.`)
        }
        if (!(texture instanceof WebGLTexture)) {
            console.error(`[ShaderProgram @${this.#name}] Expected 'texture' to be an instance of WebGLTexture. Cannot bind texture data.`);
            return;
        }

        if (this.#aliasMap.has(name)) {
            const trueName = this.#aliasMap.get(name);
            const uniform = this.#dataMap.get(trueName);

            if (uniform.type !== 'sampler2D' && uniform.type !== 'sampler3D') {
                console.error(`[ShaderProgram @${this.#name}] Uniform '${name}' has type '${uniform.type}', but needs to be of type 'sampler2D' or 'sampler3D'. Cannot bind texture data.`);
                return;
            }

            const gl = ShaderProgram.#gl;
            const glTextureType = uniform.type === 'sampler2D' ? gl.TEXTURE_2D : gl.TEXTURE_3D;

            gl.activeTexture(gl.TEXTURE0 + this.#textureBindUnit);
            gl.bindTexture(glTextureType, texture);
            gl.uniform1i(uniform.location, this.#textureBindUnit);

            this.#textureBindUnit++; // this will get reset to 0 when reset() is called.
        } else {
            console.error(`[ShaderProgram @${this.#name}] Expected sampler uniform '${name}' to be supported by this shader. Cannot set uniform.`)
        }
    }

    /**
     * Send any pending uniform data to the shader program. Designed to be called every frame.
     */
    flush() {
        if (!this.isActive) {
            console.error(`[ShaderProgram @${this.#name}] Cannot flush uniforms for this program as it is currently inactive.`);
            return;
        }

        const gl = ShaderProgram.#gl;
        for (const [name, uniform] of this.#dirtyUniforms) {
            if (uniform.type === 'sampler2D' || uniform.type === 'sampler3D') {
                continue;
            }

            switch (uniform.type) {
                case 'vec2':  gl.uniform2fv(uniform.location, uniform.value.asList()); break;
                case 'vec3':  gl.uniform3fv(uniform.location, uniform.value.asList()); break;
                case 'vec4':  gl.uniform4fv(uniform.location, uniform.value.asList()); break;
                case 'mat2':  gl.uniformMatrix2fv(uniform.location, false, uniform.value.transpose().asList()); break;
                case 'mat3':  gl.uniformMatrix3fv(uniform.location, false, uniform.value.transpose().asList()); break;
                case 'mat4':  gl.uniformMatrix4fv(uniform.location, false, uniform.value.transpose().asList()); break;
                case 'float': gl.uniform1f(uniform.location, uniform.value); break;
                case 'int':
                case 'bool':  gl.uniform1i(uniform.location, uniform.value); break;
                default: console.warn(`[Shader @${this.#name}]: Cannot apply uniform '${name}' to shader. Value type '${uniform.type}' not supported.`);
            }
        }
    }

    /**
     * Cleanup the shader state, preparing it for the next use.
     */
    reset() {
        const gl = ShaderProgram.#gl;
        for (let i = 0; i < this.#textureBindUnit; i++) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindTexture(gl.TEXTURE_3D, null);
        }
        this.#textureBindUnit = 0;
        this.#dirtyUniforms.clear();
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
            const shaderInfo = await ResourceCollector.load(
                this.#name, 
                this.#buildFromSources.bind(this),
                {
                    disposalCallback: this.#deleteShaderProgram.bind(this),
                    disposalDelay: 3, // wait three seconds after program is unacquired to officially delete.
                }
            );
            console.log(`[ShaderProgram @${this.#name}] Compiled and linked shader successfully.`);

            this.#generateLocationMap();

            // console.log({
            //     name: this.#name,
            //     aliasMap: this.#aliasMap,
            //     dataMap: this.#dataMap,
            //     capabilityMap: this.#capabilityMap,
            //     capabilityList: this.#capabilityList
            // })
            
            return shaderInfo.programID;
        } catch (error) {
            console.error(`[ShaderProgram @${this.#name}] An error occurred during shader compilation:\n${error}`);
            return null;
        }
    }

    /** builds the shader program from the source files */
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
        for (const [name, property] of this.#dataMap) {
            if (property.location !== undefined)
                continue;

            let location;
            if (property.isAttr) {
                location = ShaderProgram.#gl.getAttribLocation(this.programID, name);
            } else {
                location = ShaderProgram.#gl.getUniformLocation(this.programID, name);
            }

            // if (location === null) {
            //     console.warn(`[Shader Program  @${this.name}] Failed to find location for uniform '${name}'.`);
            // }

            if (this.name === 'bp-diff-map') {
                console.log(name, property);
            }

            property.location = location;
        }
    }

    #deleteShaderProgram(shaderInfo) {
        const gl = ShaderProgram.#gl;
        if (gl.isProgram(shaderInfo.programID)) {
            gl.deleteProgram(shaderInfo.programID);
        }
    }
}
