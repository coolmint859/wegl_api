/**
 * A base class for file parsers.
 */
export default class Parser {
    /** Map of common data types to their corresponding typed array constructor */
    static typeToArray = new Map([
        ['char', Int8Array], ['uchar', Uint8Array],
        ['short', Int16Array], ['ushort', Uint16Array],
        ['int', Int32Array], ['uint', Uint32Array],
        ['int32', Int32Array], ['uint32', Uint32Array],
        ['float', Float32Array], ['float32', Float32Array],
        ['double', Float64Array], ['float64', Float64Array],
    ]);

    /** Map of common data types to their size in bytes */
    static typeByteSize = new Map([
        ['char', 1], ['uchar', 1],
        ['short', 2], ['ushort', 2],
        ['int', 4], ['uint', 4],
        ['float', 4], ['float32', 4],
        ['double', 8], ['float64', 8],
    ])
    
    /**
     * Reset the state of the parser, allowing it to be used on mutiple files. This method must be overridden.
     */
    reset() {
        throw Error(`[Parser] A parser class derived from this one must implement the reset method.`);
    }

    /**
     * The core parsing logic. This method must be overridden.
     * @param {Uint8Array} dataView The current buffer wrapped in a DataView instance. The buffer is prepended with any unprocessed data from the last call.
     * @param {boolean} isStreamDone A flag indicating if there is any more incoming buffer data.
     * @returns {object} A state object. Should hold any 'remainingData' as an ArrayBufferLike and an 'isDone' flag - the flag signals to the caller that parsing is complete, and thus should terminate.
     */
    parse(dataView, isStreamDone) {
        throw Error(`[Parser] A parser class derived from this one must implement the parse method.`);
    }

    /**
     * Returns the final parsed/processed data. This method must be overridden.
     * @returns {any} The final parsed data.
     */
    getDataWebGL() {
        throw Error(`[Parser] A parser class derived from this one must implement the getParsedData method.`);
    }

    /**
     * Utility method for finding the index of a string of bytes in a Uint8Array
     * @param {Uint8Array} binData the array of data to search in
     * @param {Uint8Array} bytes the set of bytes to search for in the binary data
     * @param {number} start an index into the binary array for which to begin searching.
     * @param {number} end an index into the binary array for which to stop searching.
     * @returns {number} the index for which the bytes starts in the binary array. If the bytes are not in the array or the byte length is invalid, -1 is returned.
     */
    static findByteIndex(binData, bytes, start, end) {
        if (bytes.length === 0 || bytes.length > end - start) {
            return -1;
        }

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

    /**
     * Sets a numeric value as the given type in a dataView at the given offset.
     * @param {DataView} dataView the data view instance to place the data into.
     * @param {number} offset the offset in bytes for where to place the value. Must be less than the size of the dataview itself.
     * @param {number} value the data to be stored in the data view. Must match the provided type.
     * @param {string} dataType a string representing the data type ('float', 'int32',...).
     * @returns {DataView} the same dataview instance that was provided.
     */
    static writeToDataView(dataView, offset, value, dataType) {
        if (Number.isNaN(offset) || Number.isNaN(value)) {
            throw new Error(`[Parser] Cannot write value to dataView as the offset or value is NaN.`);
        }
        if (!Parser.typeByteSize.has(dataType)) {
            throw new Error(`[Parser] Cannot write value to dataView as the type '${dataType}' isn't recognized.`);
        }
        const byteSize = Parser.typeByteSize.get(dataType);
        if (offset + byteSize > dataView.byteLength || offset < 0) {
            throw new Error(`[Parser] Cannot write value to dataView as the given offset '${offset}' is not within a valid range.`);
        }
        switch(dataType) {
            case 'char':
            case 'int8':
                dataView.setInt8(offset, value); break;
            case 'uchar':
            case 'uint8':
                dataView.setUint8(offset, value); break;
            case 'short':
            case 'int16':
                dataView.setInt16(offset, value); break;
            case 'ushort':
            case 'uint16':
                dataView.setUint16(offset, value); break;
            case 'int':
            case 'int32':
                dataView.setInt32(offset, value); break;
            case 'uint':
            case 'uint32':
                dataView.setUint32(offset, value); break;
            case 'int64':
                dataView.setBigInt64(offset, value); break;
            case 'uint64':
                dataView.setBigUint64(offset, value); break;
            case 'float':
            case 'float32':
                dataView.setFloat32(offset, value); break;
            case 'double':
            case 'float64':
                dataView.setFloat64(offset, value); break;
            default:
                dataView.setFloat32(offset, value); break;
        }
        return dataView;
    }

    /**
     * Read a value as the given type from a dataview at the given offset
     * @param {DataView} dataView the data view instance to read the data from.
     * @param {number} offset the offset in bytes for where to extract the value from. Must be less than the size of the dataview itself.
     * @param {string} dataType  a string representing the data type ('float', 'int32',...).
     * @returns {number} the value in the dataview at the given offset.
     */
    static readFromDataView(dataView, offset, dataType) {
        if (Number.isNaN(offset)) {
            throw new Error(`[Parser] Cannot read value from dataView as the offset is NaN.`);
        }
        if (!Parser.typeByteSize.has(dataType)) {
            throw new Error(`[Parser] Cannot read value from dataView as the type '${dataType}' isn't recognized.`);
        }
        const byteSize = Parser.typeByteSize.get(dataType);
        if (offset + byteSize > dataView.byteLength || offset < 0) {
            throw new Error(`[Parser] Cannot read value from dataView as the given offset '${offset}' is not within a valid range.`);
        }
        switch(dataType) {
            case 'char':
            case 'int8':
                return dataView.getInt8(offset);
            case 'uchar':
            case 'uint8':
                return dataView.getUint8(offset);
            case 'short':
            case 'int16':
                return dataView.getInt16(offset);
            case 'ushort':
            case 'uint16':
                return dataView.getUint16(offset);
            case 'int':
            case 'int32':
                return dataView.getInt32(offset);
            case 'uint':
            case 'uint32':
                return dataView.getUint32(offset);
            case 'int64':
                return dataView.getBigInt64(offset);
            case 'uint64':
                return dataView.getBigUint64(offset);
            case 'float':
            case 'float32':
                return dataView.getFloat32(offset);
            case 'double':
            case 'float64':
                return dataView.getFloat64(offset);
            default:
                return dataView.getFloat32(offset);
        }
    }
}