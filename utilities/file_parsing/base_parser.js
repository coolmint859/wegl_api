/**
 * A base class for file parsers.
 */
export default class Parser {
    // for converting numeric files into arrays based on type
    static _typeToArray = new Map([
        ['char', Int8Array], ['uchar', Uint8Array],
        ['short', Int16Array], ['ushort', Uint16Array],
        ['int', Int32Array], ['uint', Uint32Array],
        ['float', Float32Array], ['float32', Float32Array],
        ['double', Float64Array], ['float64', Float64Array],
    ]);

    // the size in bytes of common types
    static _typeByteSize = new Map([
        ['char', 1], ['uchar', 1],
        ['short', 2], ['ushort', 2],
        ['int', 4], ['uint', 4],
        ['float', 4], ['float32', 4],
        ['double', 8], ['float64', 8],
    ])
    
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

    /**
     * Sets a numeric value as the given type in a dataView at the given offset.
     * @param {number} value the data to be stored in the data view. Must match the provided type.
     * @param {string} dataType a string representing the data type ('float', 'int32',...).
     * @param {DataView} dataView the data view instance to place the data into.
     * @param {number} offset the offset in bytes for where to place the value. Must be less than the size of the dataview itself.
     * @returns {DataView} the same dataview instance that was provided.
     */
    static writeToDataView(value, dataType, dataView, offset) {
        // console.log(dataType);
        // console.log(offset);
        if (!Parser._typeByteSize.has(dataType)) {
            console.error(`[Parser] Cannot add value to dataView as the type '${dataType}' isn't recognized.`);
            return dataView;
        }
        const byteSize = Parser._typeByteSize.get(dataType);
        if (offset + byteSize > dataView.byteLength) {
            console.error(`[Parser] Cannot add value to dataView as the given offset '${offset}' is larger than the dataview can support.`);
            return dataView;
        }
        switch(dataType) {
            case 'char':
                dataView.setInt8(offset, value); break;
            case 'uchar':
                dataView.setUint8(offset, value); break;
            case 'short':
                dataView.setInt16(offset, value); break;
            case 'ushort':
                dataView.setUint16(offset, value); break;
            case 'int':
                dataView.setInt32(offset, value); break;
            case 'uint':
                dataView.setUint32(offset, value); break;
            case 'int64':
                dataView.setBigInt64(offset, value); break;
            case 'uint64':
                dataView.setBigUint64(offset, value); break;
            case 'float':
                dataView.setFloat32(offset, value); break;
            case 'double':
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
        if (!Parser._typeByteSize.has(dataType)) {
            console.error(`[Parser] Cannot extract value from dataView as the type '${dataType}' isn't recognized.`);
            return dataView;
        }
        const byteSize = Parser._typeByteSize.get(dataType);
        if (offset + byteSize > dataView.byteLength) {
            console.error(`[Parser] Cannot extract value from dataView as the given offset '${offset}' is larger than the dataview can support.`);
            return dataView;
        }
        switch(dataType) {
            case 'char':
                return dataView.getInt8(offset);
            case 'uchar':
                return dataView.getUint8(offset);
            case 'short':
                return dataView.getInt16(offset);
            case 'ushort':
                return dataView.getUint16(offset);
            case 'int':
                return dataView.getInt32(offset);
            case 'uint':
                return dataView.getUint32(offset);
            case 'int64':
                return dataView.getBigInt64(offset);
            case 'uint64':
                return dataView.getBigUint64(offset);
            case 'float':
                return dataView.getFloat32(offset);
            case 'double':
                return dataView.getFloat64(offset);
            default:
                return dataView.getFloat32(offset);
        }
    }
}