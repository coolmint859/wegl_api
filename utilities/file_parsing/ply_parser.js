import Parser from "./base_parser.js";

/**
 * Parses PLY files via a data stream, converting the data into a mesh object.
 * 
 * It first will parse the data into an interleaved ArrayBuffer object. If requested
 * to not be interleaved, then this array is further separated into invividual typed arrays.
 * 
 */
export default class PLYParser extends Parser {
    static State = Object.freeze({
        HEADER: 'header',
        DATA: 'data',
        DONE: 'done',
        FAILED: 'failed',
    })

    static #arrayNameMap = new Map([
        ['x', 'vertex'], ['y', 'vertex'], ['z', 'vertex'],
        ['vx', 'vertex'], ['vy', 'vertex'], ['vz', 'vertex'],
        ['coordinates', 'vertex'], ['vertex_coordinates', 'vertex'],
        ['s', 'uv'], ['t', 'uv'], ['u', 'uv'], ['v', 'uv'],
        ['uv_coordinates', 'uv'], ['uvs', 'uv'],
        ['nx', 'normal'], ['ny', 'normal'], ['nz', 'normal'],
        ['normal_coordinates', 'normal'], ['normals', 'normal'],
        ['r', 'color'], ['g', 'color'], ['b', 'color'], ['a', 'color'],
        ['vertex_index', 'index'], ['vertex_indices', 'index'],
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
    #elementDataViews;
    #genNormals;
    #interleaved;

    /**
     * Create a new PLYParser.
     * @param {object} options options for data parsing and output format
     * @param {boolean} options.generateNormals if true, after parsing it will generate vertex normals if not already present. A face element must be in the file data for this to work. 
     * @param {boolean} options.interleaveArrays if true, each element will have their data interleaved according to the properties in the header, 
     * otherwise each element will be separated into logically similar groups (vertices, normals, etc). List properties will be interleaved or in separate arrays accordingly.
     * @returns {PLYParser} a reference to this parser instance
     */
    constructor(options={}) {
        super();
        this.#genNormals = options.generateNormals ?? true; // default is to always generate normals
        this.#interleaved = options.interleaveArrays ?? false;
        this.#elementDataViews = {};
    }

    /**
     * Reset this PLYParser.
     * @param {object} options options for data parsing and output format
     * @param {boolean} options.includeOptions if true, will also reset the options given at constuction.
     * @param {boolean} options.generateNormals if true, after parsing it will generate vertex normals if not already present. A face element must be in the array for this to work. 
     * @param {boolean} options.interleaveArrays if true, each element will have their data interleaved according to the properties in the header, 
     * otherwise each element will be separated into logically similar groups (vertices, normals, etc). List properties will be interleaved or in separate arrays accordingly.
     * @returns {PLYParser} a reference to this parser instance
     */
    reset(options={}) {
        if (options.includeOptions) {
            this.#genNormals = options.generateNormals ?? true;
            this.#interleaved = options.interleaveArrays ?? false;
        }

        this.#currentState = PLYParser.State.HEADER;
        this.#elementSpecs = [];
        this.#plyFormat = {};
        this.#hasNormals = false;

        this.#elementSpecIndex = 0;
        this.#elementIndex = 0;
        this.#listProperties = {};
        this.#elementDataViews = {};

        return this;
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
            this.#generateNormals();

            return { remainingData: new Uint8Array(0), isDone: isLastStream }
        }

        let remainingByteOffset = 0;
        if (this.#currentState === PLYParser.State.HEADER) {
            remainingByteOffset = this.#parseHeader(dataView);
        }
        if (this.#currentState === PLYParser.State.DATA) {
            if (this.#plyFormat.type === 'ascii') {
                remainingByteOffset = this.#parseDataAscii(dataView, remainingByteOffset);
            } else {
                this.#currentState === PLYParser.State.FAILED;
                throw new Error('[PLYParser] PLY files in binary format are unsupported at this time.');
            }
        }

        // // parse post-check
        const remainingData = new Uint8Array(dataView.buffer).subarray(remainingByteOffset);
        if (isLastStream) {
            if (remainingData.length !== 0) {
                this.#currentState === PLYParser.State.FAILED;
                throw Error(`[PLYParser] Malformed or incomplete data at end-of-file.`);
            }
            this.#currentState = PLYParser.State.DONE;
            this.#generateNormals();
        }

