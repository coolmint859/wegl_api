import Transform from "../../utilities/containers/transform.js";
import Quaternion, { EulerOrder } from "../../utilities/math/quaternion.js";
import { Vector3, Vector4 } from "../../utilities/math/vector.js";

/** -------------------------------------- PLATONIC SOLIDS -------------------------------------- */

/**
 * Generates a tetahredon. Normalized to fit within a unit cube. (To make it bigger overall, use a transform instance)
 * @param {number} width the width (x-axis) of the rectangular prism. Must be greater than 0.
 * @param {number} height the height (y-axis) of the rectangular prism. Must be greater than 0.
 * @param {number} depth the depth (z-axis) of the rectangular prism. Must be greater than 0.
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generateTetrahedron(width, height, depth) {
    if (width <= 0) {
        console.warn(`[GenerateTetrahedron] Width must be greater than 0. Assigning default (width=1).`);
        width = 1;
    }
    if (height <= 0) {
        console.warn(`[GenerateTetrahedron] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (depth <= 0) {
        console.warn(`[GenerateTetrahedron] Depth must be greater than 0. Assigning default (depth=1).`);
        depth = 1;
    }

    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
    const hw = width/2, hh = height / Math.sqrt(8), hd = depth/2
    const vertexArray = new Float32Array([
         hw,  hh,  0,  0, -hh, -hd, -hw,  hh,   0,
         hw,  hh,  0,  0, -hh,  hd,   0, -hh, -hd,
        -hw,  hh,  0,  0, -hh,  hd,  hw,  hh,   0,
          0, -hh, hd, -hw, hh,   0,   0, -hh, -hd
    ]);

    // [ 0, 1, 2, 3, ...];
    const indexArray = Uint16Array.from({ length: 12 }, (v, i) => i);

    const normalArray = generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: normalizeVertices(vertexArray), attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generates a rectangular prism. Normalized to fit within a unit cube. (To make it bigger overall, use a transform instance.)
 * @param {number} width the width (x-axis) of the rectangular prism. Must be greater than 0.
 * @param {number} height the height (y-axis) of the rectangular prism. Must be greater than 0.
 * @param {number} depth the depth (z-axis) of the rectangular prism. Must be greater than 0.
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generateRectPrism(width, height, depth) {
    if (width <= 0) {
        console.warn(`[GenerateRectPrism] Width must be greater than 0. Assigning default (width=1).`);
        width = 1;
    }
    if (height <= 0) {
        console.warn(`[GenerateRectPrism] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (depth <= 0) {
        console.warn(`[GenerateRectPrism] Depth must be greater than 0. Assigning default (depth=1).`);
        depth = 1;
    }

    const baseSquare = triangulate(new Float32Array([ 1, -1, 0, 1, 1, 0, -1,  1, 0, -1, -1, 0 ]));
    const rotations = [
        new Quaternion(),                               // front face
        Quaternion.fromEulerAngles(0, Math.PI, 0),      // back face
        Quaternion.fromEulerAngles(0, Math.PI/2, 0),    // right face
        Quaternion.fromEulerAngles(0, -Math.PI/2, 0),   // left face
        Quaternion.fromEulerAngles(-Math.PI/2, 0, 0),   // top face
        Quaternion.fromEulerAngles(Math.PI/2, 0, 0)     // bottom face
    ];
    const transforms = [];
    for (let i = 0; i < rotations.length; i++) {
        const pos = rotations[i].rotateVector(Transform.localForward);
        transforms.push(new Transform({ position: pos, rotation: rotations[i] }));
    }

    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }]
    const cube = tessellate(baseSquare.vertex, baseSquare.index, transforms);
    for (let i = 0; i < cube.vertex.length-2; i+=3) {
        cube.vertex[i+0] *= width/2;
        cube.vertex[i+1] *= height/2;
        cube.vertex[i+2] *= depth/2;
    }
    
    const normalArray = generateNormals(cube.vertex, cube.index);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    const uvAttributes = [{ name: 'uv', size: 2, dataType: 'float', offset: 0 }]
    const uvArray = new Float32Array([
        1, 1, 1, 0, 0, 0, 0, 1,
        1, 1, 1, 0, 0, 0, 0, 1,
        1, 1, 1, 0, 0, 0, 0, 1,
        1, 1, 1, 0, 0, 0, 0, 1,
        1, 1, 1, 0, 0, 0, 0, 1,
        1, 1, 1, 0, 0, 0, 0, 1,
    ]);

    return {
        vertex: { data: normalizeVertices(cube.vertex), attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        uv:     { data: uvArray,     attributes: uvAttributes, stride: 0},
        index:  { data: cube.index,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generates an octahedron.
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generateOctahedron(width, height, depth) {
    if (width <= 0) {
        console.warn(`[GenerateOctahedron] Width must be greater than 0. Assigning default (width=1).`);
        width = 1;
    }
    if (height <= 0) {
        console.warn(`[GenerateOctahedron] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (depth <= 0) {
        console.warn(`[GenerateOctahedron] Depth must be greater than 0. Assigning default (depth=1).`);
        depth = 1;
    }

    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
    const hw = width/2, hh = height / Math.sqrt(2), hd = depth/2
    const vertexArray = new Float32Array([
        0,  hh, 0,  hw, 0,  hd,  hw, 0, -hd,
        0,  hh, 0,  hw, 0, -hd, -hw, 0, -hd,
        0,  hh, 0, -hw, 0,  hd,  hw, 0,  hd,
        0,  hh, 0, -hw, 0, -hd, -hw, 0,  hd,
        0, -hh, 0,  hw, 0,  hd, -hw, 0,  hd,
        0, -hh, 0,  hw, 0, -hd,  hw, 0,  hd,
        0, -hh, 0, -hw, 0, -hd,  hw, 0, -hd,
        0, -hh, 0, -hw, 0,  hd, -hw, 0, -hd,
    ]);

    // [ 0, 1, 2, 3, ...];
    const indexArray = Uint16Array.from({ length: 24 }, (v, i) => i);

    const normalArray = generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: normalizeVertices(vertexArray), attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generates an dodecahedron.
 * @param {number} width the width (x-axis) of the rectangular prism. Must be greater than 0.
 * @param {number} height the height (y-axis) of the rectangular prism. Must be greater than 0.
 * @param {number} depth the depth (z-axis) of the rectangular prism. Must be greater than 0.
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generateDodecahedron(width, height, depth) {
    if (width <= 0) {
        console.warn(`[GenerateRectPrism] Width must be greater than 0. Assigning default (width=1).`);
        width = 1;
    }
    if (height <= 0) {
        console.warn(`[GenerateRectPrism] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (depth <= 0) {
        console.warn(`[GenerateRectPrism] Depth must be greater than 0. Assigning default (depth=1).`);
        depth = 1;
    }

    const numVertices = 5;
    const midRadius = 1.309;
    const goldRatio = (1 + Math.sqrt(5)) / 2;

    // calculate base pentagon
    const angle = 2 * Math.PI / numVertices;
    const basePentagon = new Float32Array(numVertices*3);
    for (let i = 0; i < numVertices; i++) {
        const offset = 3*i;
        basePentagon[offset+0] = Math.cos(angle * i);
        basePentagon[offset+1] = Math.sin(angle * i);
        basePentagon[offset+2] = 0;
    }
    const pentagon = triangulate(basePentagon);

    // calculate rotation transformations
    const pi_2 = Math.PI/2;
    const rotations = [
        // these are for the 'top' and 'bottom' pentagons
        Quaternion.fromEulerAngles(1*pi_2, 0, pi_2, EulerOrder.YXZ),
        Quaternion.fromEulerAngles(3*pi_2, 0, pi_2, EulerOrder.YXZ),
    ];

    for (let i = 0; i <= 9; i++) {
        // these are for the side-facing pentagons
        const pitch = (i % 2 === 0 ? Math.atan(2) : 2*Math.atan(goldRatio)) + pi_2;
        const yaw = i * Math.PI/5;
        const roll = i % 2 === 0 ? -pi_2 : pi_2;
        rotations.push(Quaternion.fromEulerAngles(pitch, yaw, roll, EulerOrder.YXZ))
    }

    // calculate positions, append to transforms
    const transforms = [];
    for (let i = 0; i < rotations.length; i++) {
        const pos = rotations[i].rotateVector(Transform.localForward).mult(midRadius);
        transforms.push(new Transform({ position: pos, rotation: rotations[i] }));
    }

    // tessellate the pentagons
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
    const dodecahedron = tessellate(pentagon.vertex, pentagon.index, transforms);
    for (let i = 0; i < dodecahedron.vertex.length-2; i+=3) {
        dodecahedron.vertex[i+0] *= width/2;
        dodecahedron.vertex[i+1] *= height/2;
        dodecahedron.vertex[i+2] *= depth/2;
    }

    const normalArray = generateNormals(dodecahedron.vertex, dodecahedron.index);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: normalizeVertices(dodecahedron.vertex), attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: dodecahedron.index,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/**
 * Generates an icosahedron.
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generateIcosahedron() {

}

/** -------------------------------------- OTHER POLYHEDRA -------------------------------------- */

