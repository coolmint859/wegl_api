import Parser from "./base_parser.js";
import PLYParser from "./ply_parser.js";

/**
 * Reads a file and processes it in chunks, using a parser for parsing the data in the file. Useful for very large files.
 */
export default class StreamProcessor {
    static #parseMap = new Map([
        ['ply', PLYParser],
        // ['obj', OBJParser],
    ]);
    static MAX_READER_DONE_COUNT = 3;

    /**
     * Load a file using a reader, allowing the data to parsed in chunks.
     * @param {string} filePath the name of the file. It's extension is used to determine which parser to use.
     * @param {object} options file loading/parsing options
     * @param {AbortSignal} options.signal  signal determining whether to abort the streaming process
     * @returns {any} data that is created by the parser instance used with the file.
     */
    static async load(filePath, options) {
        if (typeof filePath !== 'string') {
            return Promise.reject(new Error("[StreamProcessor] Expected 'filePath' to be a non-empty string."));
        }
        // if (typeof options !== 'object' || !('signal' in options) || !(options.signal instanceof AbortSignal)) {
        //     return Promise.reject(new Error("[StreamProcessor] Expected 'options' to be an object with a 'signal' property, which is an instance of AbortSignal."));
        // }

        // get parser and initialize parsing state
        let parser;
        if (options && options.parser !== undefined && options.parser instanceof Parser) {
            parser = options.parser;
        } else {
            const extension = filePath.split('.').pop();
            if (StreamProcessor.#parseMap.has(extension)) {
                parser = new (StreamProcessor.#parseMap.get(extension))();
            } else {
                return Promise.reject(new Error(`[StreamProcessor] Expected type of file '${filePath}' to be a parsable file type.`))
            }
        }

        // fetch the file reader
        // const response = await fetch(filePath, { signal: options.signal });
        const response = await fetch(filePath);
        const fileReader = response.body.getReader();

        // initialize state
        let remainingData = new Uint8Array(0);
        let isParsingDone = false;
        let readerDoneCount = 0;

        // read in chunks and use parser to parse the chunks
        let result = await fileReader.read();
        while (!isParsingDone) {
            // this ensures the while loop always terminates regardless of the parser behavior.
            if (result.done) {
                readerDoneCount++;
                if (readerDoneCount >= StreamProcessor.MAX_READER_DONE_COUNT) {
                    return Promise.reject(new Error(`[StreamProcessor] Parser.parse() failed to signal completion of parsing logic despite having no more readable file data. Aborting.`));
                }
            }
            // if (options.signal.aborted) {
            //     return Promise.reject(new Error(`[StreamProcessor] External abort signal was set before parsing could complete.`))
            // }

            // get next chunk and combine with leftover data
            const dataChunk = result.value || new Uint8Array(0);
            const nextData = StreamProcessor.#combineBuffers(remainingData, dataChunk);

            // get next parse state from parser
            const parseState = parser.parse(nextData, result.done);
            if (typeof parseState !== 'object' || !('remainingData' in parseState) || !('isDone' in parseState)) {
                return Promise.reject(new Error(`[StreamProcessor] Expected parser.parse() to return an object with properties 'remainingData' and 'isDone', but either a property was missing or the return value was null.`))
            }
            isParsingDone = parseState.isDone;
            remainingData = parseState.remainingData;

            result = await fileReader.read();
        }

        // return the data the parser generated
        return parser.getParsedData();
    }

    /** prepends buffer1 onto buffer2 and returns the result. Assumes they are both Uint8Arrays */
    static #combineBuffers(buffer1, buffer2) {
        const totalLength = buffer1.length + buffer2.length;
        const combinedBuffer = new Uint8Array(totalLength);
        combinedBuffer.set(buffer1, 0);
        combinedBuffer.set(buffer2, buffer1.length);
        return combinedBuffer;
    }

    /**
     * Utility method for finding a string of bytes in a Uint8Array
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