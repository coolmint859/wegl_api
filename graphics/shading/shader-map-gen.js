import TextureManager from "../modeling/texture-manager.js";
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
        const mapGenerator = new PropertyMapGenerator(shaderConfig);
        const propertyMap = mapGenerator.generateMap();

        return { 
            aliasMap: ShaderMapGenerator.#generateAliasMap(propertyMap), 
            dataMap: ShaderMapGenerator.#generateDataMap(propertyMap), 
            capabilityMap: ShaderMapGenerator.#generateCapabilityMap(propertyMap), 
            capabilityList: ShaderMapGenerator.#generateCapabilityList(propertyMap) 
        };
    }

    static #generateAliasMap(propertyMap) {
        const aliasMap = new Map() 
        for (const [name, property] of propertyMap) {
            aliasMap.set(name, property.trueName);
        }
        return aliasMap;
    }

    static #generateDataMap(propertyMap) {
        const dataMap = new Map()
        for (const property of propertyMap.values()) {
            if (dataMap.has(property.trueName)) continue;

            dataMap.set(property.trueName, {
                value: ShaderMapGenerator.#initialPropertyValue(property.type),
                type: property.type,
                isAttr: property.isAttr ?? false,
                location: property.location
            });
        }
        return dataMap;
    }

    static #generateCapabilityMap(propertyMap) {
        const capabilityMap = new Map();
        for (const [name, property] of propertyMap) {
            capabilityMap.set(name, property.parentType);
        }
        return capabilityMap;
    }

    static #generateCapabilityList(propertyMap) {
        const capabilities = new Set();
        for (const property of propertyMap.values()) {
            capabilities.add(property.parentType);
        }
        return Array.from(capabilities);
    }

        /** creates a initial uniform value given it's type */
    static #initialPropertyValue(dataType) {
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
            case 'sampler2D': return TextureManager.getDefault(Color.RED);
            default: return 0;
        }
    }
}

/**
 * Helper class that handles flattening the shader config into a property map.
 */
class PropertyMapGenerator {
    constructor(shaderConfig) {
        this.shaderConfig = shaderConfig;
        this.structs = new Map(shaderConfig.structs.map(s => [s.name, s]));
        this.propertyMap = new Map();
    }

    generateMap() {
        // add uniforms to property map
        for (const uniform of this.shaderConfig.uniforms) {
            this.#processUniform(uniform, "", uniform.name, "");
        }

        // add attributes to property map
        for (const attribute of this.shaderConfig.attributes) {
            this.#processAttribute(attribute);
        }

        return this.propertyMap;
    }

    /** recursively constucts a uniforms' full name and aliases */
    #processUniform(uniform, parentName, parentType, truePath) {
        const struct = this.structs.get(uniform.type);

        if (struct === undefined) {
            if (uniform.isArray) {
                this.#processArrayUniform(uniform, parentName, parentType);
            } else {
                this.#processPrimitiveUniform(uniform, parentName, parentType, truePath);
            }
        } else {
            this.#processStruct(struct, uniform, parentName);
        }
    }

    #processAttribute(attribute) {
        let attribData = {
            trueName: attribute.name,
            type: attribute.type,
            location: attribute.location ?? null,
            isAttr: true,
            parentType: attribute.name,
        };
        this.propertyMap.set(attribute.name, attribData);

        if (Array.isArray(attribute.aliases)) {
            for (const alias of attribute.aliases) {
                this.propertyMap.set(alias, attribData);
            }
        }
    }

    /** creates uniform map entries for an array of primitive uniforms */
    #processArrayUniform(uniform, parentName, parentType) {
        for (let i = 0; i < uniform.maxSize; i++) {
            const fullName = `${parentName}${uniform.name}[${i}]`;
            let data = {
                trueName: fullName,
                type: uniform.type,
                location: uniform.location ?? undefined,
                isAttr: false,
                parentType: parentType
            };

            if (Array.isArray(uniform.aliases)) {
                for (const alias of [uniform.name, ...uniform.aliases]) {
                    const aliasedName = `${parentName}${alias}[${i}]`;
                    this.propertyMap.set(aliasedName, data);
                }
            } else {
                this.propertyMap.set(fullName, data);
            }
        }
    }

    /** creates uniform map entries for a primitive uniform */
    #processPrimitiveUniform(uniform, parentName, parentType, trueName) {
        const canonicalName = trueName + uniform.name;
        let data = {
            trueName: canonicalName,
            type: uniform.type,
            location: uniform.location ?? undefined,
            isAttr: false,
            parentType: parentType === "" ? canonicalName : parentType
        };

        if (Array.isArray(uniform.aliases)) {
            for (const alias of [uniform.name, ...uniform.aliases]) {
                const aliasedName = parentName + alias;
                this.propertyMap.set(aliasedName, data);
            }
        } else {
            this.propertyMap.set(canonicalName, data);
        }
    }

    /** creates uniform map entries for struct member uniforms */
    #processStruct(struct, uniform, parentName) {
        for (const member of struct.members) {
            // struct of an array
            if (uniform.isArray) {
                for (let i = 0; i < uniform.maxSize; i++) {
                    const canonicalName = `${parentName}${uniform.name}[${i}].`;
                    this.#processUniform(member, canonicalName, uniform.type, canonicalName);

                    if (Array.isArray(uniform.aliases)) {
                        for (const alias of uniform.aliases) {
                            const aliasedName = `${parentName}${alias}[${i}].`;
                            this.#processUniform(member, aliasedName, uniform.type, canonicalName);
                        }
                    }
                }
            // single struct member
            } else {
                const canonicalName = `${parentName}${uniform.name}.`;
                this.#processUniform(member, canonicalName, "", canonicalName);

                if (Array.isArray(uniform.aliases)) {
                    for (const alias of uniform.aliases) {
                        const aliasedName = `${parentName}${alias}.`;
                        this.#processUniform(member, aliasedName, "", canonicalName);
                    }
                }
            }
        }
    }
}