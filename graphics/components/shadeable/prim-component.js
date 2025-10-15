import { ShaderProgram } from "../../systems/index.js"
import { Color, Matrix2, Matrix3, Matrix4, Quaternion, Vector2, Vector3, Vector4 } from "../../utilities/index.js";
import Component from "../component.js";

/**
 * Represents a primitive glsl uniform value (float, vec3, mat4, etc...), not including arrays and texture samplers.
 */
export default class PrimComponent extends Component {
    static valid_JS_Types = [
        'number', 'boolean'
    ]
    static valid_Graphics_Types = [
        Vector2, Vector3, Vector4, 
        Matrix2, Matrix3, Matrix4,
        Quaternion, Color
    ]

    #data;

    /**
     * Create a new primitive component
     * @param {string} name the name of the integer component
     * @param {any} data the primitive data to store in the component
     */
    constructor(name, data) {
        super(name, [Component.Modifier.SHADABLE]);
        this.data = data;
    }
    
    /**
     * Set the value of this primitive component.
     * @param {any} newData the primitive value to set.
     */
    set data(newData) {
        if (!PrimComponent.isValid(newData)) {
            console.warn(`[PrimComponent] Expected 'newData' to be a valid primitive value. Unable to set value.`);
            this.#data = null;
            return;
        }
        this.#data = newData;
    }

    /**
     * Get the value of this primitive component.
     * @returns {any} the primitive associated with this material component 
     */
    get data() {
        return this.#data;
    }

    /**
     * Clone this primitive component.
     * @returns {PrimComponent} a new PrimComponent with the same data as this one.
     */
    clone() {
        const is_js_type = PrimComponent.valid_JS_Types.some(type => typeof value === type);
        if (is_js_type) {
            return new PrimComponent(this.#data.clone(), this.name);
        } else {
            return new PrimComponent(this.#data, this.name);
        }
    }

    /**
     * Apply this primitive to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     * @param {number} options.index the index to the glsl array of which this uniform is a value of. If this is not specified, it's assumed the uniform is not an array type.
     */
    applyToShader(shaderProgram, options={}) {
        const indexToken = typeof options.index === 'number' ? `[${options.index}]` : '';;
        const parentToken = typeof options.parentName === 'string' && 
                            options.parentName.trim() !== '' ? 
                            `${options.parentName}.` : '';
        const uniformName = parentToken + this.name + indexToken;

        if (shaderProgram.supports(uniformName)) {
            shaderProgram.setUniform(uniformName, this.#data);
        }
    }

    /**
     * Check if the provided value is valid for this component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    static isValid(value) {    
        const is_js_type = PrimComponent.valid_JS_Types.some(type => typeof value === type);
        const is_math_type = PrimComponent.valid_Graphics_Types.some(Type => value instanceof Type);

        return is_js_type || is_math_type;
    }
}
