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

    // common property to array names for non-iterleaved data
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
        this.#elementData = {};
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
        this.#elementData = {};

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
                throw new Error('[PLYParser] PLY files in binary format are unsupported at this time.');
            }
        }

        // // parse post-check
        const remainingData = new Uint8Array(dataView.buffer).subarray(remainingByteOffset);
        if (isLastStream) {
            if (remainingData.length !== 0) {
                throw Error(`[PLYParser] Malformed or incomplete data at end-of-file.`);
            }
            this.#currentState = PLYParser.State.DONE;
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

            let arrayName = PLYParser.#propToArrayName.get(propName);
            if (arrayName === undefined) arrayName = propName;
            const writePlan = { name: propName, arrayName, dataType: tokens[1] };
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
    #prepareElementBuffers() {
        for (const elementSpec of this.#elementSpecs) {
            // skip elements with only list properties
            if (elementSpec.primitiveBytes <= 0) continue;

            // make space for normals (1 float -> 4 bytes * 3 values = 12 bytes)
            // only applied to vertex element
            if (elementSpec.name === 'vertex' && this.#genNormals && !this.#hasNormals) {
                elementSpec.writePlans.push({ name: 'nx', arrayName: 'normal', dataType: 'float', byteSize: 4});
                elementSpec.writePlans.push({ name: 'ny', arrayName: 'normal', dataType: 'float', byteSize: 4});
                elementSpec.writePlans.push({ name: 'nz', arrayName: 'normal', dataType: 'float', byteSize: 4});
                elementSpec.primitiveBytes += 12;
                elementSpec.numPrimitives += 3
            }
            const buffer = new ArrayBuffer(elementSpec.count * elementSpec.primitiveBytes);
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

        const lineValues = dataLine.split(" ").map(token => Number(token));
        let planIndex = 0, valueIndex = 0, byteOffset = 0;
        while (valueIndex < lineValues.length) {
            const currentPlan = currentElementSpec.writePlans[planIndex];
            const elementName = currentElementSpec.name;
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
                Parser.writeToDataView(this.#elementData[elementName], bufferOffset, lineValues[valueIndex], currentPlan.dataType);
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

    /**
     * Process and return the parsed data in a format compatible with webgl.
     * 
     * Individual arrays are always named in the format "elementNameArray". For interleaved arrays, the format is 'elementNameElementArray'. 
     * Interleaved arrays will also have an accompanying key in the format 'elementNameElementKey'. The only exception is face data, which is named 'indexArray'.
     * @returns {object} a object containing the parsed data converted into typed arrays
     */
    getDataWebGL() {
        if (!this.#hasNormals && this.#genNormals) {
            this.#generateNormals();
        }
        let processedData = { arrays: [], attributes: [] };
        for (const elementSpec of this.#elementSpecs) {
            if (elementSpec.name in this.#listProperties) {
                const listPlans = elementSpec.writePlans.filter(plan => plan.dataType === 'list');
                this.#createListArrays(listPlans, elementSpec.name, processedData);
            } 
            
            if (!(elementSpec.name in this.#elementData)) {
                continue; // skip elements with only list properties
            } else if (!this.#interleaved) {
                const dataView = this.#elementData[elementSpec.name];
                this.#createIndividualArrays(dataView, elementSpec, processedData);
            } else {
                const dataView = this.#elementData[elementSpec.name];
                this.#createInterleavedArray(dataView, elementSpec, processedData);
            }
        }
        return processedData;
    }

    #generateNormals() {
        const vertexElement = this.#elementSpecs.filter(elementSpec => elementSpec.name === 'vertex')[0];
        const faceElement = this.#elementSpecs.filter(elementSpec => elementSpec.name === 'face')[0];
        const faceInfo = this.#listProperties['face'][faceElement.writePlans[0].name];
        const vertexDataView = this.#elementData['vertex'];

        // component byte locations are the locations of the x, y and z vertex coords per line.
        // that is, if x is the first property on the line, then it's byte location is 0.
        const coordInfo = {};
        vertexElement.writePlans.forEach((plan, index) => {
            // const coordNames = ['x', 'y', 'z', 'vx', 'vy', 'vz'];
            // if (coordNames.includes(plan.name)) {
            //     const coordName = plan.name.startsWith('v') ? plan.name[1] : plan.name;
            //     coordInfo[`${coordName}ByteLoc`] = index * plan.byteSize;
            //     coordInfo[`${coordName}DataType`] = plan.dataType;
            // }


            if (plan.name === 'x' || plan.name === 'vx')  {
                coordInfo.xByteLoc = index * plan.byteSize;
                coordInfo.xDataType = plan.dataType;
            }
            if (plan.name === 'y' || plan.name === 'vy')  {
                coordInfo.yByteLoc = index * plan.byteSize;
                coordInfo.yDataType = plan.dataType;
            }
            if (plan.name === 'z' || plan.name === 'vz')  {
                coordInfo.zByteLoc = index * plan.byteSize;
                coordInfo.zDataType = plan.dataType;
            }
        });

        let sharedNormals = Array.from({ length: vertexElement.count }, () => new Set());
        for (const vertexIndices of faceInfo.data) {
            // byte offsets for each line (first line is offset 0, next line is primitiveBytes, etc...)
            const faceNormal = this.#calculateFaceNormal(vertexDataView, vertexElement, vertexIndices, coordInfo);

            sharedNormals[vertexIndices[0]].add(JSON.stringify(faceNormal));
            sharedNormals[vertexIndices[1]].add(JSON.stringify(faceNormal));
            sharedNormals[vertexIndices[2]].add(JSON.stringify(faceNormal));
        }

        let elementIndex = 0;
        for (const normalSet of sharedNormals) {
            // generated normals always go at the end of the line
            const normalStartByte = (elementIndex+1) * vertexElement.primitiveBytes - 12;

            let xSum = 0, ySum = 0, zSum = 0;
            for (const normalStr of normalSet) {
                const normal = JSON.parse(normalStr);
                xSum += normal.x;
                ySum += normal.y;
                zSum += normal.z;
            }
            Parser.writeToDataView(vertexDataView, normalStartByte + 0, xSum / normalSet.size, 'float');
            Parser.writeToDataView(vertexDataView, normalStartByte + 4, ySum / normalSet.size, 'float');
            Parser.writeToDataView(vertexDataView, normalStartByte + 8, zSum / normalSet.size, 'float');
            elementIndex++;
        }
    }

    #calculateFaceNormal(vertexDataView, vertexElement, vertexIndices, coordInfo) {
        // byte offsets for each line (first line is offset 0, next line is primitiveBytes, etc...)
        const v1ByteOffset = vertexIndices[0] * vertexElement.primitiveBytes;
        const v2ByteOffset = vertexIndices[1] * vertexElement.primitiveBytes;
        const v3ByteOffset = vertexIndices[2] * vertexElement.primitiveBytes;

        const x1 = Parser.readFromDataView(vertexDataView, coordInfo.xByteLoc + v1ByteOffset, coordInfo.xDataType);
        const y1 = Parser.readFromDataView(vertexDataView, coordInfo.yByteLoc + v1ByteOffset, coordInfo.yDataType);
        const z1 = Parser.readFromDataView(vertexDataView, coordInfo.zByteLoc + v1ByteOffset, coordInfo.zDataType);

        const x2 = Parser.readFromDataView(vertexDataView, coordInfo.xByteLoc + v2ByteOffset, coordInfo.xDataType);
        const y2 = Parser.readFromDataView(vertexDataView, coordInfo.yByteLoc + v2ByteOffset, coordInfo.yDataType);
        const z2 = Parser.readFromDataView(vertexDataView, coordInfo.zByteLoc + v2ByteOffset, coordInfo.zDataType);

        const x3 = Parser.readFromDataView(vertexDataView, coordInfo.xByteLoc + v3ByteOffset, coordInfo.xDataType);
        const y3 = Parser.readFromDataView(vertexDataView, coordInfo.yByteLoc + v3ByteOffset, coordInfo.yDataType);
        const z3 = Parser.readFromDataView(vertexDataView, coordInfo.zByteLoc + v3ByteOffset, coordInfo.zDataType);

        const xCross = (y2 - y1) * (z3 - z1) - (z2 - z1) * (y3 - y1);
        const yCross = (z2 - z1) * (x3 - x1) - (x2 - x1) * (z3 - z1);
        const zCross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);

        const magnitude = Math.sqrt(xCross * xCross + yCross * yCross + zCross * zCross);
        const xNormal = xCross / magnitude;
        const yNormal = yCross / magnitude;
        const zNormal = zCross / magnitude;

        return { x: xNormal, y: yNormal, z: zNormal };
    }

    #createListArrays(listPlans, elementName, dataObject) {
        for (const plan of listPlans) {
            let arraySize = 0;
            const listData = this.#listProperties[elementName][plan.name].data;
            listData.forEach(list => arraySize += list.length);

            const TypedArray = Parser.typeToArray.get(plan.valueType);
            const array = new TypedArray(arraySize);

            let arrayIndex = 0;
            for (const list of listData) {
                list.forEach(value => array[arrayIndex++] = value);
            }

            dataObject.arrays.push(array);
            const attribute = {
                attribName: plan.arrayName,
                arrayName: `${plan.arrayName}Array`,
                isIndexAttr: plan.arrayName === 'index',
                arrayIndex: dataObject.arrays.length - 1,
                size: 1,
                dataType: plan.valueType,
                stride: 0,
                offset: 0
            }
            dataObject.attributes.push(attribute);
        }
    }

    #createIndividualArrays(dataView, elementSpec, dataObject) {
        const arrayInfo = {};
        for (const plan of elementSpec.writePlans) {
            if (plan.dataType === 'list') continue; // skip list types as they are handled separately
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
            const ArrayClass = Parser.typeToArray.get(arrayInfo[arrayName].dataType);

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

        Object.keys(arrayInfo).forEach(arrayName => {
            const info = arrayInfo[arrayName];
            dataObject.arrays.push(info.array);

            const attribute = {
                attribName: arrayName,
                arrayName: `${arrayName}Array`,
                isIndexAttr: arrayName === 'index',
                arrayIndex: dataObject.arrays.length - 1,
                size: info.numValues,
                dataType: info.dataType,
                stride: 0,
                offset: 0
            }
            dataObject.attributes.push(attribute);
        })
    }

    #createInterleavedArray(dataView, elementSpec, dataObject) {
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

        dataObject.arrays.push(elementArray);
        const arrayInfo = {
            name: elementSpec.name,
            index: dataObject.arrays.length - 1,
            dataType: 'float',
            byteSize: 4
        }
        const arrayAttributes = this.#createAttributes(arrayInfo, primitivePlans);
        dataObject.attributes.push(...arrayAttributes);
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
        Object.keys(attribInfo).forEach(name => {
            const info = attribInfo[name];
            const attribute = {
                attribName: name,
                arrayName: `${arrayInfo.name}Array`,
                isIndexAttr: name === 'index',
                arrayIndex: arrayInfo.index,
                size: info.numValues,
                dataType: arrayInfo.dataType,
                stride: byteOffset,
                offset: info.byteOffset
            }
            attributes.push(attribute)
        })
        return attributes;
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