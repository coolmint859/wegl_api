export default class ParserTester {
    static #plyBinary = (new TextEncoder).encode(
    `ply
    format ascii 1.0
    element vertex 4
    property float x
    property float y
    property float z
    property float u
    property float v
    property float nx
    property float ny
    property float nz
    element color 4
    property int r
    property int g
    property int b
    property int a
    element face 2
    property list uchar uint vertex_indices
    end_header
    -1 1 1 0 1 0 0 -1
    1 1 1 1 1 0 0 -1
    -1 -1 1 0 0 0 0 -1
    1 -1 1 0 1 0 0 -1
    255 0 0 255
    0 255 0 255
    0 0 255 255
    255 0 0 255
    3 0 1 2
    3 2 1 3
    `.split('\n').map(line => line.trim()).join('\n')
    );

    static test(parser) {
        ParserTester.testParser(100, parser);
        ParserTester.testParser(250, parser);
        ParserTester.testParser(500, parser);
    }

    static testParser(chunkSize, parser) {
        parser.reset();
        const streamState = { 
            buffer: new Uint8Array(0), 
            isParsingDone: false
        }
        
        let chunkIndex = 0;
        let nextChunk = ParserTester.#plyBinary.subarray(0, chunkSize);
        while (!streamState.isParsingDone) {
            // get next chunk and combine with leftover data
            nextChunk = ParserTester.#plyBinary.subarray(chunkIndex, chunkIndex+chunkSize);

            // console.log(nextChunk);
            const nextData = ParserTester.#combineBuffers(streamState.buffer, nextChunk);
            console.log((new TextDecoder()).decode(nextData));

            // get next parse state from parser
            const dataView = new DataView(nextData.buffer);
            const parseState = parser.parse(dataView, nextChunk.length === 0);
            streamState.isParsingDone = parseState.isDone;
            streamState.buffer = parseState.remainingData;

            chunkIndex += chunkSize;
        }
        console.log(parser.getParsedData());
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