import Parser from "./base_parser.js";

export default class JSONParser extends Parser {
    static State = Object.freeze({
        READING: 'reading',
        DONE: 'done',
        FAILED: 'failed',
    })

    #currentState;
    #shaderConfigString;
    #textDecoder;

    constructor() {
        super();
        this.#currentState = JSONParser.State.READING;
        this.#shaderConfigString = "";
        this.#textDecoder = new TextDecoder();
    }
    
    /**
     * Reset this parser.
     */
    reset() {
        this.#currentState = JSONParser.State.READING;
        this.#shaderConfigString = "";
        this.#textDecoder = new TextDecoder();
    }

    /**
     * parses a json file into a javascript object
     * @param {DataView} dataView The current buffer wrapped in a DataView instance. The buffer is prepended with any unprocessed data from the last call.
     * @param {boolean} isStreamDone A flag indicating if there is any more incoming buffer data.
     * @returns {object} A state object. Should hold any 'remainingData' as an ArrayBufferLike and an 'isDone' flag - the flag signals to the caller that parsing is complete, and thus should terminate.
     */
    parse(dataView, isStreamDone) {
        if (dataView.buffer.byteLength === 0 && isStreamDone) {
            try {
                this.#currentState = JSONParser.State.DONE;
                return { remainingData: new Uint8Array(0), isDone: isStreamDone }
            } catch (error) {
                this.#currentState = ShaderConfigParser.State.FAILED;
                throw new Error('[ShaderConfigParser] Malformed or incomplete json file.');
            }
        }

        const chunkString = this.#textDecoder.decode(dataView.buffer);
        this.#shaderConfigString = this.#shaderConfigString.concat(chunkString);

        if (isStreamDone) {
            try {
                this.#currentState = JSONParser.State.DONE;
            } catch (error) {
                this.#currentState = ShaderConfigParser.State.FAILED;
                throw new Error('[ShaderConfigParser] Malformed or incomplete json file.');
            }
        }

        return { remainingData: new Uint8Array(0), isDone: this.#currentState === JSONParser.State.DONE }
    }

    /**
     * Returns the final parsed/processed data. This method must be overridden.
     * @returns {Map} The final parsed data.
     */
    getData() {
        return JSON.parse(this.#shaderConfigString);
    }
}