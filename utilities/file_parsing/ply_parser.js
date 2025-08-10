import Parser from "./base_parser.js";

/**
 * Parses PLY files via a data stream, converting the data into a mesh object.
 * 
 * It always will parse the data into an interleaved array object. If the user requested
 * it to not be interleaved, then it is further separated into invididual arrays.
 * 
 */
export default class PLYParser extends Parser {
    static State = Object.freeze({
        HEADER: 'header',
        DATA: 'data',
        DONE: 'done',
        FAILED: 'failed',
    })

    // this is used when the user specfies to not interleave data arrays
    static #propToArrayName = new Map([
        ['x', 'vertex'], ['y', 'vertex'], ['z', 'vertex'],
        ['vx', 'vertex'], ['vy', 'vertex'], ['vz', 'vertex'],
        ['s', 'uv'], ['t', 'uv'], ['u', 'uv'], ['v', 'uv'],
        ['nx', 'normal'], ['ny', 'normal'], ['nz', 'normal'],
        ['r', 'color'], ['g', 'color'], ['b', 'color'], ['a', 'color'],
        ['vertex_index', 'index'], ['vertex_indices', 'index'],
        ['coordinates', 'vertex'], ['vertex_coordinates', 'vertex'],
        ['normal_coordinates', 'normal'], ['normals', 'normal'],
        ['uv_coordinates', 'uv'], ['uvs', 'uv']
    ]);

    // state
    #currentState = PLYParser.State.HEADER;

    // header info
    #elementSpecs = [];
    #plyFormat = {};
    #hasNormals = false;

    // data info
    #elementSpecIndex = 0;
    #elementIndex = 0;
    #listProperties = {};

    // data values;
    #elementData;
    #genNormals;
    #interleaved;

    /**
     * Create a new PLYParser instance.
     */
    constructor(options={}) {
        super();
        this.#genNormals = options.generateNormals ?? true; // default is to always generate normals
        this.#interleaved = options.interleaveArrays ?? false;
        this.#elementData = {};
    }

    /**
     * Reset this PLYParser.
     * @returns {PLYParser} a reference to this parser instance
     */
    reset(options={}) {
        if (options.includeOptions) {
            this.#genNormals = options.generateNormals ?? true;
            this.#interleaved = options.vertexInterleaved ?? false;
        }

        this.#currentState = PLYParser.State.HEADER;
        this.#elementSpecs = [];
        this.#plyFormat = {};
        this.#hasNormals = false;

        this.#elementSpecIndex = 0;
        this.#elementIndex = 0;
        this.#listProperties = {};
        this.#elementData = {};

        return this;
    }

    /**
     * get the mesh data after parsing is complete
     * @returns {any} a object containing mesh data converted into typed arrays
     */
    getParsedData() {
        // return this.#processMeshData();
        const meshData = this.#processMeshData();
        return { 
            state: this.#currentState, 
            header: { format: this.#plyFormat, elementSpecs: this.#elementSpecs, hasNormals: this.#hasNormals }, 
            meshState: { elementSpecIndex: this.#elementSpecIndex, elementIndex: this.#elementIndex }, 
            parsedData: { dataViews: this.#elementData, listPropData: this.#listProperties },
            processedMeshData: meshData
        };
    }

    /**
     * Parses PLY file data into mesh data
     * @param {DataView} dataView the current stream data to be parsed as a data view instance.
     * @param {boolean} isLastStream a flag indicating if there is any more stream data (true means no more data)
     * @returns {object} A state object holding any remaining unprocessed data and and isDone flag.
     */
    parse(dataView, isLastStream) {
        if (dataView.buffer.byteLength === 0 && isLastStream) {
            this.#currentState = PLYParser.State.DONE;
            return { remainingData: new Uint8Array(0), isDone: isLastStream }
        }

        let byteOffset = 0;
        if (this.#currentState === PLYParser.State.HEADER) {
            byteOffset = this.#parseHeader(dataView);
        }
        if (this.#currentState === PLYParser.State.DATA) {
            if (this.#plyFormat.type === 'ascii') {
                byteOffset = this.#parseDataAscii(dataView, byteOffset);
            } else {
                throw new Error('[PLYParser] PLY files in binary format are unsupported at this time.');
            }
        }

        // // parse post-check
        const remainingData = new Uint8Array(dataView.buffer).subarray(byteOffset);
        if (isLastStream) {
            if (remainingData.length !== 0) {
                throw Error(`[PLYParser] Malformed or incomplete data at end-of-file.`);
            }
            this.#currentState = PLYParser.State.DONE;
        }

        return { remainingData, isDone: this.#currentState === PLYParser.State.DONE }
        // return { remainingData, isDone: true }
    }

    /** Parses the header of a PLY file */
    #parseHeader(dataView) {
        const headerString = this.#getHeaderString(dataView);

        let endHeaderFound = false;
        let lineStart = 0, lineEnd;
        while ((lineEnd = headerString.indexOf('\n', lineStart)) !== -1) {
            const line = headerString.substring(lineStart, lineEnd);
            const headerLine = line.split("//")[0].trim(); // remove comments
            if (headerLine == "") {
                lineStart = lineEnd + 1;
                continue;
            }

            endHeaderFound = this.#parseHeaderLine(headerLine);
            if (endHeaderFound) break;

            lineStart = lineEnd + 1;
        }

        let remainingDataIndex = lineStart;
        if (endHeaderFound) {
            remainingDataIndex = lineEnd+1;
            this.#currentState = PLYParser.State.DATA;
            this.#prepareBuffers();
        }

        return remainingDataIndex;
    }

    #parseHeaderLine(headerLine) {
        const tokens = headerLine.split(' ');
        if (tokens[0] === 'end_header') {
            return true;
        } else if (tokens[0] === 'format') {
            this.#plyFormat.type = tokens[1];
            this.#plyFormat.version = tokens[2];
        } else if (tokens[0] === 'element') {
            this.#elementSpecs.push({ 
                name: tokens[1], 
                count: Number(tokens[2]),
                primitiveBytes: 0,
                numPrimitives: 0,
                writePlans: []
            });
        } else if (tokens[0] === 'property') {
            const currentElement = this.#elementSpecs[this.#elementSpecs.length-1];
            const elementName = currentElement.name;
            const propName = tokens[tokens.length - 1];
            if (['nx', 'ny', 'nz'].includes(propName)) {
                this.#hasNormals = true;
            }

            let arrayName = PLYParser.#propToArrayName.get(propName);
            if (arrayName === undefined) arrayName = propName;
            const writePlan = { name: propName, arrayName, dataType: tokens[1] };
            if (tokens[1] === 'list') {
                writePlan.countType = tokens[2];
                writePlan.valueType = tokens[3];
                if (!(elementName in this.#listProperties)) {
                    this.#listProperties[elementName] = {};
                }
                this.#listProperties[elementName][propName] = { 
                    byteSize: Parser._typeByteSize.get(tokens[3]),
                    valueType: tokens[3],
                    arrayName: arrayName,
                    data: []
                };
            } else {
                const byteSize = Parser._typeByteSize.get(tokens[1]);
                currentElement.primitiveBytes += byteSize;
                currentElement.numPrimitives++;
                writePlan.byteSize = byteSize;
                writePlan.arrayName = PLYParser.#propToArrayName.get(propName);
            }
            currentElement.writePlans.push(writePlan);
        }
        return false;
    }

    #getHeaderString(dataView) {
        const decoder = new TextDecoder();
        const intBuffer = new Uint8Array(dataView.buffer);

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
        return headerString;
    }

     /** creates the array buffers for each element after the header's been fully parsed. */
    #prepareBuffers() {
        for (const elementSpec of this.#elementSpecs) {
            if (elementSpec.primitiveBytes <= 0) continue;
            let elementBlockSize = elementSpec.primitiveBytes;

            // make space for normals (4 bytes + 3 values = 12 bytes)
            // only applied to vertex element
            if (elementSpec.name === 'vertex' && this.#genNormals && !this.#hasNormals) {
                elementBlockSize += 12;
            }
            const buffer = new ArrayBuffer(elementSpec.count * elementBlockSize);
            this.#elementData[elementSpec.name] = new DataView(buffer);
        }
    }

    /** Parses the body of a ply file as ascii text */
    #parseDataAscii(dataView, byteOffset) {
        const intBuffer = new Uint8Array(dataView.buffer);
        const textData = (new TextDecoder).decode(intBuffer.subarray(byteOffset));

        let lineStart = 0, lineEnd;
        let remainingDataIndex = byteOffset;
        while ((lineEnd = textData.indexOf('\n', lineStart)) !== -1) {
            const line = textData.substring(lineStart, lineEnd);
            const dataLine = line.split("//")[0].trim(); // remove comments
            if (dataLine == "") {
                lineStart = lineEnd + 1;
                continue;
            }
            
            this.#parseDataLine(dataLine);

            lineStart = lineEnd + 1;
            remainingDataIndex = byteOffset + lineStart;
        }

        return remainingDataIndex;
    }

    #parseDataLine(dataLine) {
        const currentElementSpec = this.#elementSpecs[this.#elementSpecIndex];
        const elementName = currentElementSpec.name;

        const lineValues = dataLine.split(" ").map(token => Number(token));
        let planIndex = 0, valueIndex = 0, byteOffset = 0;
        while (valueIndex < lineValues.length) {
            const currentPlan = currentElementSpec.writePlans[planIndex];
            if (currentPlan.dataType === 'list') {
                const numListValues = lineValues[valueIndex];
                const listData = lineValues.slice(valueIndex+1, valueIndex+numListValues+1);
                valueIndex += numListValues + 1;

                const listInfo = this.#listProperties[elementName][currentPlan.name]
                if (elementName === 'face' && lineValues[0] > 3) {
                    const lines = this.#triangulate(numListValues, listData);
                    listInfo.data.push(...lines);
                } else {
                    listInfo.data.push(listData);
                }
            } else {
                const bufferOffset = currentElementSpec.primitiveBytes * this.#elementIndex + byteOffset;
                Parser.writeToDataView(lineValues[valueIndex], currentPlan.dataType, this.#elementData[elementName], bufferOffset);
                byteOffset += currentPlan.byteSize;
                valueIndex++;
            }
            planIndex++;
        }

        this.#elementIndex++;
        if (this.#elementIndex === this.#elementSpecs[this.#elementSpecIndex].count) {
            this.#elementSpecIndex++;
            this.#elementIndex = 0;
        }
    }

    #processMeshData() {
        let meshObj = {};
        Object.keys(this.#listProperties).forEach(elementName => {
            const elementListProps = this.#listProperties[elementName];
            Object.keys(elementListProps).forEach(listPropName => {
                const listInfo = elementListProps[listPropName];
                let arraySize = 0;
                for (const dataList of listInfo.data) {
                    arraySize += dataList.length;
                }
                const TypedArray = Parser._typeToArray.get(listInfo.valueType);
                const array = new TypedArray(arraySize);

                let arrayIndex = 0;
                for (let i = 0; i < listInfo.data.length; i++) {
                    for (let j = 0; j < listInfo.data[i].length; j++) {
                        array[arrayIndex++] = listInfo.data[i][j];
                    }
                }

                meshObj[`${listInfo.arrayName}Array`] = array;
            })
        })

        for (const elementSpec of this.#elementSpecs) {
            // skip the element if it has no dataview (only had a list property)
            if (!(elementSpec.name in this.#elementData)) {
                continue;
            }
            if (!this.#interleaved) {
                const dataView = this.#elementData[elementSpec.name];
                const individualArrays = this.#deinterleaveData(dataView, elementSpec);
                for (const { name, array } of individualArrays) {
                    meshObj[`${name}Array`] = array;
                }
            } else {
                const dataView = this.#elementData[elementSpec.name];
                const elementArray = this.#convertToArray(dataView, elementSpec);
                meshObj[`${elementSpec.name}ElementArray`] = elementArray;
            }
        }
        return meshObj;
    }

    #deinterleaveData(dataView, elementSpec) {
        const arrayInfo = {};
        for (const plan of elementSpec.writePlans) {
            if (plan.dataType === 'list') continue;
            if (!(plan.arrayName in arrayInfo)) {
                arrayInfo[plan.arrayName] = { 
                    index: 0, 
                    numValues: 0, 
                    dataType: plan.dataType, 
                    byteSize: plan.byteSize 
                };
            }
            arrayInfo[plan.arrayName].numValues++;
        }
        Object.keys(arrayInfo).forEach(arrayName => {
            const arraySize = arrayInfo[arrayName].numValues * elementSpec.count;
            const ArrayClass = Parser._typeToArray.get(arrayInfo[arrayName].dataType);

            arrayInfo[arrayName].array = new ArrayClass(arraySize);
        });

        let byteOffset = 0;
        while(byteOffset < dataView.byteLength) {
            Object.keys(arrayInfo).forEach(arrayName => {
                const info = arrayInfo[arrayName];
                for (let i = 0; i < info.numValues; i++) {
                    info.array[info.index++] = Parser.readFromDataView(dataView, byteOffset, info.dataType);
                    byteOffset += info.byteSize;
                }
            })
        }

        let typedArrays = [];
        Object.keys(arrayInfo).forEach(arrayName => {
            typedArrays.push({ name: arrayName, array: arrayInfo[arrayName].array })
        })
        return typedArrays;
    }

    #convertToArray(dataView, elementSpec) {
        let numListValues = 0;
        if (elementSpec.name in this.#listProperties) {
            const elementLists = this.#listProperties[elementSpec.name];
            const listProperties = elementSpec.writePlans.filter(plan => plan.dataType == 'list');
            for (const listProp of listProperties) {
                elementLists[listProp.arrayName].data.map(list => numListValues += list.length);
            }
        }
        const arraySize = elementSpec.count * elementSpec.numPrimitives + numListValues;
        const array = new Float32Array(arraySize);

        let arrayIndex = 0, dataViewByteOffset = 0, propListIndex = 0;
        for (let line = 0; line < elementSpec.count; line++) {
            for (const plan of elementSpec.writePlans) {
                if (plan.dataType === 'list') {
                    const elementLists = this.#listProperties[elementSpec.name]
                    const currentList = elementLists[plan.name]
                    currentList.data[propListIndex].map(value => {
                        array[arrayIndex] = value;
                        arrayIndex++;
                    })
                    propListIndex++;
                } else {
                    array[arrayIndex] = Parser.readFromDataView(dataView, dataViewByteOffset, plan.dataType)
                    arrayIndex++;
                    dataViewByteOffset += plan.byteSize;
                }
            }
        }

        return array;
    }

    /** triangulates a face using the fan method */
    #triangulate(numVertices, face) {
        let faces = [];
        for (let i = 0; i < numVertices-2; i++) {
            faces.push(face.slice(i, i+3));
        }
        return faces;
    }
}