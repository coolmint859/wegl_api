import Parser from "./base_parser.js";
import StreamProcessor from "./stream.js";

/**
 * Parses PLY files via a data stream, converting the data into a mesh object.
 * 
 * It first will parse the data into an interleaved array object, which is then processed further.
 * If the user specfies they want the data interleaved, then it will convert it to such.
 * 
 */
export default class PLYParser extends Parser {
    static State = Object.freeze({
        HEADER: 'header',
        DATA: 'data',
        DONE: 'done',
    })

    // this is used when the user specfies to not interleave data arrays
    static #propToArray = new Map([
        ['x', 'vertex'], ['y', 'vertex'], ['z', 'vertex'],
        ['s', 'uv'], ['t', 'uv'], ['u', 'uv'], ['v', 'uv'],
        ['nx', 'normal'], ['ny', 'normal'], ['nz', 'normal'],
        ['r', 'color'], ['g', 'color'], ['b', 'color'], ['a', 'color'],
    ])
    #currentState = PLYParser.State.HEADER;
    // #byteOffset = 0;

    // header info
    #elementSpecs = [];
    #plyFormat = {};
    #hasNormals = false;

    // data info
    #elementSpecIndex = 0;
    #elementIndex = 0;
    #tempListData = [];

    // data values;
    #meshData;
    #genNormals;
    #interleaved;

    /**
     * Create a new PLYParser instance.
     */
    constructor(options={}) {
        super();
        this.#genNormals = options.generateNormals ?? true; // default is to always generate normals
        this.#interleaved = options.vertexInterleaved ?? false;
        this.#meshData = {};
    }

    /**
     * Reset this PLYParser.
     */
    reset(options={}) {
        this.#genNormals = options.generateNormals ?? true;
        this.#interleaved = options.vertexInterleaved ?? false;

        this.#currentState = PLYParser.State.HEADER;
        this.#elementSpecs = [];
        this.#plyFormat = {};
        this.#hasNormals = false;

        this.#elementSpecIndex = 0;
        this.#elementIndex = 0;
        this.#tempListData = [];
        this.#meshData = {};
    }

    /**
     * get the mesh data after parsing is complete
     * @returns {any} a object containing mesh data converted into typed arrays
     */
    getParsedData() {
        // return this.#meshData;
        return { 
            state: this.#currentState, 
            header: { format: this.#plyFormat, elementSpecs: this.#elementSpecs, hasNormals: this.#hasNormals }, 
            meshState: { elementSpecIndex: this.#elementSpecIndex, elementIndex: this.#elementIndex, tempListData: this.#tempListData }, 
            meshData: { arrays: this.#meshData, tempList: this.#tempListData }
        };
    }

    /**
     * Parses PLY file data into mesh data
     * @param {DataView} dataView the current stream data to be parsed as a data view instance.
     * @param {boolean} isLastStream a flag indicating if there is any more stream data (true means no more data)
     * @returns {object} A state object holding any remaining unprocessed data and and isDone flag.
     */
    parse(dataView, isLastStream) {
        let byteOffset = 0;
        if (this.#currentState === PLYParser.State.HEADER) {
            byteOffset = this.#parseHeader(dataView);
        }
        if (this.#currentState === PLYParser.State.DATA) {
            if (this.#plyFormat.type === 'ascii') {
                byteOffset = this.#parseDataAscii(dataView, byteOffset);
            } else {
                throw new Error('[PLYParser] PLY files with the binary format are unsupported at this time.');
            }
        }

        // determine if parsing is done
        // TODO: add check to determine if all elements are accounted for
        let isParsingDone = false;
        if (isLastStream) { // && all elements accounted for
            this.#currentState = PLYParser.State.DONE; 
            isParsingDone = true;
        }

        const remainingData = new Uint8Array(dataView.buffer).subarray(byteOffset);
        return { remainingData, isDone: isParsingDone }
    }

    /** Parses the header of a PLY file */
    #parseHeader(dataView) {
        const decoder = new TextDecoder();
        const intBuffer = new Uint8Array(dataView.buffer);

        // split header from data if possible
        const endHeaderBinary = (new TextEncoder).encode('end_header\n');
        const endHeaderIndex = Parser.findByteIndex(intBuffer, endHeaderBinary, 0, intBuffer.length);
        let headerString;
        if (endHeaderIndex !== -1) {
            const dataStartIndex = endHeaderIndex + 'end_header\n'.length;
            const headerBinary = intBuffer.subarray(0, dataStartIndex);
            headerString = decoder.decode(headerBinary);
        } else {
            headerString = decoder.decode(intBuffer);
        }
        let endHeaderFound = false;

        // begin line parsing loop
        let lineStart = 0, lineEnd;
        let remainingDataIndex = 0;
        while ((lineEnd = headerString.indexOf('\n', lineStart)) !== -1) {
            const line = headerString.substring(lineStart, lineEnd);
            // remove comments
            const headerLine = line.split("//")[0].trim();
            if (headerLine == "") {
                lineStart = lineEnd + 1;
                continue;
            }

            const tokens = headerLine.split(' ');
            if (tokens[0] === 'end_header') {
                remainingDataIndex = lineEnd+1;
                endHeaderFound = true;
                break;
            } else if (tokens[0] === 'format') {
                this.#plyFormat.type = tokens[1];
                this.#plyFormat.version = tokens[2];
            } else if (tokens[0] === 'element') {
                this.#elementSpecs.push({ 
                    name: tokens[1], 
                    count: Number(tokens[2]),
                    propertySpecs: []
                });
            } else if (tokens[0] === 'property') {
                const currElementIndex = this.#elementSpecs.length - 1;
                const propName = tokens[tokens.length - 1];
                if (propName === 'nx' || propName === 'ny' || propName === 'nz') {
                    this.#hasNormals = true;
                }

                let prop = { name: propName, type: tokens[1] };
                if (tokens[1] === 'list') {
                    prop.dataType = tokens[2] + " " + tokens[3];
                }
                this.#elementSpecs[currElementIndex].propertySpecs.push(prop);
            }

            lineStart = lineEnd + 1;
            remainingDataIndex = lineStart;
        }

        // update state if the end_header line was found
        if (endHeaderFound) {
            this.#currentState = PLYParser.State.DATA;
            this.#createMeshArrays();
        }

        return remainingDataIndex;
    }

    /** Parses the body of a ply file as ascii text */
    #parseDataAscii(dataView, byteOffset) {
        const intBuffer = new Uint8Array(dataView.buffer);
        const textData = (new TextDecoder).decode(intBuffer.subarray(byteOffset));

        let lineStart = 0, lineEnd;
        let remainingDataIndex = byteOffset;
        while ((lineEnd = textData.indexOf('\n', lineStart)) !== -1) {
            const line = textData.substring(lineStart, lineEnd);
            // remove comments
            const dataLine = line.split("//")[0].trim();
            if (dataLine == "") {
                lineStart = lineEnd + 1;
                continue;
            }

            const elementIndex = this.#elementSpecIndex;
            const currentElementSpec = this.#elementSpecs[elementIndex];
            const lineValues = dataLine.split(" ").map(token => Number(token));
            this.#parseDataLine(lineValues, currentElementSpec);

            // update element indices
            if (this.#elementIndex+1 >= this.#elementSpecs[elementIndex].count) {
                this.#elementSpecIndex++;
                this.#elementIndex = 0;
            } else {
                this.#elementIndex++;
            }
            lineStart = lineEnd + 1;
            remainingDataIndex = lineStart + byteOffset;
        }

        return remainingDataIndex;
    }

    #parseDataLine(lineValues, currentElementSpec) {
        const elementName = currentElementSpec.name;
        let arrayIndex = currentElementSpec.propertySpecs.length * this.#elementIndex

        for (const value of lineValues) {
            if (elementName in this.#meshData) {
                this.#meshData[elementName][arrayIndex] = value;
                arrayIndex++;
            }
        }
        if (!(elementName in this.#meshData)) {
            if (elementName in this.#tempListData) {
                this.#tempListData[elementName].push(lineValues);
            } else {
                this.#tempListData[elementName] = [lineValues];
            }
        }
    }

    /** creates the mesh data arrays after the header's been fully parsed. */
    #createMeshArrays() {
        for (const elementSpec of this.#elementSpecs) {
            let propCount = 0;
            for (const propertySpec of elementSpec.propertySpecs) {
                if (propertySpec.type === 'list') continue;
                propCount++;
            }
            if (propCount > 0) { // if the element only has a list property (like face data), then skip it
                const arraySize = elementSpec.count * propCount;
                this.#meshData[elementSpec.name] = new Float32Array(arraySize);
            }
        }
    }
}