import Parser from "./base_parser.js";
import StreamProcessor from "./stream.js";

/**
 * Parses PLY files via a data stream, converting the data into a mesh object.
 * 
 */
export default class PLYParser extends Parser {
    static State = Object.freeze({
        HEADER: 'header',
        DATA: 'data',
        DONE: 'done',
    })

    #state;
    #meshData;
    #header;

    /**
     * Create a new PLYParser instance.
     */
    constructor() {
        super();
        this.#state = PLYParser.State.HEADER;
        this.#header = { elements: [], format: {}, hasNormals: false };
        this.#meshData = { vertexArray: null, normalArray: null, indexArray: null }
    }

    /**
     * Reset this PLYParser.
     */
    reset() {
        this.#state = PLYParser.State.HEADER;
        this.#header = { elements: [], format: {}, hasNormals: false };
        this.#meshData = { vertexArray: null, normalArray: null, indexArray: null }
    }

    /**
     * get the mesh data after parsing is complete
     * @returns {any} a object containing mesh data converted into typed arrays
     */
    getParsedData() {
        console.log(this.#header);
        console.log(this.#meshData);
        return this.#meshData;
    }

    /**
     * Parses PLY file data into mesh data
     * @param {Uint8Array} currDataChunk the current stream data to be parsed.
     * @param {boolean} isStreamDone a flag indicating if there is any more stream data
     * @returns {object} A state object holding any remaining unprocessed data and and isDone flag.
     */
    parse(currDataChunk, isStreamDone) {
        let currData = currDataChunk;
        if (currData.length > 0) { // only call parsing functions if there is data to parse
            // parse header
            if (this.#state === PLYParser.State.HEADER) {
                currData = this.#parseHeader(currData);
            }
            // parse body/data
            if (this.#state === PLYParser.State.DATA) {
                if (this.#header.format.type === 'ascii') {
                    currData = this.#parseBodyAscii(currData);
                } else {
                    currData = this.#parseBodyBinary(currData);
                }
            }
        }

        // determine if parsing is done
        // TODO: add check to determine if all elements are accounted for
        let isParsingDone = false;
        if (isStreamDone) { // && all elements accounted for... 
            isParsingDone = true;
        }

        return {
            remainingData: currData,
            isDone: isParsingDone
        }
    }

    /** Parses the header of a PLY file */
    #parseHeader(currDataChunk) {
        console.log("Parsing PLY header!");
        const decoder = new TextDecoder();

        // split header from data if possible
        const endHeaderBinary = (new TextEncoder).encode('end_header\n');
        const endHeaderIndex = Parser.findByteIndex(currDataChunk, endHeaderBinary, 0, currDataChunk.length);
        let headerString;
        if (endHeaderIndex !== -1) {
            const dataStartIndex = endHeaderIndex + 'end_header\n'.length;
            const headerBinary = currDataChunk.subarray(0, dataStartIndex);
            headerString = decoder.decode(headerBinary);
            console.log(headerString);
        } else {
            headerString = decoder.decode(currDataChunk);
        }
        let endHeaderFound = false;

        // begin line parsing loop
        let lineStart = 0, lineEnd;
        while ((lineEnd = headerString.indexOf('\n', lineStart)) !== -1) {
            const line = headerString.substring(lineStart, lineEnd);
            if (line === 'end_header') {
                endHeaderFound = true;
                break;
            }

            const tokens = line.split(' ');
            if (tokens[0] === 'format') {
                this.#header.format.type = tokens[1];
                this.#header.format.version = tokens[2];
            } else if (tokens[0] === 'element') {
                this.#header.elements.push({ 
                    name: tokens[1], 
                    count: Number(tokens[2]),
                    properties: []
                });
            } else if (tokens[0] === 'property') {
                const currElementIndex = this.#header.elements.length - 1;
                const propName = tokens[tokens.length - 1];
                if (propName === 'nx' || propName === 'ny' || propName === 'nz') {
                    this.#header.hasNormals = true;
                }

                let prop = {};
                if (tokens[1] === 'list') {
                    prop[propName] = { type: tokens[1], dataType: tokens[2] + " " + tokens[3] }
                } else {
                    prop[propName] = tokens[1];
                }
                this.#header.elements[currElementIndex].properties.push(prop);
            }
            lineStart = lineEnd + 1;
        }

        // update state if the end_header line was found
        if (endHeaderFound) {
            console.log("Switching to data state.")
            this.#state = PLYParser.State.DATA;
        }

        // return rest of data after header
        return currDataChunk.subarray(lineEnd + 1);
    }

    /** Parses the body of a ply file as ascii text */
    #parseBodyAscii(currDataChunk) {
        console.log("Parsing data ascii!");
        console.log((new TextDecoder).decode(currDataChunk));
        return new Uint8Array();
    }

    /** Parses the body of a ply file as binary data */
    #parseBodyBinary(currDataChunk) {
        console.log("Parsing data binary!")
        return new Uint8Array();
    }
}