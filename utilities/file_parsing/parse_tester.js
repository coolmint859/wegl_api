/**
 * A helper class to test parsers on string respresentations of files.
 */
export default class ParserTester {
    /**
     * Test a parser with multiple chunk sizes
     * @param {Array<number>} chunkSizes an array of chunk sizes. Sizes are in terms of characters (so a value of 100 means a chunk size of 100 characters)
     * @param {Parser} parser the parser instance to test with. Must be a derived instance of Parser.
     * @param {string} testFileString the string of test data to parse.
     */
    static testMultiple(chunkSizes, parser, testFileString) {
        for (const chunkSize of chunkSizes) {
            ParserTester.testParser(chunkSize, parser, testFileString);
            parser.reset({ includeOptions: false });
        }
    }

    /**
     * Test a parser with the given chunk size
     * @param {Array<number>} chunkSize the chunk size for each iteration. The size is in terms of characters (so a value of 100 means a chunk size of 100 characters)
     * @param {Parser} parser the parser instance to test with. Must be a derived instance of Parser.
     * @param {string} testFileString the string of test data to parse.
     */
    static testParser(chunkSize, parser, testFileString) {
        const streamState = { 
            buffer: new Uint8Array(0), 
            isParsingDone: false
        }
        const testBinary = (new TextEncoder).encode(
            testFileString.split('\n')
            .map(line => line.trim())
            .join('\n')
        )

        let doneCount = 0;
        let chunkIndex = 0;
        let nextChunk = testBinary.subarray(0, chunkSize);
        while (!streamState.isParsingDone) {
            // get next chunk and combine with leftover data
            nextChunk = testBinary.subarray(chunkIndex, chunkIndex+chunkSize);
            if (nextChunk.length === 0) {
                doneCount++;
                if (doneCount > 3) {
                    console.error("Max done count reached");
                    break;
                }
            }

            const nextData = ParserTester.#combineBuffers(streamState.buffer, nextChunk);
            console.log((new TextDecoder()).decode(nextData));

            // get next parse state from parser
            const dataView = new DataView(nextData.buffer);
            const parseState = parser.parse(dataView, nextChunk.length === 0);
            streamState.isParsingDone = parseState.isDone;
            streamState.buffer = parseState.remainingData;

            chunkIndex += chunkSize;
        }
        console.log(parser.getDataWebGL());
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