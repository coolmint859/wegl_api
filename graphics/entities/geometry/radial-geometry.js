import GeoUtils from "./geometry-utils.js";

/**
 * Contains functions for generating curved (radius-based) geometry
 */
export default class RadialGeometry {
    /**
     * Generates vertex data for a cone, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numBands the number of bands around the cone. Must be at least 3.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateCone(numBands) {
        if (typeof numBands !== 'number' || numBands < 3) {
            console.warn(`[GenerateCone] numBands must be greater than 2. Assigning default (numBands=5).`);
            numBands = 5;
        }

        //----- vertices -----//

        const numVertices = 3 * numBands + 1;
        const vertexArray = new Float32Array(3*numVertices);
        const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];

        // base center
        vertexArray[0] = 0;
        vertexArray[1] = -1;
        vertexArray[2] = 0;

        const angleStep = 2*Math.PI/numBands;
        for (let i = 0; i < numBands; i++) {
            const angle = angleStep * i;
            let x = Math.cos(angle);
            let z = Math.sin(angle);

            for (let k = 0; k < 3; k++) {
                // k=0 -> base; k=1 -> side; k=2 -> apex;
                const offset = 3 * (k * numBands + i + 1);
                vertexArray[offset+0] = k === 2 ? 0 : x;
                vertexArray[offset+1] = k === 2 ? 1 : -1;
                vertexArray[offset+2] = k === 2 ? 0 : z;
            }
        }

        //----- indices -----//

        const numFaces = 2 * numBands;
        const indexArray = new Uint16Array(3*numFaces);
        for (let i = 0; i < numBands; i++) {
            const currBaseFace = 3*i;
            indexArray[currBaseFace+0] = i+1;
            indexArray[currBaseFace+1] = i === numBands-1 ? 1 : i+2;
            indexArray[currBaseFace+2] = 0;

            const currSideFace = 3*(numBands + i);
            indexArray[currSideFace+0] = i === numBands-1 ? numBands+1 : numBands + i+2;
            indexArray[currSideFace+1] = numBands + i+1;
            indexArray[currSideFace+2] = 2*numBands + i+1;
        }

        //----- normals -----//

        const normalArray = GeoUtils.generateNormals(vertexArray, indexArray);
        const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

        const cone = {
            vertex: { data: GeoUtils.normalizeVertices(vertexArray), attributes: vertexAttributes, stride: 0 },
            normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
            idxTriangles:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
        }

        return cone;
    }

    /**
     * Generates vertex data for a cylinder, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numBands the number of bands around the cylinder. Must be at least 3.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateCylinder(numBands) {
        if (numBands < 3) {
            console.warn(`[GeneratePyramid] numBands must be greater than 2. Assigning default (numBands=10).`);
            numBands = 10;
        }

        //----- vertices -----//

        const numVertices = 4 * numBands + 2;
        const vertexArray = new Float32Array(3*numVertices);
        const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }]

        // top center
        vertexArray[0] = 0;
        vertexArray[1] = 1;
        vertexArray[2] = 0;

        // bottom center
        vertexArray[3] = 0;
        vertexArray[4] = -1;
        vertexArray[5] = 0;

        const angleStep = 2*Math.PI/numBands;
        for (let i = 0; i < numBands; i++) {
            const angle = angleStep * i;
            let x = Math.cos(angle);
            let z = Math.sin(angle);

            const epsilon = 0.00001;
            x = Math.abs(x) > epsilon ? x : 0;
            z = Math.abs(z) > epsilon ? z : 0;

            for (let k = 0; k < 4; k++) {
                // k=0 -> top1; k=1 -> top2; k=2 -> bottom1; k=3 -> bottom2
                const offset = 3 * (k * numBands + i + 2);
                vertexArray[offset+0] = x;
                vertexArray[offset+1] = k < 2 ? 1 : -1;
                vertexArray[offset+2] = z;
            }
        }

        //----- indices -----//

        const numFaces = 4 * numBands;
        const indexArray = new Uint16Array(3*numFaces);
        for (let i = 0; i < numBands; i++) {
            const top_offset1 = 3*i;
            indexArray[top_offset1+0] = i+2;
            indexArray[top_offset1+1] = 0;
            indexArray[top_offset1+2] = i < numBands-1 ? i+3 : 2;

            const top_offset2 = 3*(numBands+i);
            indexArray[top_offset2+0] = i + numBands + 2;
            indexArray[top_offset2+1] = i < numBands-1 ? numBands+i+3 : numBands+2;
            indexArray[top_offset2+2] = i + 2*numBands + 2;

            const bottom_offset1 = 3*(2*numBands + i);
            indexArray[bottom_offset1+0] = i + 2*numBands + 2;
            indexArray[bottom_offset1+1] = i < numBands-1 ? numBands+i+3 : numBands+2;
            indexArray[bottom_offset1+2] = i < numBands-1 ? i + 2*numBands + 3 : 2*numBands + 2;

            const bottom_offset2 = 3*(3*numBands + i);
            indexArray[bottom_offset2+0] = i + 3*numBands + 2;
            indexArray[bottom_offset2+1] = i < numBands-1 ? 3*numBands+i+3 : 3*numBands+2;
            indexArray[bottom_offset2+2] = 1;
        }

        //----- normals -----//

        const normalArray = GeoUtils.generateNormals(vertexArray, indexArray);
        const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

        const cylinder = {
            vertex: { data: vertexArray, attributes: vertexAttributes, stride: 0 },
            normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
            idxTriangles:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
        }

        return cylinder;
    }

    /**
     * generates a unit sphere
     * @param numBands a band is a set of polygons from north to south pole
     * @param numRings a ring is lateral set of polygons
     */
    static generateSphere(numRings, numBands) {
        if (numRings === undefined || numRings < 2) {
            console.warn(`[RadialGeometry] Generating a sphere must have 'numBands' to be at least 3. Assigning default (numRings=5).`);
            numRings = 5;
        }
        if (numBands === undefined || numBands < 3) {
            console.warn(`[RadialGeometry] Generating a sphere must have 'numRings' to at least 2. Assigning default (numBands=10).`);
            numBands = 10;
        }

        const numVertices =  numBands * (numRings-1) + 2;
        const vertexArray = new Float32Array(numVertices*3);
        const normalArray = new Float32Array(numVertices*3);

        const numIndices = (2*(numRings-1) * numBands)*3;
        const triIndexArray = numVertices < 65536 ? new Uint16Array(numIndices) : new Uint32Array(numIndices);

        //----- vertices -----//

        let vIndex = 0;
        let nIndex = 0;

        const azimu = 2 * Math.PI / numBands;
        const polar = Math.PI / numRings;

        for (let iRing = 1; iRing < numRings; iRing++) {
            const theta = polar * iRing;
            for (let iBand = 0; iBand < numBands; iBand++) {
                const phi = azimu * iBand;
                const x = Math.sin(theta) * Math.cos(phi);
                const y = Math.sin(theta) * Math.sin(phi);
                const z = Math.cos(theta);

                vertexArray[vIndex++] = x;
                vertexArray[vIndex++] = y;
                vertexArray[vIndex++] = z;

                normalArray[nIndex++] = x;
                normalArray[nIndex++] = y;
                normalArray[nIndex++] = z;
            }
        }

        // poles
        vertexArray[vIndex+2] = 1; normalArray[nIndex+2] = 1;
        vertexArray[vIndex+5] = -1; normalArray[nIndex+5] = -1;

        //----- indices -----//

        const northIndex = numBands * (numRings-1);
        const southIndex = northIndex+1;

        let iIndex = 0;
        for (let iBand = 0; iBand < numBands; iBand++) {
            for (let iRing = 1; iRing <= numRings; iRing++) {

                const bottomLeft = numBands * (iRing-1) + iBand;
                const topLeft = bottomLeft - numBands;
                const bottomRight = iBand === numBands-1 ? numBands * (iRing-1) : (bottomLeft+1);
                const topRight = iBand === numBands-1 ? bottomRight - numBands : (topLeft+1);

                // north pole triangle
                if (iRing === 1) {
                    triIndexArray[iIndex++] = northIndex;
                    triIndexArray[iIndex++] = bottomLeft;
                    triIndexArray[iIndex++] = bottomRight;
                }
                // inner quad
                else if (iRing > 1 && iRing < numRings) {
                    // bottom-left triangle
                    triIndexArray[iIndex++] = bottomLeft;
                    triIndexArray[iIndex++] = bottomRight;
                    triIndexArray[iIndex++] = topLeft;

                    // top-right triangle
                    triIndexArray[iIndex++] = topLeft;
                    triIndexArray[iIndex++] = bottomRight;
                    triIndexArray[iIndex++] = topRight;
                }
                // south pole triangle
                else {
                    triIndexArray[iIndex++] = southIndex;
                    triIndexArray[iIndex++] = topRight;
                    triIndexArray[iIndex++] = topLeft;
                }
            }
        }

        const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
        const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];
        return {
            vertex: { data: vertexArray, attributes: vertexAttributes, stride: 0 },
            normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
            idxTriangles:  { data: triIndexArray,  attributes: [], stride: 0, dataType: 'uint16' },
        }
    }
}