        return { remainingData, isDone: this.#currentState === PLYParser.State.DONE }
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
            this.#prepareElementBuffers();
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
            const propName = tokens[tokens.length - 1];
            if (['nx', 'ny', 'nz'].includes(propName)) {
                this.#hasNormals = true;
            }

            let arrayName = PLYParser.#arrayNameMap.get(propName);
            if (arrayName === undefined) arrayName = propName;

            const writePlan = { propName, arrayName, dataType: tokens[1] };
            if (tokens[1] === 'list') {
                writePlan.countType = tokens[2];
                writePlan.valueType = tokens[3];
                if (!(currentElement.name in this.#listProperties)) {
                    this.#listProperties[currentElement.name] = {};
                }
                this.#listProperties[currentElement.name][propName] = { 
                    byteSize: Parser.typeByteSize.get(tokens[3]),
                    valueType: tokens[3],
                    arrayName: arrayName,
                    data: []
                };
            } else {
                const byteSize = Parser.typeByteSize.get(tokens[1]);
                currentElement.primitiveBytes += byteSize;
                currentElement.numPrimitives++;
                writePlan.byteSize = byteSize;
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
    #prepareElementBuffers() {
        for (const elementSpec of this.#elementSpecs) {
            // skip elements with only list properties
            if (elementSpec.primitiveBytes <= 0) continue;

            // make space for normals (1 float -> 4 bytes * 3 values = 12 bytes)
            // only applied to vertex element
            if (elementSpec.name === 'vertex' && this.#genNormals && !this.#hasNormals) {
                elementSpec.writePlans.push({ propName: 'nx', arrayName: 'normal', dataType: 'float', byteSize: 4});
                elementSpec.writePlans.push({ propName: 'ny', arrayName: 'normal', dataType: 'float', byteSize: 4});
                elementSpec.writePlans.push({ propName: 'nz', arrayName: 'normal', dataType: 'float', byteSize: 4});
                elementSpec.primitiveBytes += 12;
                elementSpec.numPrimitives += 3
            }
            const buffer = new ArrayBuffer(elementSpec.count * elementSpec.primitiveBytes);
            this.#elementDataViews[elementSpec.name] = new DataView(buffer);
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

        const lineValues = dataLine.split(" ").map(token => Number(token));
        let planIndex = 0, valueIndex = 0, byteOffset = 0;
        while (valueIndex < lineValues.length) {
            const currentPlan = currentElementSpec.writePlans[planIndex];
            const elementName = currentElementSpec.name;
            if (currentPlan.dataType === 'list') {
                const numListValues = lineValues[valueIndex];
                const listData = lineValues.slice(valueIndex+1, valueIndex+numListValues+1);
                valueIndex += numListValues + 1;

                const listInfo = this.#listProperties[elementName][currentPlan.propName]
                if (elementName === 'face' && lineValues[0] > 3) {
                    const lines = this.#triangulate(numListValues, listData);
                    listInfo.data.push(...lines);
                } else {
                    listInfo.data.push(listData);
                }
            } else {
                const bufferOffset = currentElementSpec.primitiveBytes * this.#elementIndex + byteOffset;
                Parser.writeToDataView(this.#elementDataViews[elementName], bufferOffset, lineValues[valueIndex], currentPlan.dataType);
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

    /** generate vertex normal vectors from face data */
    #generateNormals() {
        if (!this.#genNormals || this.#hasNormals) return; // normals not requested / already present

        const vertexElement = this.#elementSpecs.filter(elementSpec => elementSpec.name === 'vertex')[0];
        const faceElement = this.#elementSpecs.filter(elementSpec => elementSpec.name === 'face')[0];
        const faceData = this.#listProperties['face'][faceElement.writePlans[0].propName].data;
        if (faceData === undefined) {
            console.error(`[PLYParser] Cannot generate vertex normals as the ply file does not have face data.`)
            return;
        }

        // Coordinate byte locations are the locations of the x, y and z vertex coords per vertex element.
        // that is, if x is the first property on the line, then it's byte location is 0 (for every element).
        const coordInfo = {};
        vertexElement.writePlans.filter(plan => plan.arrayName == 'vertex')
        .forEach((plan, index) => {
            const coordName = plan.propName.startsWith('v') ? plan.propName[1] : plan.propName;
            coordInfo[`${coordName}Offset`] = index * plan.byteSize;
            coordInfo[`${coordName}DataType`] = plan.dataType;
        });

        let sharedNormals = this.#calculateSharedNormals(faceData, vertexElement, coordInfo);
        this.#createVertexNormals(sharedNormals, vertexElement.primitiveBytes);
    }

    #calculateSharedNormals(faceData, vertexElement, coordInfo) {
        const vertexDataView = this.#elementDataViews['vertex'];

        let sharedNormals = Array.from({ length: vertexElement.count }, () => new Set());
        for (const vertexIndices of faceData) {
            // byte offsets for each line (first line is offset 0, next line is primitiveBytes, etc...);
            const elementOffsets = vertexIndices.map(index => index * vertexElement.primitiveBytes);

            const faceVertices = [];
            for (const elementOffset of elementOffsets) {
                const x = Parser.readFromDataView(vertexDataView, coordInfo.xOffset + elementOffset, coordInfo.xDataType);
                const y = Parser.readFromDataView(vertexDataView, coordInfo.yOffset + elementOffset, coordInfo.yDataType);
                const z = Parser.readFromDataView(vertexDataView, coordInfo.zOffset + elementOffset, coordInfo.zDataType);
                faceVertices.push({ x, y, z });
            }

            const [ v1, v2, v3 ] = faceVertices;
            const vec1x = v2.x - v1.x, vec1y = v2.y - v1.y, vec1z = v2.z - v1.z;
            const vec2x = v3.x - v1.x, vec2y = v3.y - v1.y, vec2z = v3.z - v1.z;

            const xCross = vec1y * vec2z - vec1z * vec2y;
            const yCross = vec1z * vec2x - vec1x * vec2z;
            const zCross = vec1x * vec2y - vec1y * vec2x;

            const magnitude = Math.sqrt(xCross * xCross + yCross * yCross + zCross * zCross);
            const faceNormal = { x: xCross / magnitude, y: yCross / magnitude, z: zCross / magnitude }

            vertexIndices.forEach(index => sharedNormals[index].add(JSON.stringify(faceNormal)));
        }
        return sharedNormals;
    }

    #createVertexNormals(sharedNormals, vertexStride) {
        const vertexDataView = this.#elementDataViews['vertex'];

        let elementIndex = 0;
        for (const normalSet of sharedNormals) {
            let vertexNormal = [0, 0, 0] // zero vector is default
            if (normalSet.size === 0) {
                console.warn(`[PLYParser] Vertex ${elementIndex} has no associated faces for normal computation. Assigning default normal [0, 0, 0].`);
            } else {
                let xSum = 0, ySum = 0, zSum = 0;
                for (const normalStr of normalSet) {
                    const faceNormal = JSON.parse(normalStr);
                    xSum += faceNormal.x;
                    ySum += faceNormal.y;
                    zSum += faceNormal.z;
                }

                const magnitude = Math.sqrt(xSum * xSum + ySum * ySum + zSum * zSum);
                vertexNormal = [xSum / magnitude, ySum / magnitude, zSum / magnitude];
            }

            // generated normals always go at the end of the line
            const normalStartByte = (elementIndex+1) * vertexStride - 12;
            for (let i = 0; i < vertexNormal.length; i++) {
                const byteOffset = normalStartByte + (i * 4); // 4 bytes per float
                Parser.writeToDataView(vertexDataView, byteOffset, vertexNormal[i], 'float');
            }
            elementIndex++;
        }
    }

    /**
     * Process and return the parsed data in a format compatible with webgl.
     *
     * The return object's format is a list of the typed arrays 'arrays' of all the parsed data. There is also a list of 'attributes' that describe the data in the arrays, including the index of the array it's describing. 
     * The intention is to allow iteration over the arrays to create the webgl buffers, and then the attributes to create the attribute pointers for the arrays. This design allows it to be independent of the arrays being interleaved or not.
     * @returns {object} a object containing the parsed data
     */
    getDataWebGL() {
        let processedData = {};
        for (const elementSpec of this.#elementSpecs) {
            if (elementSpec.name in this.#listProperties) {
                const listPlans = elementSpec.writePlans.filter(plan => plan.dataType === 'list');
                this.#createListArrays(listPlans, elementSpec.name, processedData);
            } 
            
            if (!(elementSpec.name in this.#elementDataViews)) {
                continue; // skip elements with only list properties
            } else if (!this.#interleaved) {
                this.#createIndividualArrays(elementSpec, processedData);
            } else {
                this.#createInterleavedArray(elementSpec, processedData);
            }
        }
        return processedData;
    }

    #createListArrays(listPlans, elementName, dataObject) {
        for (const plan of listPlans) {
            let arraySize = 0;
            const listData = this.#listProperties[elementName][plan.propName].data;
            listData.forEach(list => arraySize += list.length);

            const TypedArray = Parser.typeToArray.get(plan.valueType);
            const array = new TypedArray(arraySize);

            let arrayIndex = 0;
            for (const list of listData) {
                list.forEach(value => array[arrayIndex++] = value);
            }

            const arrayObject = { array, stride: 0, attributes: [] }
            if (plan.arrayName === 'index') {
                arrayObject.dataType = plan.valueType;
            } else {
                arrayObject.attributes.push({ 
                    name: plan.arrayName, 
                    size: 1, 
                    dataType: plan.valueType, 
                    offset: 0 
                });
            }
            dataObject[plan.arrayName] = arrayObject
        }
    }

    #createIndividualArrays(elementSpec, dataObject) {
        const dataView = this.#elementDataViews[elementSpec.name];

        const arrayInfo = {};
        elementSpec.writePlans.filter(plan => plan.dataType !== 'list')
        .forEach(plan => {
            if (!(plan.arrayName in arrayInfo)) {
                arrayInfo[plan.arrayName] = { 
                    index: 0, 
                    numValues: 0, 
                    dataType: plan.dataType, 
                    byteSize: plan.byteSize 
                };
            }
            arrayInfo[plan.arrayName].numValues++;
        });
        for (const arrayName in arrayInfo) {
            const info = arrayInfo[arrayName];

            const arraySize = info.numValues * elementSpec.count;
            const ArrayClass = Parser.typeToArray.get(info.dataType);
            info.array = new ArrayClass(arraySize);

            const attribute = { name: arrayName, size: info.numValues, dataType: info.dataType, offset: 0 }
            dataObject[arrayName] = { 
                array: info.array, 
                stride: 0, 
                attributes: [attribute]
            };
        }

        let byteOffset = 0;
        while(byteOffset < dataView.byteLength) {
            for (const arrayName in arrayInfo) {
                const info = arrayInfo[arrayName];
                for (let i = 0; i < info.numValues; i++) {
                    info.array[info.index++] = Parser.readFromDataView(dataView, byteOffset, info.dataType);
                    byteOffset += info.byteSize;
                }
            }
        }
    }

    #createInterleavedArray(elementSpec, dataObject) {
        const dataView = this.#elementDataViews[elementSpec.name];
        const primitivePlans = elementSpec.writePlans.filter(plan => plan.dataType !== 'list');
        const arraySize = elementSpec.count * elementSpec.numPrimitives;
        const array = new Float32Array(arraySize);

        let arrayIndex = 0, dataViewByteOffset = 0
        for (let line = 0; line < elementSpec.count; line++) {
            for (const plan of primitivePlans) {
                array[arrayIndex++] = Parser.readFromDataView(dataView, dataViewByteOffset, plan.dataType)
                dataViewByteOffset += plan.byteSize;
            }
        }

        const arrayInfo = {
            name: elementSpec.name,
            dataType: 'float',
            byteSize: 4
        }
        const { attributes, stride } = this.#createAttributes(arrayInfo, primitivePlans);
        dataObject[arrayInfo.name] = {
            array: array, 
            stride: stride,
            attributes: attributes
        };
    }

    #createAttributes(arrayInfo, arrayPlans) {
        const attribInfo = {};
        let byteOffset = 0;
        for (const plan of arrayPlans) {
            if (plan.arrayName in attribInfo) {
                attribInfo[plan.arrayName].numValues++;
            } else {
                attribInfo[plan.arrayName] = {
                    numValues: 1, 
                    byteOffset: byteOffset
                };
            }
            byteOffset += plan.dataType === 'list' ? 0 : arrayInfo.byteSize;
        }

        const attributes = [];
        for (const arrayName in attribInfo) {
            const info = attribInfo[arrayName];
            attributes.push({
                name: arrayName,
                size: info.numValues,
                dataType: arrayInfo.dataType,
                offset: info.byteOffset
            });
        }
        return { attributes, stride: byteOffset };
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