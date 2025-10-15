import { TextureHandler } from "../../systems/index.js";
import { Vector2, Vector3, Vector4 } from '../math/vector.js'
import { Matrix2, Matrix3 } from "../math/matrix.js";
import Matrix4 from '../math/matrix4.js';
import Color from '../math/color.js'

/** 
 * Generates an alias map, data map, and capability map from a shader config 
 * */
export default class ShaderMapGenerator {
    /**
     * Generate a set of maps for shader uniforms from a given shader config object
     * @param {object} shaderConfig the config associated with the shader instance
     * @returns {object} an object containing maps between uniform names and aliases to uniform properties
     */
    static generate(shaderConfig) {
        const mapGenerator = new MapGenerator(shaderConfig);
        return mapGenerator.generate();
    }
}

/**
 * Helper class that builds the maps
 */
class MapGenerator {
    constructor(shaderConfig) {
        this.shaderConfig = shaderConfig;
        this.structs = new Map(shaderConfig.structs.map(s => [s.name, s]));
        this.propertyMap = new Map();

        this.aliasMap = new Map();
        this.dataMap = new Map();
        this.capabilityMap = new Map();
    }

    generate() {
        // add uniforms to maps
        for (const uniform of this.shaderConfig.uniforms) {
            this.#processUniform(uniform, "", uniform.name, "");
        }

        // add attributes to maps
        for (const attribute of this.shaderConfig.attributes) {
            this.#processAttribute(attribute);
        }

        return { 
            aliasMap: this.aliasMap, 
            dataMap: this.dataMap,
            capabilityMap: this.capabilityMap
        }
    }

    #populateMaps(name, entry) {
        this.aliasMap.set(name, entry.trueName);
        this.capabilityMap.set(name, entry.capability);
        this.dataMap.set(entry.trueName, {
            value: this.#initialPropertyValue(entry.type),
            type: entry.type, 
            location: entry.location, 
            isAttr: entry.isAttr
        });
    }

    #processAttribute(attribute) {
        const entry = {
            trueName: attribute.name,
            type: attribute.type,
            location: attribute.location ?? undefined,
            isAttr: true,
            capability: attribute.name
        }

        if (Array.isArray(attribute.aliases)) {
        for (const alias of [attribute.name, ...attribute.aliases]) {
            this.#populateMaps(alias, entry);
        }
        } else {
            this.#populateMaps(attribute.name, entry);
        }
    }

    /** recursively constucts a uniforms' full name and aliases */
    #processUniform(uniform, parentName, capability, trueName) {
        const struct = this.structs.get(uniform.type);

        if (struct === undefined) {
            if (uniform.isArray) {
                this.#processArrayUniform(uniform, parentName, capability);
            } else {
                this.#processPrimitiveUniform(uniform, parentName, capability, trueName);
            }
        } else {
            this.#processStruct(struct, uniform, parentName);
        }
    }

    /** creates uniform map entries for an array of primitive uniforms */
    #processArrayUniform(uniform, parentName, capability) {
        for (let i = 0; i < uniform.maxSize; i++) {
            const entry = {
                trueName: `${parentName}${uniform.name}[${i}]`,
                type: uniform.type,
                location: uniform.location ?? undefined,
                isAttr: false,
                capability: capability
            };

            if (Array.isArray(uniform.aliases)) {
                for (const alias of [uniform.name, ...uniform.aliases]) {
                    const aliasedName = `${parentName}${alias}[${i}]`;
                    this.#populateMaps(aliasedName, entry);
                }
            } else {
                this.#populateMaps(entry.trueName, entry)
            }
        }
    }

    /** creates uniform map entries for a primitive uniform */
    #processPrimitiveUniform(uniform, parentName, capability, trueName) {
        const canonicalName = trueName + uniform.name;
        const entry = {
            trueName: canonicalName,
            type: uniform.type,
            location: uniform.location ?? undefined,
            isAttr: false,
            capability: capability === "" ? canonicalName : capability
        };

        if (Array.isArray(uniform.aliases)) {
            for (const alias of [uniform.name, ...uniform.aliases]) {
                const aliasedName = parentName + alias;
                this.#populateMaps(aliasedName, entry);
            }
        } else {
            this.#populateMaps(canonicalName, entry);
        }
    }

    /** creates uniform map entries for struct member uniforms */
    #processStruct(struct, uniform, parentName) {
        const processMembers = (namePostfix, capability) => {
            for (const member of struct.members) {
                const canonicalName = `${parentName}${uniform.name}${namePostfix}.`;
                this.#processUniform(member, canonicalName, capability, canonicalName);

                if (!Array.isArray(uniform.aliases)) continue;

                for (const alias of uniform.aliases) {
                    const aliasedName = `${parentName}${alias}${namePostfix}.`;
                    this.#processUniform(member, aliasedName, capability, canonicalName);
                }
            }
        }
        if (uniform.isArray) {
            for (let i = 0; i < uniform.maxSize; i++) {
                processMembers(`[${i}]`, uniform.type);
            }
        } else {
            processMembers('', '');
        }
    }

    /** creates a initial uniform value given it's type */
    #initialPropertyValue(dataType) {
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
            case 'sampler2D': return TextureHandler.getDefault(Color.RED);
            default: return 0;
        }
    }
}