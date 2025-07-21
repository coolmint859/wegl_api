import Shader from "./shader.js";

export default class ShaderManager {
    static ATTRIB_LOCATION_VERTEX = 0;
    static ATTRIB_LOCATION_NORMAL = 1;
    static ATTRIB_LOCATION_UV = 2;

    static #shaderPrograms = new Map();

    static #commonShaders = Object.freeze({
        basic: {vertPath: './shaders/basic.vert', fragPath: './shaders/basic.frag'},
        phong: {vertPath: './shaders/phong.vert', fragPath: './shaders/phong.frag'},
        texture: {vertPath: './shaders/texture.vert', fragPath: './shaders/texture.frag'},
    });

    /**
     * Initialize the shader manager to preload common shaders.
     */
    static init() {
        Object.keys(ShaderManager.#commonShaders).forEach(name => {
            const vertPath = ShaderManager.#commonShaders[name].vertPath;
            const fragPath = ShaderManager.#commonShaders[name].fragPath;
            ShaderManager.#shaderPrograms.set(name, new Shader(name, vertPath, fragPath));
        })
        console.log(ShaderManager.#shaderPrograms.entries());
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