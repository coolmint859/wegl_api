/**
 * An interface for file parsers.
 */
export default class Parser {
    /**
     * Reset the state of the parser, allowing it to be used on another file. This method must be overridden.
     */
    reset() {
        throw Error(`[Parser] A parser class derived from this one must implement the reset method.`);
    }

    /**
     * The core parsing logic. This method must be overridden.
     * @param {Uint8Array} currDataChunk The current buffer state.
     * @param {boolean} isStreamDone A flag indicating if the stream has ended.
     * @returns {object} A state object. Should hold any remaining unprocessed data and and isDone flag.
     */
    parse(currDataChunk, isStreamDone) {
        throw Error(`[Parser] A parser class derived from this one must implement the parse method.`);
    }

    /**
     * Returns the final parsed data. This method must be overridden.
     * @returns {any} The final parsed data.
     */
    getParsedData() {
        throw Error(`[Parser] A parser class derived from this one must implement the getParsedData method.`);
    }
}