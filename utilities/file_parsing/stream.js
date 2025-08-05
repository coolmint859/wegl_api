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
     * set the default parser for files that contain the given extension. Replaces existing defaults.
     * @param {string} extension the extension that this parser will be associated with. Files with this extension will use the given parser if not overriden when load() is called.
     * @param {Function} parserClass a constuctor function for a derived class of Parser. This will be instantiated with each load call.
     * @returns {boolean} true if the default parser was set, false otherwise.
     */
    static setDefaultParser(extension, parserClass) {
        if (typeof extension !== 'string' || extension.trim() === '') {
            console.error(`[StreamProcessor] Expected 'extension' to be a non-empty string. Cannot register parser class.`);
            return false;
        }
        if (typeof parserClass !== 'function') {
            console.error(`[StreamProcessor] Expected 'parserClass' to be constructor function for a derived class of Parser. Cannot register parser class.`);
            return false;
        }
        if (StreamProcessor.#parseMap.has(extension)) {
            console.log(`[StreamProcessor] Replacing Parser class for extension '${extension}.`);
        }
        StreamProcessor.#parseMap.set(extension, parserClass);
    }

    /**
     * Load a file using a reader, allowing the file to parsed by streaming the data.
     * @param {string} filePath the path/url to the file.
     * @param {object} options file loading/parsing options
     * @param {AbortSignal} options.signal signal determining whether to abort the streaming process
     * @param {Parser} options.parser a parser instance to use to parse the data in the file. If one is not given, the parser is inferred from the file's extension and a default parser is chosen.
     * @returns {any} data that is created by the parser instance used with the file.
     */
    static async load(filePath, options={}) {
        if (typeof filePath !== 'string') {
            return Promise.reject(new Error("[StreamProcessor] Expected 'filePath' to be a non-empty string."));
        }

        // get parser and initialize parsing state
        let parser;
        if (options.parser && options.parser instanceof Parser) {
            parser = options.parser;
        } else {
            const extension = filePath.split('.').pop();
            if (StreamProcessor.#parseMap.has(extension)) {
                parser = new (StreamProcessor.#parseMap.get(extension))();
            } else {
                return Promise.reject(new Error(`[StreamProcessor] Expected type of file '${filePath}' to be a parsable file type.`))
            }
        }

        try {
            // fetch the file reader
            let response;
            if (options.signal) {
                response = await fetch(filePath, { signal: options.signal });
            } else {
                response = await fetch(filePath);
            }
            const fileReader = response.body.getReader();

            // initialize state
            const streamState = { 
                buffer: new Uint8Array(0), 
                isParsingDone: false, 
                doneCount: 0
            }

            // read in chunks and use parser to parse the chunks
            let result = await fileReader.read();
            while (!streamState.isParsingDone) {
                // this ensures the while loop always terminates regardless of the parser behavior.
                if (result.done) {
                    streamState.doneCount++;
                    if (streamState.doneCount >= StreamProcessor.MAX_READER_DONE_COUNT) {
                        return Promise.reject(new Error(`[StreamProcessor] Parser.parse() failed to signal completion of parsing logic despite having no more readable file data. Aborting.`));
                    }
                }
                if (options.signal && options.signal.aborted) {
                    return Promise.reject(new Error(`[StreamProcessor] External abort signal was set before parsing could complete.`))
                }

                // get next chunk and combine with leftover data, convert to dataview instance
                const dataChunk = result.value || new Uint8Array(0);
                const nextData = StreamProcessor.#combineBuffers(streamState.buffer, dataChunk);
                const dataView = new DataView(nextData.buffer);

                // get next parse state from parser
                const parseState = parser.parse(dataView, result.done);
                if (typeof parseState !== 'object' || !('remainingData' in parseState) || !('isDone' in parseState)) {
                    return Promise.reject(new Error(`[StreamProcessor] Expected parser.parse() to return an object with properties 'remainingData' and 'isDone', but either a property was missing or the return value was null.`))
                }
                streamState.isParsingDone = parseState.isDone;
                streamState.buffer = parseState.remainingData;

                // get the next reader result
                result = await fileReader.read();
            }

            // return the data the parser generated
            return parser.getParsedData();
        } catch (error) {
            return Promise.reject(new Error(`[StreamProcessor] An error occured while attempting to fetch/read stream data: ${error}`));
        }
    }

    /** prepends buffer1 onto buffer2 and returns the result. Assumes they are both Uint8Arrays */
    static #combineBuffers(buffer1, buffer2) {
        const totalLength = buffer1.length + buffer2.length;
        const combinedBuffer = new Uint8Array(totalLength);
        combinedBuffer.set(buffer1, 0);
        combinedBuffer.set(buffer2, buffer1.length);
        return combinedBuffer;
    }
}