import ResourceCollector from "../../utilities/containers/collector.js";
import JSONParser from "../../utilities/file_parsing/json-parser.js";
import GLSLParser from "../../utilities/file_parsing/glsl-parser.js";
import StreamReader from "../../utilities/file_parsing/stream-reader.js";
import ShaderProgram from "./shader2.js";
import ShaderValidator from "./shader-validator.js";

export default class ShaderManager {
    static ATTRIB_LOCATION_VERTEX = 0;
    static ATTRIB_LOCATION_NORMAL = 1;
    static ATTRIB_LOCATION_UV = 2;

    static #shaderConfigPath = "./graphics/shading/configs/shader.json";
    static #shaderPrograms = new Map();
    static #isReady = false;
    static #bestFitThreshold = 0.75;

    /**
     * Initialize the shader manager to preload common shaders (only compiles the basic shader).
     */
    static init() {
        StreamReader.read(ShaderManager.#shaderConfigPath)
        .then(shaderConfigs => {
            for (const config of shaderConfigs) {
                ShaderManager.#loadShaderConfigs(config).then(
                    mergedConfig => ShaderManager.#loadShaderFiles(config.name, mergedConfig)
                )
            }
        });
    }

    /**
     * Get the best fit threshold. This value is the mininum score required for a shader to be selected during best fit.
     * @returns {number} the best fit threshold (value between 0 and 1)
     */
    static get bestFitThreshold() {
        return this.#bestFitThreshold;
    }

    /** 
     * Set the best fit threshold. This value is the mininum score required for a shader to be selected during best fit.
     * @param {number} threshold the best fit threshold (must be a value between 0 and 1)
     */
    static set bestFitThreshold(threshold) {
        if (threshold < 0 || threshold > 1) {
            console.error(`[ShaderManager] Expected 'theshold' to be a number between 0 and 1, inclusive. Reverting to previous value.`);
            return;
        }
        this.#bestFitThreshold = threshold;
    }

    /**
     * Check if at least the basic shader is loaded and compiled.
     * @returns {boolean} true if the shader manager is ready, false otherwise
     */
    static isReady() {
        return ShaderManager.#isReady;
    }

    /**
     * Check if the given shader is ready (loaded and compiled)
     * @param {string} shaderName the name of the shader program
     * @returns {boolean} true if the shader program is ready, false otherwise
     */
    static isShaderReady(shaderName) {
        if (!ShaderManager.#shaderPrograms.has(shaderName)) {
            console.error(`[ShaderManager] Error: Could not find shader '${shaderName}' in set of registered shaders.`);
            return false;
        }
        return ShaderManager.#shaderPrograms.get(shaderName).isReady;
    }

    /**
     * Retrieve a shader program instance
     * @param {string} shaderName the name of the shader program
     * @returns {ShaderProgram} the shader program instance with the given name
     */
    static getShaderProgram(shaderName) {
        if (!ShaderManager.#shaderPrograms.has(shaderName)) {
            console.error(`[ShaderManager] Error: Could not find shader '${shaderName}' in set of registered shaders.`);
            return null;
        }
        return ShaderManager.#shaderPrograms.get(shaderName);
    }

    /**
     * Add a shader program to the set of known shaders.
     * @param {string} name the name of the shader program
     * @param {ShaderProgram} shaderProgram the shader program instance
     * @returns {boolean} true if the shader was successfully added, false otherwise
     */
    static registerShader(name, shaderProgram) {
        if (typeof name !== 'string' || name.trim() === '') {
            console.error(`[ShaderManager] TypeError: Expected 'name' to be a non-empty string. Cannot register new shader.`);
            return false;
        }
        if (!shaderProgram instanceof ShaderProgram) {
            console.error(`[ShaderManager] TypeError: Expected 'shaderProgram' to be an instance of Shader. Cannot register new shader '${name}'.`);
            return false;
        }
        ShaderManager.#shaderPrograms.set(name, shaderProgram);
        return true;
    }
    
    /**
     * Remove a shader from the set of known shaders.
     * 
     * Note: any meshes that use this shader might not render. 
     * @param {string} shaderName the name of the shader
     * @returns {boolean} true if the shader was successfully removed, false, otherwise
     */
    static removeShader(shaderName) {
        if (!ShaderManager.#shaderPrograms.has(shaderName)) {
            console.error(`[ShaderManager] Error: Could not find shader '${shaderName}' in set of registered shaders.`);
            return false;
        }
        return ShaderManager.#shaderPrograms.delete(shaderName);
    }

