import Component from "../component.js";
import ArrayComponent from "../basic/array-component.js";

export default class WaveComponent extends Component {
    #waveComponents;
    #maxNumWaves = 20;

    /**
     * Get the names that the array components should have for a WaveComponent instance
     */
    static get waveCompNames() {
        return ['direction', 'wavelength', 'angularFreq', 'amplitude', 'phase']
    }

    constructor(name, components=[]) {
        super(name, [Component.Modifier.SHADEABLE])
        this.value = components;
    }

    /**
     * Set the data array of this array component.
     * @param {object} params the wave data parameters to set
     */
    set value(components=[]) {
        if (!this.validValue(components)) {
            console.warn(`[ArrayComponent] Expected 'components' to be an array of known array components. Unable to set value.`);
            return;
        }

        this.#waveComponents = [];
        components.forEach(comp => {
            this.#waveComponents.push(comp);
            comp.parentContainer = this;
        });
    }

    /**
     * Get the value of this boolean component.
     * @returns {boolean} the boolean associated with this material component 
     */
    get value() {
        return this.#waveComponents;
    }

    /**
     * Check if the provided value is valid for this component
     * @param {any} value the value to check
     * @returns {boolean} true if the value is a valid type, false otherwise
     */
    validValue(value) {
        if (!Array.isArray(value)) return false;

        let length = value[0].length;
        for (const comp of value) {
            const validName = WaveComponent.waveCompNames.includes(comp.name);
            const isArrayComp = comp instanceof ArrayComponent;

            if (!validName || !isArrayComp) return false;

            if (comp.length !== length || comp.length > this.#maxNumWaves) return false;
        }
        return true;
    }

    /**
     * Clone this component.
     * @param {boolean} deepCopy since booleans are primitives, their values are always 'cloned'.
     * @returns {WaveComponent} a new WaveComponent with the same wave data as this one.
     */
    clone(deepCopy = false) {
        const waveComps = this.#waveComponents.map(comp => {
            deepCopy ? comp.clone() : comp;
        })
        return new WaveComponent(this.name, waveComps);
    }

    /**
     * Apply this wave component to a shader program.
     * @param {ShaderProgram} shaderProgram the shader to apply the component to. Should already be in use.
     * @param {object} options options for how to the apply the component to the shader
     * @param {string} options.parentName the name of this component's parent container, default is an empty string
     */
    applyToShader(shaderProgram, options={}) {
        for (const comp of this.#waveComponents) {
            comp.applyToShader(shaderProgram, { parentName: this.name });
        }
        shaderProgram.setUniform('numWaves', this.#waveComponents[0].length);
    }
}