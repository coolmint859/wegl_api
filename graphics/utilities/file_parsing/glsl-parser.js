import Parser from "./base_parser.js";

/** Parses a raw glsl file. Designed to work directly with StreamReader. */
export default class GLSLParser extends Parser {
    static State = Object.freeze({
        READING: 'reading',
        DONE: 'done',
        FAILED: 'failed',
    })

    #currentState;
    #glsl_source;
    #textDecoder;

    constructor() {
        super();
        this.#currentState = GLSLParser.State.READING;
        this.#glsl_source = "";
        this.#textDecoder = new TextDecoder();
    }
    
    /**
     * Reset this parser.
     */
    reset() {
        this.#currentState = GLSLParser.State.READING;
        this.#glsl_source = "";
        this.#textDecoder = new TextDecoder();
    }

    /**
     * Parses a glsl file into a string to be compiled and linked into a webgl shader program.
     * @param {DataView} dataView The current buffer wrapped in a DataView instance. The buffer is prepended with any unprocessed data from the last call.
     * @param {boolean} isStreamDone A flag indicating if there is any more incoming buffer data.
     * @returns {object} A state object. Should hold any 'remainingData' as an ArrayBufferLike and an 'isDone' flag - the flag signals to the caller that parsing is complete, and thus should terminate.
     */
    parse(dataView, isStreamDone) {
        if (dataView.buffer.byteLength === 0 && isStreamDone) {
            try {
                this.#currentState = GLSLParser.State.DONE;
                return { remainingData: new Uint8Array(0), isDone: isStreamDone }
            } catch (error) {
                this.#currentState = GLSLParser.State.FAILED;
                throw new Error('[ShaderConfigParser] Malformed or incomplete json file.');
            }
        }

        const chunkString = this.#textDecoder.decode(dataView.buffer);
        this.#glsl_source = this.#glsl_source.concat(chunkString);

        if (isStreamDone) {
            try {
                this.#currentState = GLSLParser.State.DONE;
            } catch (error) {
                this.#currentState = GLSLParser.State.FAILED;
                throw new Error('[ShaderConfigParser] Malformed or incomplete json file.');
            }
        }

        return { remainingData: new Uint8Array(0), isDone: this.#currentState === GLSLParser.State.DONE }
    }

    /**
     * Returns the final parsed/processed data.
     * @returns {string} The final parsed data.
     */
    getData() {
        return this.#glsl_source;
    }
}