/**
 * Generates a pyramid. Normalized to fit within a unit cube. (To make it bigger overall, use a transform instance.)
 * @param {number} height the height of the pyramid. Must be greater than 0.
 * @param {number} length the length of the pyramid base. Must be greater than 0.
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generatePyramid(width, height, depth) {
    if (width <= 0) {
        console.warn(`[GeneratePyramid] Width must be greater than 0. Assigning default (width=1).`);
        width = 1;
    }
    if (height <= 0) {
        console.warn(`[GeneratePyramid] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (depth <= 0) {
        console.warn(`[GeneratePyramid] Depth must be greater than 0. Assigning default (depth=1).`);
        depth = 1;
    }

    const hw = width/2, hh = height/2, hd = depth/2;
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
    const vertexArray = new Float32Array([
         hw, 0, hd,    0, hh,   0, -hw, 0,  hd,      // front
         hw, 0, -hd,   0, hh,   0,  hw, 0,  hd,      // right
        -hw, 0, -hd,   0, hh,   0,  hw, 0, -hd,      // left
        -hw, 0,  hd,   0, hh,   0, -hw, 0, -hd,      // back
         hw, 0, -hd,  hw,  0,  hw, -hw, 0,  hd,      // bottom right
        -hw, 0,  hd, -hw,  0, -hw,  hw, 0, -hd,      // bottom left
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
 * Generates a cone. Normalized to fit within a unit cube. (To make it bigger overall, use a transform instance.)
 * @param {number} numBands the number of bands around the cone. Must be at least 3.
 * @param {number} height the height of the cone. Must be greater than 0.
 * @param {number} radius the radius of the cone. Must be greater than 0.
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generateCone(numBands, height, radius) {
    if (numBands < 3) {
        console.warn(`[GenerateCone] numBands must be greater than 2. Assigning default (numBands=5).`);
        numBands = 5;
    }
    if (height <= 0) {
        console.warn(`[GenerateCone] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (radius <= 0) {
        console.warn(`[GenerateCone] Radius must be greater than 0. Assigning default (radius=1).`);
        radius = 1;
    }

    //----- vertices -----//

    const numVertices = 3 * numBands + 1;
    const vertexArray = new Float32Array(3*numVertices);
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

        for (let k = 0; k < 3; k++) {
            // k=0 -> base; k=1 -> side; k=2 -> apex;
            const offset = 3 * (k * numBands + i + 1);
            vertexArray[offset+0] = k === 2 ? 0 : x;
            vertexArray[offset+1] = k === 2 ? height/2 : -height/2;
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
 * @param {number} numBands the number of bands around the cylinder. Must be at least 3.
 * @param {number} height the height of the cylinder. Must be greater than 0.
 * @param {number} radius the radius of the cylinder. Must be greater than 0.
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generateCylinder(numBands, height, radius) {
    if (numBands < 3) {
        console.warn(`[GeneratePyramid] numBands must be greater than 2. Assigning default (numBands=10).`);
        numBands = 10;
    }
    if (height <= 0) {
        console.warn(`[GeneratePyramid] Height must be greater than 0. Assigning default (height=1).`);
        height = 1;
    }
    if (radius <= 0) {
        console.warn(`[GeneratePyramid] Radius must be greater than 0. Assigning default (radius=1).`);
        radius = 1;
    }

    //----- vertices -----//

    const numVertices = 4 * numBands + 2;
    const vertexArray = new Float32Array(3*numVertices);
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
        let x = radius * Math.cos(angle);
        let z = radius * Math.sin(angle);

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

    const normalArray = generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    return {
        vertex: { data: vertexArray, attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }
}

/** -------------------------------------- UTILITY FUNCTIONS -------------------------------------- */