    /**
     * Find the best fit shader for a mesh given it's capabilities. 
     * Shaders of which the compatibility score is less than the best fit threshold are always rejected, even if they are the best fit.
     * @param {Array<string>} meshCapabilities an array of capabilities of a mesh. 
     * @returns {Promise<string>} a promise that resolves with the name of the shader that best fits the given mesh capabilities
     */
    static async bestFitShader(meshCapabilities) {
        let bestFitShader = "basic", bestScore = 0;
        for (const [shaderName, shader] of ShaderManager.#shaderPrograms) {
            // find number of supported capabilities
            let numSupported = 0;
            for (const meshCap of meshCapabilities) {
                if (shader.capabilities.includes(meshCap)) {
                    numSupported++;
                }
            }

            // calculate and compare scores
            const score = numSupported/meshCapabilities.length;
            if (score > bestScore && score > ShaderManager.bestFitThreshold) {
                bestFitShader = shaderName;
                bestScore = score;
            }
        }

        // wait for the shader to build the program before returning
        if (!ShaderManager.#shaderPrograms.get(bestFitShader).isReady()) {
            const programID = await ShaderManager.#shaderPrograms.get(bestFitShader).build();
            // if the programID is null, this means shader compilation failed - default to basic shader
            if (programID === null) {
                bestFitShader = "basic";
            }
        }

        return bestFitShader;
    }

    /** loads and stores shader config files in ResourceCollector. Returns the merged, validated shader config */
    static async #loadShaderConfigs(shaderConfig) {
        try {
            const category = 'shader-config';
            const loadTimeout = 5; // seconds

            // load in vertex config
            const vertConfigPath = `./graphics/shading/configs/${shaderConfig.vertex_config}`;
            let vertexConfig;
            if (ResourceCollector.contains(vertConfigPath)) {
                vertexConfig = await ResourceCollector.getWhenLoaded(vertConfigPath);
            } else {
                vertexConfig = await ResourceCollector.load(vertConfigPath, StreamReader.read, { category, loadTimeout });
            }

            // load in fragment config
            const fragConfigPath = `./graphics/shading/configs/${shaderConfig.fragment_config}`;
            let fragmentConfig;
            if (ResourceCollector.contains(fragConfigPath)) {
                fragmentConfig = await ResourceCollector.getWhenLoaded(fragConfigPath);
            } else {
                fragmentConfig = await ResourceCollector.load(fragConfigPath, StreamReader.read, { category, loadTimeout });
            }

            // return the validated and merged configs
            return ShaderValidator.validate(shaderConfig.name, vertexConfig, fragmentConfig);
        } catch (error) {
            console.error(`[ShaderManager] An error occurred during shader config loading:\n${error}`);
            throw error;
        }
    }

    /** loads and stores shader source code in ResourceCollector, creates a new shader program from them, and stores it in the shader map*/
    static #loadShaderFiles(shaderName, shaderConfig) {
        console.log(shaderConfig);
        try {
            const category = 'shader-source';
            const loadTimeout = 5; // seconds

            const vertexPath = `./graphics/shading/programs/${shaderConfig.vertexPath}`;
            if (!ResourceCollector.contains(vertexPath)) {
                ResourceCollector.load(
                    vertexPath, StreamReader.read, 
                    { category, loadTimeout, parser: new GLSLParser() }
                );
            }

            const fragmentPath = `./graphics/shading/programs/${shaderConfig.fragmentPath}`;
            if (!ResourceCollector.contains(fragmentPath)) {
                ResourceCollector.load(
                    fragmentPath, StreamReader.read, 
                    { category, loadTimeout, parser: new GLSLParser() }
                );
            }

            // when a shader instance is made, it is assumed that the shader sources are loading/loaded.
            const shaderProgram = new ShaderProgram(shaderName, shaderConfig);
            ShaderManager.#shaderPrograms.set(shaderName, shaderProgram);

            // construct basic shader immediately.
            if (shaderName === 'basic') {
                shaderProgram.build().then(programID => ShaderManager.#isReady = true);
            }

            ShaderManager.#shaderPrograms.set(shaderName, shaderProgram);
        } catch (error) {
            console.error(`[ShaderManager] An error occurred during shader file loading:\n${error}`);
            throw error;
        }
    }
}