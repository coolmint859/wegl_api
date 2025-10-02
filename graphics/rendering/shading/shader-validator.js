export default class ShaderValidator {
    static validate(shaderName, vertexConfig, fragmentConfig) {
        // check 1: vertex outputs match the fragment inputs
        if (!ShaderValidator.#validateVaryings(vertexConfig, fragmentConfig)) {
            console.warn(`[ShaderValidator] Invalid Shader Program '${shaderName}'; vertex shader output variables do not match fragment shader input variables.`);
            return null;
        }

        // check 2: uniform blocks with same binding are exactly the same
        if (!ShaderValidator.#validateBindings(vertexConfig, fragmentConfig)) {
            console.warn(`[ShaderValidator] Invalid Shader Program '${shaderName}'; vertex shader block bindings do not match fragment shader block bindings.`);
            return null;
        }

        // check 3: uniforms with same location are exactly the same
        if (!ShaderValidator.#validateLocations(vertexConfig, fragmentConfig)) {
            console.warn(`[ShaderValidator] Invalid Shader Program '${shaderName}'; vertex shader uniform locations do not match fragment shader uniform locations.`);
            return null;
        }

        // check 4: all uniform names are unique
        if (!ShaderValidator.#validateNames(vertexConfig, fragmentConfig)) {
            console.warn(`[ShaderValidator] Invalid Shader Program '${shaderName}'; vertex/fragment shader uniform names are not unique for each shader.`);
            return null;
        }

        // all checks pass, merge configs and create shader info object
        return {
            shaderName,
            vertexPath: vertexConfig.path,
            fragmentPath: fragmentConfig.path,
            config: ShaderValidator.#mergeConfigs(vertexConfig, fragmentConfig)
        }
    }

    static #validateVaryings(vertexConfig, fragmentConfig) {
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

    static #validateBindings(vertexConfig, fragmentConfig) {
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

    static #validateLocations(vertexConfig, fragmentConfig) {
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
                    if (vert_uniform.location === undefined || frag_uniform.location === undefined) {
                        continue;
                    } else {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    static #validateNames(vertexConfig, fragmentConfig) {
        // TODO: write logic to validate vertex and fragment names are unique
        return true;
    }

    static #mergeConfigs(vertexConfig, fragmentConfig) {
        const attributes = vertexConfig.attributes;

        // merge uniforms
        const uniforms = vertexConfig.uniforms;
        for (const frag_uniform of fragmentConfig.uniforms) {
            const frag_match = uniforms.some(vert_uniform => vert_uniform.name === frag_uniform.name);
            if (!frag_match) uniforms.push(frag_uniform);
        }

        // merge structs
        const structs = vertexConfig.structs;
        for (const frag_struct of fragmentConfig.structs) {
            const frag_match = structs.some(vert_struct => vert_struct.name === frag_struct.name);
            if (!frag_match) structs.push(frag_struct);
        }

        // merge blocks
        const blocks = vertexConfig.blocks;
        for (const frag_block of fragmentConfig.blocks) {
            const frag_match = blocks.some(vert_block => vert_block.name === frag_block.name)
            if (!frag_match) blocks.push(frag_block);
        }

        return { attributes, uniforms, structs, blocks };
    }

    static #sameVariable(vert_variable, frag_variable) {
        const sameName = vert_variable.name === frag_variable.name;
        const sameType = vert_variable.type === frag_variable.type;
        const sameCount = vert_variable.maxCount === frag_variable.maxCount
        // console.log(vert_variable, frag_variable, sameName && sameType && sameCount)
        return sameName && sameType && sameCount;
    }
}