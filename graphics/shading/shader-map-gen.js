import TextureManager from "../material/texture-manager.js";
import Color from "../utilities/containers/color.js";
import { Matrix2, Matrix3, Matrix4 } from "../utilities/math/matrix.js";
import { Vector2, Vector3, Vector4 } from "../utilities/math/vector.js";
export default class ShaderMapGenerator {
    /**
     * Generate a set of maps for shader uniforms from a given shader config object
     * @param {object} shaderConfig the config associated with the shader instance
     * @returns {object} an object containing maps between uniform names and aliases to uniform properties
     */
    static generate(shaderConfig) {
        // this is a temporary map that is created by 'flattening' the config object.
        // it's further split into three maps the shader can use.
        const uniformMap = ShaderMapGenerator.#generateUniformMap(shaderConfig);

        // create the alias map
        const aliasMap = new Map() 
        for (const [name, uniformInfo] of uniformMap) {
            if (uniformInfo.isAttr) {
                aliasMap.set(name, { trueName: uniformInfo.trueName, isAttr: true });
            } else {
                aliasMap.set(name, { trueName: uniformInfo.trueName, isAttr: false });
            }
        }

        // construct data map from uniform map
        const dataMap = new Map()
        for (const uniformInfo of uniformMap.values()) {
            if (dataMap.has(uniformInfo.trueName) || uniformInfo.isAttr) continue;

            const value = ShaderMapGenerator.#initialUniformValue(uniformInfo.type)
            dataMap.set(uniformInfo.trueName, { value, type: uniformInfo.type, isDirty: true });
        }

        // construct location lookup map from uniform Map
        const locationConfigMap = new Map();
        for (const uniformInfo of uniformMap.values()) {
            if (uniformInfo.location === undefined) continue;

            locationConfigMap.set(uniformInfo.trueName, uniformInfo.location);
        }

        // construct capability map and array from uniform map
        const capabilityMap = new Map();
        const trueCapabilities = new Set();
        for (const [name, uniformInfo] of uniformMap) {
            if (uniformInfo.isArray) {
                trueCapabilities.add(uniformInfo.arrayType);
            } else {
                trueCapabilities.add(name);
                capabilityMap.set(name, uniformInfo.trueName)
            }
        }
        const capabilityList = Array.from(trueCapabilities);

        return { aliasMap, dataMap, locationConfigMap, capabilityMap, capabilityList };
    }

    static #generateUniformMap(shaderConfig) {
        const uniformMap = new Map();

        // construct uniform map from config
        for (const uniform of shaderConfig.uniforms) {
            const result = ShaderMapGenerator.#processUniform(uniform, '', shaderConfig.structs, 0, uniform.type);
            for (const uniformInfo of result) {
                // uniformInfo.isAttr = false;
                uniformMap.set(uniformInfo.name, uniformInfo.data);
            }
        }

        // add attributes to alias map
        const setAttribute = function(attrName, attrInfo) {
            if (attrInfo.location !== undefined) {
                uniformMap.set(attrName, { trueName: attrInfo.name, location: attrInfo.location, isArray: false, isAttr: true });
            } else {
                uniformMap.set(attrName, { trueName: attrInfo.name, isArray: false, isAttr: true });
            }
        }
        for (const attribute of shaderConfig.attributes) {
            setAttribute(attribute.name, attribute);

            if (Array.isArray(attribute.aliases)) {
                for (const alias of attribute.aliases) {
                    setAttribute(alias, attribute);
                }
            }
        }

        return uniformMap;
    }

    /** recursively constucts a uniforms' full name and aliases */
    static #processUniform(uniform, parentName, structs, arrayType) {
        const struct = structs.find(struct => struct.name === uniform.type);

        if (struct === undefined) {
            if (uniform.isArray) {
                return ShaderMapGenerator.#processArrayUniform(uniform, parentName, arrayType);
            } else {
                return ShaderMapGenerator.#processPrimitiveUniform(uniform, parentName);
            }
        } else {
            return ShaderMapGenerator.#processStruct(struct, uniform, parentName, structs);
        }
    }

    /** creates uniform map entries for an array of primitive uniforms */
    static #processArrayUniform(uniform, parentName, arrayType) {
        const mapEntries = [];
        for (let i = 0; i < uniform.maxSize; i++) {
            const elementPrefix = parentName + '[' + i + ']' + '.';
            const trueName = elementPrefix + uniform.name;
            let data;
            if (uniform.location !== undefined) {
                data = { trueName, arrayType, type: uniform.type, isArray: true, location: uniform.location }
            } else {
                data = { trueName, arrayType, type: uniform.type, isArray: true }
            }
            mapEntries.push({ name: elementPrefix + uniform.name, data });

            if (Array.isArray(uniform.aliases)) {
                for (const alias of uniform.aliases) {
                    let data;
                    if (uniform.location !== undefined) {
                        data = { trueName, arrayType, type: uniform.type, isArray: true, location: uniform.location }
                    } else {
                        data = { trueName, arrayType, type: uniform.type, isArray: true }
                    }
                    mapEntries.push({ name: elementPrefix + alias, data });
                }
            }
        }
        return mapEntries;
    }

    /** creates uniform map entries for a primitive uniform */
    static #processPrimitiveUniform(uniform, parentName) {
        const mapEntries = [];

        const trueName = parentName + uniform.name;
        let data;
        if (uniform.location !== undefined) {
            data = { trueName, type: uniform.type, isArray: false, location: uniform.location }
        } else {
            data = { trueName, type: uniform.type, isArray: false }
        }
        mapEntries.push({ name: parentName + uniform.name, data });

        if (Array.isArray(uniform.aliases)) {
            for (const alias of uniform.aliases) {
                let data;
                if (uniform.location !== undefined) {
                    data = { trueName, type: uniform.type, isArray: false, location: uniform.location }
                } else {
                    data = { trueName, type: uniform.type, isArray: false }
                }
                mapEntries.push({ name: parentName + alias, data })
            }
        }
        return mapEntries;
    }

    /** creates uniform map entries for struct member uniforms */
    static #processStruct(struct, uniform, parentName, structs) {
        const mapEntries = []
        for (const member of struct.members) {
            // struct of an array
            if (uniform.isArray) {
                for (let i = 0; i < uniform.maxSize; i++) {
                    const combinedName = parentName + uniform.name + '[' + i + ']'  + '.';
                    const result = ShaderMapGenerator.#processUniform(member, combinedName, structs, struct.name);

                    // assume no nested glsl arrays for now
                    mapEntries.push({name: result[0].name, data: result[0].data});
                }
            // single struct member
            } else {
                const combinedName = parentName + uniform.name + '.';
                const result = ShaderMapGenerator.#processUniform(member, combinedName, structs, struct.name);
                mapEntries.push(...result);
            }
        }
        return mapEntries;
    }

    /** creates a initial uniform value given it's type */
    static #initialUniformValue(dataType) {
        switch (dataType) {
            case 'mat2': return new Matrix2();
            case 'mat3': return new Matrix3();
            case 'mat4': return new Matrix4();
            case 'vec2': return new Vector2();
            case 'vec3': return new Vector3();
            case 'vec4': return new Vector4();
            case 'bool': return false;
            case 'int': return 0;
            case 'float': return 0.0;
            case 'sampler2D': return TextureManager.createDefault(Color.RED);
            default: return 0;
        }
    }
}