/**
 * Generate vertex normals given a flat vertex array and a flat index array. These can be any kind of typed array.
 * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
 * @param {ArrayBufferLike} indexArray a flat typed array of indices into the vertex array, representing faces.
 * @param {object} options options for generating the normals.
 * @returns {Float32Array} a flat Float32Array of vertex normals
 */
export function generateNormals(vertexArray, indexArray) {
    const sharedNormals = calculateSharedNormals(vertexArray, indexArray);
    return calculateVertexNormals(sharedNormals, vertexArray.length);
}

/** Calculates the face normals shared by the vertices */
function calculateSharedNormals(vertexArray, indexArray) {
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
    return sharedNormals;
}

/** Calculates the vertex normals using the shared face normals of each vertex */
function calculateVertexNormals(sharedNormals, arrayLength) {
    const normalArray = new Float32Array(arrayLength);

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
 * Transform vertices such that they fit snugly in a unit cube without distortion. Does not effect the original vertex array.
 * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
 * @param {object} options options for vertex normalization
 * @param {boolean} options.aboutCentroid if true, will shift the vertices such that the geometric center is at the centroid. Otherwise, will shift the vertices according to the bounding box center.
 * @returns {ArrayBufferLike} a new Typed Array of the same kind that was given, but with the transformed vertices.
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

/**
 * Performs fan triangulation on a set of vertices. The input vertices should form a convex shape for the best results.
 * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
 * @returns {object} an object containing the vertices (including center point) and index array. The vertex array is of the same type as the input array, and the index array is a Uint16Array
 */
export function triangulate(vertexArray) {
    const numVertices = Math.trunc(vertexArray.length/3);

    // handle shapes that have 3 or 4 vertices differently
    if (numVertices === 3) {
        return { vertex: vertexArray, index: new Uint16Array([0, 1, 2]) };
    } else if (numVertices === 4) {
        return { vertex: vertexArray, index: new Uint16Array([0, 1, 2, 0, 2, 3]) };
    }

    let xSum = 0, ySum = 0, zSum = 0;
    for (let i = 0; i < vertexArray.length-2; i+=3) {
        xSum += vertexArray[i+0];
        ySum += vertexArray[i+1];
        zSum += vertexArray[i+2];
    }
    const indexArray = new Uint16Array(numVertices*3);
    const newVertices = new (vertexArray.constructor)(vertexArray.length+3);

    newVertices[0] = xSum / numVertices;
    newVertices[1] = ySum / numVertices;
    newVertices[2] = zSum / numVertices;

    for (let i = 0; i < numVertices; i++) {
        let vOffset = 3 * (i+1);
        newVertices[vOffset+0] = vertexArray[i*3+0];
        newVertices[vOffset+1] = vertexArray[i*3+1];
        newVertices[vOffset+2] = vertexArray[i*3+2];

        let iOffset = 3*i;
        indexArray[iOffset+0] = 0;
        indexArray[iOffset+1] = i+1;
        indexArray[iOffset+2] = i < numVertices-1 ? i+2 : 1;
    }

    return { vertex: newVertices, index: indexArray };
}

/**
 * Tesselates a primitive shape by applying a set of transformations to it.
 * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
 * @param {ArrayBufferLike} indexArray the indices defining the faces created by the input vertices. The faces are treated as one unit during the transformations.
 * @param {Array<Transform>} transforms a js array of Transform instances. These will each be applied to the vertices given, generating new vertices.
 * @returns {object} an object containing the new vertex and index array. The size of each is proportional to the number of transforms and the size of the input arrays
 */
export function tessellate(vertexArray, indexArray, transforms) {
    if (transforms.length === 0) {
        return { vertex: vertexArray, index: indexArray };
    }

    const basisVectors = [];
    for (let i = 0; i < vertexArray.length-2; i+=3) {
        const vector = new Vector4(vertexArray[i+0], vertexArray[i+1], vertexArray[i+2], 1)
        basisVectors.push(vector);
    }

    const vertexArraySize = vertexArray.length * transforms.length;
    const newVertices = new (vertexArray.constructor)(vertexArraySize);

    const indexArraySize = indexArray.length * transforms.length;
    const newIndices = new (indexArray.constructor)(indexArraySize);

    const numVertices = Math.trunc(vertexArray.length/3);
    for (let i = 0; i < transforms.length; i++) {
        const transform = transforms[i];
        for (let k = 0; k < basisVectors.length; k++) {
            const transVert = transform.applyTo(basisVectors[k]);
            const offset = i * vertexArray.length + 3*k;

            newVertices[offset+0] = transVert.x;
            newVertices[offset+1] = transVert.y;
            newVertices[offset+2] = transVert.z;            
        }

        const indexDiff = numVertices * i;
        for (let k = 0; k < indexArray.length; k++) {
            const offset = i * indexArray.length + 3*k;
            newIndices[offset+0] = indexArray[k*3+0] + indexDiff;
            newIndices[offset+1] = indexArray[k*3+1] + indexDiff;
            newIndices[offset+2] = indexArray[k*3+2] + indexDiff;
        }
    }

    return { vertex: newVertices, index: newIndices };
}
