import ResourceCollector from "../utilities/collector.js";
import { StreamReader } from "../utilities/index.js";
import ShaderProgram from "./shader-program.js";
import ShaderValidator from "./shader-validator.js";

/**
 * Intitializes shader programs to be used throughout the runtime environment
 */
export default class ShaderHandler {
    static #gl;

    static shaderConfigDirectory = "./graphics/shading/configs/";
    static shaderFileDirectory = "./graphics/shading/programs/";

    static #shaderPrograms = new Map();
    static #isReady = false;
    static #bestFitThreshold = 0.75;
    static #inclusionWeight = 1;
    static #exclusionWeight = 2.5; 

    /**
     * Initialize the shader manager to preload common shaders (only compiles the basic shader).
     */
    static async init(gl) {
        if (!ShaderHandler.#gl) {
            ShaderHandler.#gl = gl;
        }

        const shaderConfigs = await StreamReader.read(ShaderHandler.shaderConfigDirectory + 'shader.json')
        for (const configPair of shaderConfigs) {
            const mergedConfig = await ShaderHandler.#loadConfigPair(configPair);
            const { vertexSource, fragmentSource } = await ShaderHandler.#loadShaderFiles(mergedConfig)

            let shaderProgram = ShaderHandler.#shaderPrograms.get(mergedConfig.shaderName)
            if (shaderProgram === undefined) {
                shaderProgram = new ShaderProgram(mergedConfig.shaderName, vertexSource, fragmentSource, mergedConfig.config);
                ShaderHandler.#shaderPrograms.set(mergedConfig.shaderName, shaderProgram);
            }

            shaderProgram.build().then(programID => {
                if (mergedConfig.shaderName === 'basic') {
                    // console.log(shaderProgram.capabilityMap);
                    // console.log(shaderProgram.trueCapabilities);
                }
            })

            // construct basic shader immediately.
            // if (mergedConfig.shaderName === 'basic') {
            //     shaderProgram.build().then(programID => {
            //         if (programID) {
            //             ShaderManager.#isReady = true

            //             console.log(shaderProgram.capabilityMap);
            //             console.log(shaderProgram.trueCapabilities);
            //         }
            //     });
            // }
        }
        ShaderHandler.#isReady = true
    }

