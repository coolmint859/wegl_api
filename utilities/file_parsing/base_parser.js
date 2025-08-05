/**
 * A base class for file parsers.
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
     * @param {Uint8Array} currentBuffer The current buffer state. Is prepended with unprocessed data from the last call.
     * @param {boolean} isStreamDone A flag indicating if there are no more incoming buffer data.
     * @returns {object} A state object. Should hold any 'remainingData' and an 'isDone' flag - the flag signals to the stream processor that parsing is complete, and thus should terminate.
     */
    parse(currentBuffer, isStreamDone) {
        throw Error(`[Parser] A parser class derived from this one must implement the parse method.`);
    }

    /**
     * Returns the final parsed data. This method must be overridden.
     * @returns {any} The final parsed data.
     */
    getParsedData() {
        throw Error(`[Parser] A parser class derived from this one must implement the getParsedData method.`);
    }

    /**
     * Utility method for finding the index of a string of bytes in a Uint8Array
     * @param {Uint8Array} binData the array of data to search in
     * @param {Uint8Array} bytes the set of bytes to search for in the binary data
     * @param {number} start an index into the binary array for which to begin searching.
     * @param {number} end an index into the binary array for which to stop searching.
     * @returns {number} the index for which the bytes starts in the binary array. If the bytes are not in the array, -1 is returned.
     */
    static findByteIndex(binData, bytes, start, end) {
        if (bytes.length === 0) return start;
        if (bytes.length > end - start) return -1;

        for (let i = start; i <= end - bytes.length; i++) {
            let found = true;
            for (let j = 0; j < bytes.length; j++) {
                if (binData[i + j] !== bytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return i;
            }
        }
        return -1;
    }
}