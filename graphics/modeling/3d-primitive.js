/**
 * Generates a rectangular prism. Normalized to fit within a unit cube. (To make it bigger overall, use a transform instance.)
 * @returns an object containing the arrays and accompanying attributes
 */
export function generateRectPrism() {
    const vertexArray = new Float32Array([
         1, -1, -1, 
         1,  1, -1, 
        -1, -1, -1, 
        -1,  1, -1,
        -1, -1,  1, 
         1, -1,  1, 
        -1,  1,  1, 
         1,  1,  1,
         1, -1,  1, 
         1,  1,  1, 
         1, -1, -1, 
         1,  1, -1,
        -1, -1, -1, 
        -1,  1, -1, 
        -1, -1,  1, 
        -1,  1,  1,
        -1,  1,  1, 
        -1,  1, -1, 
         1,  1,  1, 
         1,  1, -1,
        -1, -1, -1, 
        -1, -1,  1, 
         1, -1, -1, 
         1, -1,  1,
    ]);
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }]

    const indexArray = new Uint16Array([
        2, 1, 0, 2, 3, 1,
        5, 6, 4, 5, 7, 6, 
        9, 10, 11, 9, 8, 10, 
        15, 12, 14, 15, 13, 12, 
        17, 18, 19, 17, 16, 18, 
        20, 23, 21, 20, 22, 23,
    ]);

    const uvArray = new Float32Array([
        0, 1, 0, 0, 1, 1, 1, 0,
        0, 1, 1, 1, 0, 0, 1, 0,
        0, 1, 0, 0, 1, 1, 1, 0,
        0, 1, 0, 0, 1, 1, 1, 0,
        0, 1, 0, 0, 1, 1, 1, 0,
        0, 1, 0, 0, 1, 1, 1, 0,
    ]);
    const uvAttributes = [{ name: 'uv', size: 2, dataType: 'float', offset: 0 }]

    const normalArray = generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: vertexArray, attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        uv:     { data: uvArray,     attributes: uvAttributes, stride: 0},
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generates a tetahredon. Normalized to fit within a unit cube. (To make it bigger overall, use a transform instance.)
 * @returns an object containing the arrays and accompanying attributes
 */
export function generateTetrahedron() {
    const angle = 2 * Math.PI / 3
    const vertexArray = new Float32Array([
        Math.cos(angle), 0, Math.sin(angle),
        0, Math.sqrt(2), 0,
        Math.cos(2*angle), 0, Math.sin(2*angle),
        Math.cos(2*angle), 0, Math.sin(2*angle),
        0, Math.sqrt(2), 0,
        Math.cos(3*angle), 0, Math.sin(3*angle),
        Math.cos(3*angle), 0, Math.sin(3*angle),
        0, Math.sqrt(2), 0,
        Math.cos(angle), 0, Math.sin(angle),
        Math.cos(angle), 0, Math.sin(angle),
        Math.cos(2*angle), 0, Math.sin(2*angle),
        Math.cos(3*angle), 0, Math.sin(3*angle)
    ]);
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];

    // [ 0, 1, 2, 3, ...];
    const indexArray = Uint16Array.from({ length: 12 }, (v, i) => i);

    const normalArray = generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: vertexArray, attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generates a pyramid. Normalized to fit within a unit cube. (To make it bigger overall, use a transform instance.)
 * @param height the height of the pyramid. Must be greater than 0.
 * @param length the length of the pyramid base. Must be greater than 0.
 * @returns an object containing the arrays and accompanying attributes
 */
