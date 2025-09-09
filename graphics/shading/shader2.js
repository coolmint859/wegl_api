import ResourceCollector from "../../utilities/containers/collector.js";
import Graphics3D from "../rendering/renderer.js";

export default class ShaderProgram {
    static #gl;
    static #ID_COUNTER = 0;

    // status variables
    #id;
    #isReady;

    // shader configuration
    #name;
    #config;
    #locationMap;

    // per frame value maps
    #uniformMap;            // holds currently set uniforms
    #uniformToBlockMap;     // maps uniform names to block names
    #blockMap;              // maps block names to block configs
    #samplerMap;            // maps sampler names to gl textures

    constructor(name, configuration) {
        this.#id = ShaderProgram.#ID_COUNTER++;
        this.#isReady = false;
        
        this.#name = name;
        this.#config = configuration;
        this.#locationMap = new Map();

        this.#uniformMap = new Map();
        this.#blockMap = new Map();
        this.#uniformToBlockMap = new Map();
        this.#samplerMap = new Map();

        if (!ShaderProgram.#gl) {
            ShaderProgram.#gl = Graphics3D.getGLContext();
        }
    }

    get ID() {
        return this.#id;
    }

    get name() {
        return this.#name
    }

    get capabilities() {
        return this.#locationMap.entries();
    }

    get programID() {
        if (ResourceCollector.isLoaded(this.#name)) {
            return ResourceCollector.get(this.#name).programID;
        }
        return null;
    }

    get config() {
        return this.#config;
    }

    isProgramReady() {
        return this.#isReady;
    }

    getAttributeLocation(attributeName) {
        if (this.#locationMap.has(attributeName)) {
            return this.#locationMap.get(attributeName);
        } else {
            console.error(`[ShaderProgram @${this.#name}] Expected attribute to be supported by this shader. Cannot get attribute location.`)
            return undefined;
        }
    }

    setUniform(uniformName, uniformData) {
        if (this.#uniformToBlockMap.has(uniformName)) {
            const blockName = this.#uniformToBlockMap.get(uniformName);
            const blockInfo = this.#blockMap.get(blockName);
            blockInfo.isDirty = true;
            blockInfo.uniformMap.get(uniformName, uniformData);
        } else if (this.#config.uniforms.some(uniform => uniform.name === uniformName)) {
            const uniformInfo = this.#uniformMap.get(uniformName);
            uniformInfo.data = uniformData;
            uniformInfo.isDirty = true;
        } else {
            console.error(`[ShaderProgram @${this.#name}] Expected uniform to be supported by this shader. Cannot set uniform.`)
        }
    }

    setSampler2D(samplerName, samplerData) {
        if (this.#samplerMap.has(samplerName)) {
            this.#samplerMap.set(samplerName, samplerData);
        } else {
            console.error(`[ShaderProgram @${this.#name}] Expected sampler to be supported by this shader. Cannot set sampler.`)
        }
    }

    flush() {


    }

    refresh() {

    }

    async build() {
        if (ResourceCollector.contains(this.#name)) {
            const shaderInfo = await ResourceCollector.getWhenLoaded(
                this.#name, 
                { pollTimeout: 3, pollInterval: 0.2 }
            );
            if (shaderInfo === null) {
                console.error(`[ShaderProgram @${this.#name}] Load of shader program timed out before retreival. Cannot build program.`);
                return null;
            }
            return shaderInfo.programID;
        }

        try {
            const shaderInfo = await ResourceCollector.load(this.#name, this.#buildFromSources.bind(this));
            console.log(`[ShaderProgram @${this.#name}] Compiled and linked shader successfully.`);

            this.#prepareShaderMaps();
            
            this.#isReady = true;
            return shaderInfo.programID;
        } catch (error) {
            console.error(`[ShaderProgram @${this.#name}] An error occurred during shader compilation:\n${error}`);
            return null;
        }
    }

    async #buildFromSources(shaderName) {
        const gl = ShaderProgram.#gl;

        let shaderProgram;
        try {
            const vertexSource = await ResourceCollector.getWhenLoaded(
                `./graphics/shading/programs/${this.#config.vertexPath}`, 
                { pollTimeout: 3, pollInterval: 0.2 }
            );
            const fragmentSource = await ResourceCollector.getWhenLoaded(
                `./graphics/shading/programs/${this.#config.fragmentPath}`, 
                { pollTimeout: 3, pollInterval: 0.2 }
            );

            if (vertexSource === null || fragmentSource === null) {
                console.error(`[ShaderProgram @${this.#name}] Load of shader sources timed out before retreival. Cannot build program.`);
                return null;
            }

            const vertexShader = this.#compileShader(shaderName, vertexSource, gl.VERTEX_SHADER);
            const fragmentShader = this.#compileShader(shaderName, fragmentSource, gl.FRAGMENT_SHADER);
            shaderProgram = this.#linkShaders(shaderName, vertexShader, fragmentShader);
            
            // once program is linked, we don't need the individual shaders anymore
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);

            // this is stored in the ResourceCollector cache
            return {
                shaderName: shaderName,
                programID: shaderProgram,
                vertexPath: this.#config.vertexPath,
                fragmentPath: this.#config.fragmentPath,
            }
        } catch (error) {
            if (gl.isProgram(shaderProgram)) {
                gl.deleteProgram(shaderProgram);
            }
            throw error;
        }
    }

    #compileShader(shaderName, sourceText, shaderType) {
        const gl = ShaderProgram.#gl;

        const shaderObject = gl.createShader(shaderType);
        gl.shaderSource(shaderObject, sourceText);
        gl.compileShader(shaderObject);

        const compileSuccess = gl.getShaderParameter(shaderObject, gl.COMPILE_STATUS);
        if (!compileSuccess) {
            const infoLog = gl.getShaderInfoLog(shaderObject);
            const shaderTypeName = shaderType === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
            console.error(`[ShaderProgram @${shaderName}] Failed to compile ${shaderTypeName} shader: ${infoLog}`);
        }
        return shaderObject;
    }

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

    #prepareShaderMaps() {

    }
}