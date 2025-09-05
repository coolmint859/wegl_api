import Parser from "./base_parser.js";

export default class ShaderConfigParser extends Parser {
    static State = Object.freeze({
        READING: 'reading',
        DONE: 'done',
        FAILED: 'failed',
    })

    #currentState;
    #compatibleShaderMap;
    #shaderConfigString;
    #textDecoder;

    constructor() {
        super();
        this.#currentState = ShaderConfigParser.State.READING;
        this.#compatibleShaderMap = new Map();
        this.#shaderConfigString = "";
        this.#textDecoder = new TextDecoder();
    }
    
    /**
     * Reset this parser.
     */
    reset() {
        this.#currentState = ShaderConfigParser.State.READING;
        this.#compatibleShaderMap = new Map();
        this.#shaderConfigString = "";
        this.#textDecoder = new TextDecoder();
    }

    /**
     * parses a shader config json file into a map of verified compatible shader program configs
     * @param {DataView} dataView The current buffer wrapped in a DataView instance. The buffer is prepended with any unprocessed data from the last call.
     * @param {boolean} isStreamDone A flag indicating if there is any more incoming buffer data.
     * @returns {object} A state object. Should hold any 'remainingData' as an ArrayBufferLike and an 'isDone' flag - the flag signals to the caller that parsing is complete, and thus should terminate.
     */
    parse(dataView, isStreamDone) {
        if (dataView.buffer.byteLength === 0 && isStreamDone) {
            // try {
                const shaderConfig = JSON.parse(this.#shaderConfigString);
                this.#validateConfig(shaderConfig);

                this.#currentState = ShaderConfigParser.State.DONE;
                return { remainingData: new Uint8Array(0), isDone: isStreamDone }
            // } catch (error) {
            //     this.#currentState = ShaderConfigParser.State.FAILED;
            //     throw new Error('[ShaderConfigParser] Malformed or incomplete json file.');
            // }
        }

        const chunkString = this.#textDecoder.decode(dataView.buffer);
        this.#shaderConfigString = this.#shaderConfigString.concat(chunkString);

        if (isStreamDone) {
            // try {
                const shaderConfig = JSON.parse(this.#shaderConfigString);
                this.#validateConfig(shaderConfig);

                this.#currentState = ShaderConfigParser.State.DONE;
            // } catch (error) {
            //     this.#currentState = ShaderConfigParser.State.FAILED;
            //     throw new Error('[ShaderConfigParser] Malformed or incomplete json file.');
            // }
        }

        return { remainingData: new Uint8Array(0), isDone: this.#currentState === ShaderConfigParser.State.DONE }
    }

    #validateConfig(shaderConfig) {
        // console.log(shaderConfig);

        const vertexShaders = new Map();
        for (const vert_shader of shaderConfig.vertex_shaders) {
            vertexShaders.set(vert_shader.path, vert_shader);
        }

        const fragmentShaders = new Map();
        for (const frag_shader of shaderConfig.fragment_shaders) {
            fragmentShaders.set(frag_shader.path, frag_shader);
        }

        for (const program of shaderConfig.programs) {
            // check 1: configs exist
            const vertexConfig = vertexShaders.get(program.vertex_shader);
            const fragmentConfig = fragmentShaders.get(program.fragment_shader);
            if (!vertexConfig || !fragmentConfig) {
                console.warn(`[ShaderConfigParser] Invalid Shader Program '${program.name}'; program is missing config for vertex or fragment shader..`);
                continue;
            }

            // check 2: vertex outputs match the fragment inputs
            if (!this.#validateVaryings(vertexConfig, fragmentConfig)) {
                console.warn(`[ShaderConfigParser] Invalid Shader Program '${program.name}'; vertex shader output variables do not mach fragment shader input variables.`);
                continue;
            }

            // check 3: uniform blocks with same binding are exactly the same
            if (!this.#validateBindings(vertexConfig, fragmentConfig)) {
                console.warn(`[ShaderConfigParser] Invalid Shader Program '${program.name}'; vertex shader block bindings do not mach fragment shader block bindings.`);
                continue;
            }

            // check 4: uniforms with same location are exactly the same
            if (!this.#validateLocations(vertexConfig, fragmentConfig)) {
                console.warn(`[ShaderConfigParser] Invalid Shader Program '${program.name}'; vertex shader uniform locations do not mach fragment shader uniform locations.`);
                continue;
            }

            // all checks pass, add program to map
            const shaderInfo = {
                vert_path: program.vertex_shader,
                frag_path: program.fragment_shader,
                config: this.#mergeConfigs(vertexConfig, fragmentConfig)
            }
            this.#compatibleShaderMap.set(program.name, shaderInfo)
        }
    }

    #validateVaryings(vertexConfig, fragmentConfig) {
        if (vertexConfig.outputs.length === fragmentConfig.inputs.length) {
            // if the loop finishes, each output has a matching input
            for (const vert_output of vertexConfig.outputs) {
                const outputMatch = fragmentConfig.inputs.some(frag_input => this.#sameVariable(frag_input, vert_output))
                if (!outputMatch) return false;
            }

            // if the loop finishes, each input has a matching output
            for (const frag_input of fragmentConfig.inputs) {
                const inputMatch = vertexConfig.outputs.some(vert_output => this.#sameVariable(frag_input, vert_output))
                if (!inputMatch) return false;
            }

            // both loops finished, the varyings are compatible
            return true;
        } else {
            // if output and input array lengths differ, the varyings are incompatible, so the shaders are incompatible.
            return false;
        }
    }

    #validateBindings(vertexConfig, fragmentConfig) {
        if (vertexConfig.blocks.length === 0 || fragmentConfig.blocks.length === 0) {
            return true;
        }

        for (const vert_uBlock of vertexConfig.blocks) {
            for (const frag_uBlock of fragmentConfig.blocks) {
                // only blocks that have the same bindings should be compared
                if (vert_uBlock.binding !== frag_uBlock.binding) continue;

                if (vert_uBlock.name !== frag_uBlock.name) {
                    return false;
                }

                if (vert_uBlock.members.length === frag_uBlock.members.length) {
                    // if the loop finishes, each member has a match
                    for (const vert_member of vert_uBlock.members) {
                        const vertex_match = frag_uBlock.members.some(frag_member => this.#sameVariable(vert_member, frag_member))
                        if (!vertex_match) return false;
                    }

                    // if the loop finishes, each member has a match
                    for (const frag_member of frag_uBlock.members) {
                        const fragment_match = vert_uBlock.members.some(vert_member => this.#sameVariable(vert_member, frag_member))
                        if (!fragment_match) return false;
                    }
                } else {
                    // if bindings are same but members differ, then the blocks are invalid, so the shaders are incompatible.
                    return false;
                }
            }
        }
        return true;
    }

    #validateLocations(vertexConfig, fragmentConfig) {
        // skip loops if either shader has no uniforms
        if (vertexConfig.uniforms.length === 0 || fragmentConfig.uniforms.length === 0) {
            return true;
        }

        for (const vert_uniform of vertexConfig.uniforms) {
            for (const frag_uniform of fragmentConfig.uniforms) {
                if (vert_uniform.name === frag_uniform.name) {
                    const sameLocation = vert_uniform.location === frag_uniform.location;
                    const sameDataType = vert_uniform.type === frag_uniform.type;
                    
                    if (!sameLocation && sameDataType) return false;
                } else if (vert_uniform.location === frag_uniform.location) {
                    // if one or either locations weren't specified, then this is okay as they dont have the same name. 
                    // But if both locations are specified, then this is invalid, as the locations are the same but their names aren't. 
                    if (!(vert_uniform.location === undefined && frag_uniform.location === undefined)) {
                        continue;
                    } else {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    #mergeConfigs(vertexConfig, fragmentConfig) {
        console.log(vertexConfig.capabilities);
        console.log(fragmentConfig.capabilities)
        const capabilities = new Set(vertexConfig.capabilities);
        fragmentConfig.capabilities.forEach(cap => capabilities.add(cap));
        console.log(capabilities);
        return { vertexConfig, fragmentConfig };
    }

    #sameVariable(vert_variable, frag_variable) {
        const sameName = vert_variable.name === frag_variable.name;
        const sameType = vert_variable.type === frag_variable.type;
        const sameCount = vert_variable.maxCount === frag_variable.maxCount
        console.log(vert_variable, frag_variable, sameName && sameType && sameCount)
        return sameName && sameType && sameCount;
    }

    /**
     * Returns the final parsed/processed data. This method must be overridden.
     * @returns {Map} The final parsed data.
     */
    getDataWebGL() {
        return this.#compatibleShaderMap;
    }
}