export function generatePyramid(height, length) {
    if (height <= 0) {
        console.warn(`[GeneratePyramid] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (length <= 0) {
        console.warn(`[GeneratePyramid] Length must be greater than 0. Assigning default (length=1).`);
        length = 1;
    }

    //----- vertices -----//
    
    const l2 = length/2;
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
    const vertexArray = new Float32Array([
         l2, 0,  l2,   0, height,  0, -l2, 0,  l2,      // front
         l2, 0, -l2,   0, height,  0,  l2, 0,  l2,      // right
        -l2, 0, -l2,   0, height,  0,  l2, 0, -l2,      // left
        -l2, 0,  l2,   0, height,  0, -l2, 0, -l2,      // back
         l2, 0, -l2,  l2, 0,      l2, -l2, 0,  l2,      // bottom right
        -l2, 0,  l2, -l2, 0,     -l2,  l2, 0, -l2,      // bottom left
    ]);
    
    // [ 0, 1, 2, 3, ...];
    const indexArray = Uint16Array.from({ length: 18 }, (v, i) => i);

    const normalArray = generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: normalizeVertices(vertexArray), attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generates an octahedron.
 * @returns an object containing the arrays and accompanying attributes
 */
export function generateOctahedron() {

}

/**
 * Generates an octahedron.
 * @returns an object containing the arrays and accompanying attributes
 */
export function generateDodecahedron() {

}

/**
 * Generates an octahedron.
 * @returns an object containing the arrays and accompanying attributes
 */
export function generateIsosohedron() {

}

/**
 * Generates a cone. Normalized to fit within a unit cube. (To make it bigger overall, use a transform instance.)
 * @param numBands the number of bands around the cone. Must be greater than 3.
 * @param height the height of the cone. Must be greater than 0.
 * @param radius the radius of the cone. Must be greater than 0.
 * @returns an object containing the arrays and accompanying attributes
 */
export function generateCone(numBands, height, radius) {
    if (numBands < 3) {
        console.warn(`[GenerateCone] numBands must be greater than 2. Assigning fallback (numBands=5).`);
        numBands = 5;
    }
    if (height <= 0) {
        console.warn(`[GenerateCone] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (radius <= 0) {
        console.warn(`[GenerateCone] radius must be greater than 0. Assigning fallback (radius=1).`);
        radius = 1;
    }

    //----- vertices -----//

    const vertexArray = new Float32Array(3*(3 * numBands + 1));
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];

    // base center
    vertexArray[0] = 0;
    vertexArray[1] = -height/2;
    vertexArray[2] = 0;

    const angleStep = 2*Math.PI/numBands;
    for (let i = 0; i < numBands; i++) {
        const angle = angleStep * i;
        let x = radius * Math.cos(angle);
        let z = radius * Math.sin(angle);

        const epsilon = 0.00001;
        x = Math.abs(x) > epsilon ? x : 0;
        z = Math.abs(z) > epsilon ? z : 0;

        for (let k = 0; k < 3; k++) {
            // k=0 -> base; k=1 -> side; k=2 -> apex;
            const offset = 3 * (k * numBands + i + 1);
            vertexArray[offset+0] = k === 2 ? 0 : x;
            vertexArray[offset+1] = k === 2 ? height/2 : -height/2;
            vertexArray[offset+2] = k === 2 ? 0 : z;
        }
    }

    //----- indices -----//

    const indexArray = new Uint16Array(3*(2 * numBands));
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

    const normalArray = generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: normalizeVertices(vertexArray), attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generates a cylinder.
 * @param numBands the number of bands around the cylinder. Must be greater than 2.
 * @param height the height of the cylinder. This is inversely proportional to the radius (i.e. a larger height -> smaller radius). Must be greater than 0.
 * @returns an object containing the arrays and accompanying attributes
 */
export function generateCylinder(numBands, height = 1) {
    if (numBands < 3) {
        console.warn(`[GeneratePyramid] numBands must be greater than 2. Assigning fallback (numBands=10).`);
        numBands = 10;
    }
    if (height <= 0) {
        console.warn(`[GeneratePyramid] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }

    //----- vertices -----//

    const vertexArray = new Float32Array(3*(4 * numBands + 2));
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }]

    // top center
    vertexArray[0] = 0;
    vertexArray[1] = height/2;
    vertexArray[2] = 0;

    // bottom center
    vertexArray[3] = 0;
    vertexArray[4] = -height/2;
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
            vertexArray[offset+1] = k < 2 ? height/2 : -height/2;
            vertexArray[offset+2] = z;
        }
    }

    //----- indices -----//

    const indexArray = new Uint16Array(3*(4 * numBands));
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
        indexArray[bottom_offset1+2] = i < numBands-1 ? i + 2*numBands + 3 : 2*numBands+2;

        const bottom_offset2 = 3*(3*numBands + i);
        indexArray[bottom_offset2+0] = i + 3*numBands + 2;
        indexArray[bottom_offset2+1] = i < numBands-1 ? 3*numBands+i+3 : 3*numBands+2;
        indexArray[bottom_offset2+2] = 1;
    }

    //----- normals -----//

    const normalArray = generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: vertexArray, attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generate vertex normals given a flat vertex array and a flat index array. These can be any kind of typed array.
 * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
 * @param {ArrayBufferLike} indexArray a flat typed array of indices into the vertex array, representing faces.
 * @param {object} options options for generating the normals.
 * @returns {Float32Array} a flat Float32Array of vertex normals
 */
export function generateNormals(vertexArray, indexArray) {
    const numVertices = Math.trunc(vertexArray.length/3);

    const sharedNormals = Array.from({ length: numVertices }, () => new Set());
    for (let i = 0; i < indexArray.length-2; i += 3) {
        const vertexIndices = []
        for (let j = 0; j < 3; j++) {
            vertexIndices[j] = indexArray[i+j];
        }

        const vertices = [];
        for (let k = 0; k < 3; k++) {
            const vertPos = 3 * vertexIndices[k];
            const x = vertexArray[vertPos + 0];
            const y = vertexArray[vertPos + 1];
            const z = vertexArray[vertPos + 2];
            vertices.push({ x, y, z });
        }

        const [ v1, v2, v3 ] = vertices;
        const vec1x = v2.x - v1.x, vec1y = v2.y - v1.y, vec1z = v2.z - v1.z;
        const vec2x = v3.x - v1.x, vec2y = v3.y - v1.y, vec2z = v3.z - v1.z;

        const xCross = vec1y * vec2z - vec1z * vec2y;
        const yCross = vec1z * vec2x - vec1x * vec2z;
        const zCross = vec1x * vec2y - vec1y * vec2x;

        const magnitude = Math.sqrt(xCross * xCross + yCross * yCross + zCross * zCross);
        const faceNormal = { x: xCross / magnitude, y: yCross / magnitude, z: zCross / magnitude }

        vertexIndices.forEach(index => sharedNormals[index].add(JSON.stringify(faceNormal)));
    }

    const normalArray = new Float32Array(vertexArray.length);

    let normalIndex = 0;
    for (const normalSet of sharedNormals) {
        let xSum = 0, ySum = 0, zSum = 0;
        for (const normalStr of normalSet) {
            const faceNormal = JSON.parse(normalStr);
            xSum += faceNormal.x;
            ySum += faceNormal.y;
            zSum += faceNormal.z;
        }

        let vertexNormal = [0, 0, 0];
        const magnitude = Math.sqrt(xSum * xSum + ySum * ySum + zSum * zSum);
        if (magnitude !== 0) {
            vertexNormal = [xSum / magnitude, ySum / magnitude, zSum / magnitude];
        }

        for (let i = 0; i < vertexNormal.length; i++) {
            normalArray[normalIndex++] = vertexNormal[i];
        }
    }

    return normalArray;
}

/**
 * Transform vertices such that they fit snugly in a unit cube. Does not effect the original vertex array.
 * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
 * @param {object} options options for vertex normalization
 * @param {object} options.aboutCentroid if true, will shift the vertices such that the geometric center is at the centroid. Otherwise, will shift the vertices according to the bounding box center.
 * @returns a new Typed Array of the same kind that was given, but with the transformed vertices.
 */
export function normalizeVertices(vertexArray, options = {}) {
    let maxExtent = [-Infinity, -Infinity, -Infinity];
    let minExtent = [Infinity, Infinity, Infinity];
    let vertexSum = [0, 0, 0];

    for (let i = 0; i < vertexArray.length-2; i+=3) {
        for (let k = 0; k < 3; k++) {
            minExtent[k] = Math.min(minExtent[k], vertexArray[i+k]);
            maxExtent[k] = Math.max(maxExtent[k], vertexArray[i+k]);
            vertexSum[k] += vertexArray[i+k];
        }
    }

    let centerX, centerY, centerZ;
    if (options.aboutCentroid) {
        const numVertices = Math.trunc(vertexArray.length/3);
        centerX = vertexSum[0] / numVertices;
        centerY = vertexSum[1] / numVertices;
        centerZ = vertexSum[2] / numVertices;
    } else {
        centerX = (maxExtent[0] + minExtent[0]) / 2;
        centerY = (maxExtent[1] + minExtent[1]) / 2;
        centerZ = (maxExtent[2] + minExtent[2]) / 2;
    }

    const dxExtent = maxExtent[0] - minExtent[0];
    const dyExtent = maxExtent[1] - minExtent[1];
    const dzExtent = maxExtent[2] - minExtent[2];
    const scaleFactor = Math.max(dxExtent, Math.max(dyExtent, dzExtent)) / 2;

    // prevent devision by zero
    if (scaleFactor < 1e-6) return vertexArray;

    const TypedArray = vertexArray.constructor;
    const newVertices = new TypedArray(vertexArray.length);
    for (let i = 0; i < newVertices.length-2; i+=3) {
        newVertices[i+0] = (vertexArray[i+0] - centerX) / scaleFactor;
        newVertices[i+1] = (vertexArray[i+1] - centerY) / scaleFactor;
        newVertices[i+2] = (vertexArray[i+2] - centerZ) / scaleFactor;
    }

    return newVertices;
}