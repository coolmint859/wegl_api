import ResourceCollector from "../../utilities/containers/collector.js";
import ShaderConfigParser from "../../utilities/file_parsing/shader_config_parser.js";
import StreamReader from "../../utilities/file_parsing/stream.js";
import Shader from "./shader.js";

export default class ShaderManager {
    static ATTRIB_LOCATION_VERTEX = 0;
    static ATTRIB_LOCATION_NORMAL = 1;
    static ATTRIB_LOCATION_UV = 2;

    static #shaderConfigPath = "../shaders/shader-config.json";
    static #shaderPrograms = new Map();
    static #shadersLoaded = false;

    /**
     * Initialize the shader manager to preload common shaders.
     */
    static init() {
        StreamReader.read(ShaderManager.#shaderConfigPath, { parser: new ShaderConfigParser() })
        .then(configMap => {
            console.log(configMap);
            // for (const [shaderName, shaderInfo] of configMap) {
            //     const vert_path = shaderInfo.vert_path;
            //     const frag_path = shaderInfo.frag_path;
            //     const config = shaderInfo.config
            //     const shader = new Shader(shaderName, vert_path, frag_path, config);
            //     ShaderManager.#shaderPrograms.set(shaderName, shader)
            // }
            ShaderManager.#shadersLoaded = true;
        });
    }

    static get shadersLoaded() {
        return ShaderManager.#shadersLoaded;
    }

    static registerShader(name, shaderProgram) {
        if (typeof name !== 'string' || name.trim() === '') {
            console.error(`[ShaderManager] TypeError: Expected 'name' to be a non-empty string. Cannot register new shader.`);
            return false;
        }
        if (!shaderProgram instanceof Shader) {
            console.error(`[ShaderManager] TypeError: Expected 'shaderProgram' to be an instance of Shader. Cannot register new shader '${name}'.`);
            return false;
        }
        ShaderManager.#shaderPrograms.set(name, shaderProgram);
    }

    static getShaderProgram(name) {
        if (!ShaderManager.#shaderPrograms.has(name)) {
            console.error(`[ShaderManager] Error: Could not find shader '${name}' in set of registered shaders.`);
            return null;
        }
        return ShaderManager.#shaderPrograms.get(name);
    }
    
    static releaseShader(shaderName) {
        if (!ShaderManager.#shaderPrograms.has(shaderName)) {
            console.error(`[ShaderManager] Error: Could not find shader '${shaderName}' in set of registered shaders.`);
            return null;
        }
        const shader = ShaderManager.#shaderPrograms.get(shaderName);
        shader.release();
        ShaderManager.#shaderPrograms.delete(shaderName);
    }

    static async bestFitShader(capabilities, preferredShader) {
        // TODO: write best fit logic
        return "texture";
    }
}