    /** Returns the current WebGl context. */
    static get glContext() {
        return ShaderHandler.#gl;
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

    static get bestFitWeights() {

    }

    /**
     * Check if at least the basic shader is loaded and compiled.
     * @returns {boolean} true if the shader manager is ready, false otherwise
     */
    static get isReady() {
        return ShaderHandler.#isReady;
    }

    /**
     * Check if the given shader is ready (loaded and compiled)
     * @param {string} shaderName the name of the shader program
     * @returns {boolean} true if the shader program is ready, false otherwise
     */
    static isShaderReady(shaderName) {
        if (!ShaderHandler.#shaderPrograms.has(shaderName)) {
            console.error(`[ShaderManager] Error: Could not find shader '${shaderName}' in set of registered shaders.`);
            return false;
        }
        return ShaderHandler.#shaderPrograms.get(shaderName).isLinked;
    }

    /**
     * Retrieve a shader program instance
     * @param {string} shaderName the name of the shader program
     * @returns {ShaderProgram} the shader program instance with the given name
     */
    static getShaderProgram(shaderName) {
        if (!ShaderHandler.#shaderPrograms.has(shaderName)) {
            console.error(`[ShaderManager] Error: Could not find shader '${shaderName}' in set of registered shaders.`);
            return null;
        }
        return ShaderHandler.#shaderPrograms.get(shaderName);
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
        ShaderHandler.#shaderPrograms.set(name, shaderProgram);
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
        if (!ShaderHandler.#shaderPrograms.has(shaderName)) {
            console.error(`[ShaderManager] Error: Could not find shader '${shaderName}' in set of registered shaders.`);
            return false;
        } 
        if (shaderName === 'basic') {
            console.error(`[ShaderManager] Error: Cannot remove shader 'basic' as it is the default shader.`);
            return false;
        }
        return ShaderHandler.#shaderPrograms.delete(shaderName);
    }

    /**
     * Find the best fit shader for an object in a scene given the combined capabilities. 
     * Shaders of which the compatibility score is less than the best fit threshold are always rejected, even if they are the best fit.
     * @param {Array<string>} sceneCapabilities an array of capabilities of a mesh. 
     * @returns {string} the name of the shader that best fits the given mesh capabilities, if ready.
     */
    static bestFitShader(sceneCapabilities) {
        let bestFitShader = ShaderHandler.#shaderPrograms.get("basic");
        let bestFitName = "basic", bestScore = 0;

        for (const [shaderName, shader] of ShaderHandler.#shaderPrograms) {

            const capabilityMap = shader.capabilityMap;
            const shaderCapabilities = shader.trueCapabilities;

            // find number of shader supported capabilities (inclusion)
            let shaderSupported = 0;
            const trueSceneCapabilities = new Set()
            for (const meshCap of sceneCapabilities) {
                const trueName = capabilityMap.get(meshCap);
                if (trueName !== undefined) {
                    shaderSupported += 1;
                    trueSceneCapabilities.add(trueName);
                }
            }
            const inclusivityScore = shaderSupported / sceneCapabilities.length;

            // find number of scene supported capabilities (exclusion)
            let sceneSupported = 0;
            for (const shaderCap of shaderCapabilities) {
                if (trueSceneCapabilities.has(shaderCap)) {
                    sceneSupported +=1;
                }
            }
            const exclusivityScore = sceneSupported / shaderCapabilities.length;

            // calculate best fit score using weighted average
            const inWeight = ShaderHandler.#inclusionWeight;
            const exWeight = ShaderHandler.#exclusionWeight;
            const weightSum = inWeight + exWeight;
            const bestFitScore = (inWeight * inclusivityScore + exWeight * exclusivityScore) / weightSum;

            console.log({
                shaderName, 
                capabilityMap, 
                sceneCapabilities,
                trueSceneCapabilities, 
                shaderCapabilities, 
                inclusivityScore, 
                exclusivityScore, 
                bestFitScore
            });

            // compare best scores
            if (bestFitScore > bestScore && bestFitScore > ShaderHandler.bestFitThreshold) {
                bestFitName = shaderName;
                bestFitShader = shader;
                bestScore = bestFitScore;
            }
        }

        // // if the shader isn't linked yet and isn't being built yet, build it, and set the best fit shader to 'basic',
        // if (!bestFitShader.isReady) {
        //     bestFitName = 'basic';
        //     if (!bestFitShader.isLoading) bestFitShader.build(); 
        // }

        return bestFitName;
    }

    /** loads and stores shader config pairs in ResourceCollector. Returns the merged, validated shader config */
    static async #loadConfigPair(configPair) {
        try {
            const category = 'shader-config';
            const loadTimeout = 5; // seconds

            // load in vertex config
            const vertConfigPath = ShaderHandler.shaderConfigDirectory + configPair.vertex_config;
            let vertexConfig;
            if (ResourceCollector.contains(vertConfigPath)) {
                vertexConfig = await ResourceCollector.getWhenLoaded(vertConfigPath);
                ResourceCollector.acquire(vertConfigPath);
            } else {
                vertexConfig = await ResourceCollector.load(vertConfigPath, StreamReader.read, { category, loadTimeout });
            }

            // load in fragment config
            const fragConfigPath = ShaderHandler.shaderConfigDirectory + configPair.fragment_config;
            let fragmentConfig;
            if (ResourceCollector.contains(fragConfigPath)) {
                fragmentConfig = await ResourceCollector.getWhenLoaded(fragConfigPath);
                ResourceCollector.acquire(fragConfigPath);
            } else {
                fragmentConfig = await ResourceCollector.load(fragConfigPath, StreamReader.read, { category, loadTimeout });
            }

            // return the validated and merged configs
            return ShaderValidator.validate(configPair.name, vertexConfig, fragmentConfig);
        } catch (error) {
            console.error(`[ShaderManager] An error occurred during shader config loading:\n${error}`);
            throw error;
        }
    }

    /** loads and stores shader source code in ResourceCollector, creates a new shader program from them, and stores it in the shader map*/
    static async #loadShaderFiles(shaderConfig) {
        try {
            const category = 'shader-source';
            const loadTimeout = 5; // seconds

            const pollTimeout = 3;
            const pollInterval = 0.2;

            // load in vertex source
            const vertexPath = ShaderHandler.shaderFileDirectory + shaderConfig.vertexPath;
            let vertexSource;
            if (ResourceCollector.contains(vertexPath)) {
                vertexSource = await ResourceCollector.getWhenLoaded(vertexPath, { pollTimeout, pollInterval });
                ResourceCollector.acquire(vertexPath);
            } else {
                vertexSource = await ResourceCollector.load(vertexPath, StreamReader.read, { category, loadTimeout });
            }

            // load in fragment source
            const fragmentPath = ShaderHandler.shaderFileDirectory + shaderConfig.fragmentPath;
            let fragmentSource;
            if (ResourceCollector.contains(fragmentPath)) {
                fragmentSource = await ResourceCollector.getWhenLoaded(fragmentPath, { pollTimeout, pollInterval });
                ResourceCollector.acquire(fragmentPath);
            } else {
                fragmentSource = await ResourceCollector.load(fragmentPath, StreamReader.read, { category, loadTimeout });
            }

            return { vertexSource, fragmentSource };
        } catch (error) {
            console.error(`[ShaderManager] An error occurred during shader file loading:\n${error}`);
            throw error;
        }
    }
}