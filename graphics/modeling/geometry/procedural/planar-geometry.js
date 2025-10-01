import * as GeoUtils from "../geometry-utils.js";

/** -------------------- PLANAR GEOMETRY -------------------- */

/**
 * Generates vertex data for a xz-plane, centered at the origin.
 * @param {number} rows the number of rows on the plane. a higher value means more triangles
 * @param {number} cols the number of columns on the plane. a higher value means more triangles
 * @param {number} width the width (x-axis) of the plane
 * @param {number} depth the depth (z-axis) of the plane
 * @returns {object} an object containing the arrays and accompanying attributes
 */
export function generatePlane(rows, cols, width, depth) {
    if (rows <= 0) {
        console.warn(`[GeneratePlane] 'rows' must be greater than 0. Assigning default (rows=1).`);
        numSides = 1;
    }
    if (cols <= 0) {
        console.warn(`[GeneratePlane] 'cols' must be greater than 0. Assigning default (cols=1).`);
        cols = 1;
    }
    if (width <= 0) {
        console.warn(`[GeneratePlane] 'width' must be greater than 0. Assigning default (width=1).`);
        width = 1;
    }
    if (depth <= 0) {
        console.warn(`[GeneratePlane] 'depth' must be greater than 0. Assigning default (depth=1).`);
        depth = 1;
    }

    const numVertices = (rows+1) * (cols+1);
    const vertexArray = new Float32Array(numVertices*3);
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }]

    const numIndices = rows * cols * 6;
    const indexArray = new Uint32Array(numIndices);

    let vOffset = 0, iOffset = 0;
    for (let i = 0; i < rows+1; i++) {
        for (let j = 0; j < cols+1; j++) {
            // --- VERTICES --- //
            vertexArray[vOffset++] = (2 * j / cols - 1) * width;
            vertexArray[vOffset++] = 0
            vertexArray[vOffset++] = (2 * i / rows - 1) * depth;

            // --- INDICES --- //
            if (i >= rows || j >= cols) continue; // skip last row/col

            // the vertex indices of a quad at row i and col j
            const topLeft = i * (cols + 1) + j;
            const topRight = topLeft + 1;
            const btmLeft = (i + 1) * (cols + 1) + j;
            const btmRight = btmLeft + 1;

            // create two triangles from the quad
            indexArray[iOffset++] = topLeft;
            indexArray[iOffset++] = btmLeft;
            indexArray[iOffset++] = topRight;

            indexArray[iOffset++] = topRight;
            indexArray[iOffset++] = btmLeft;
            indexArray[iOffset++] = btmRight;
        }
    }

    const normalArray = GeoUtils.generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    const plane = {
        vertex: { data: vertexArray, attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        idxTriangles:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint32' },
    }

    return plane;
}

/**
 * Generates vertex data for a regular polygon, centered at the origin. Normalized to fit within a unit cube.
 * @param {number} numSides the number of sides of the polygon. Must be at least 3.
 * @param {object} options options for determining how the polygon should be made
 * @param {number} options.initRotation initial rotation about central axis. default is 0.
 * @param {boolean} options.shareVertices if true, the vertices around the perimeter will be shared, otherwise each triangle will be independent from eachother. Default is true.
 * @param {number} options.centerOffset the offset along the polygon's perpendicular axis for which the central vertex will be defined. Default is 0.
 * @returns {object} an object containing the new vertex and index array. The size of each is proportional to the number of polygon sides
 */
export function generateRegularPolygon(numSides, options={}) {
    if (numSides < 3) {
        console.warn(`[GenerateRegularPolygon] numSides must be at least 3. Assigning default (numSides=3).`);
        numSides = 3;
    }

    const rotation = options.initRotation ?? 0;

    const angle = 2 * Math.PI / numSides;
    const vertexArray = new Float32Array(numSides*3);
    for (let i = 0; i < numSides; i++) {
        let cosAngle = Math.cos(i*angle + rotation);
        let sinAngle = Math.sin(i*angle + rotation);

        const epsilon = 0.0001;
        cosAngle = Math.abs(cosAngle) > epsilon ? cosAngle : 0
        sinAngle = Math.abs(sinAngle) > epsilon ? sinAngle : 0

        const offset = i*3;
        vertexArray[offset+0] = cosAngle
        vertexArray[offset+1] = sinAngle
        vertexArray[offset+2] = 0;
    }

    const shape = GeoUtils.triangulate(vertexArray, options);
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];

    const normalArray = GeoUtils.generateNormals(shape.vertex, shape.idxTriangles);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    const regpoly = {
        vertex: { data: shape.vertex, attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        idxTriangles:  { data: shape.idxTriangles,  attributes: [], stride: 0, dataType: 'uint16' },
    }

    return regpoly;
}

/**
 * Generates vertex data for a screen filling quad
 */
export function generateScreenQuad() {
    const vertex = new Float32Array([
        -1, -1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0 
    ])
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];

    const index = new Uint16Array([
        1, 0, 2, 1, 2, 3
    ])

    const quad = {
        vertex: { data: vertex, attributes: vertexAttributes, stride: 0 },
        idxTriangles:  { data: index,  attributes: [], stride: 0, dataType: 'uint16' },
    }

    return quad;
}