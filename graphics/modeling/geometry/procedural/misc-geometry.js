import * as GeoUtils from "../geometry-utils.js";

/** -------------------- MISC GEOMETRY -------------------- */

/**
 * Generates vertex data for a pyramid, centered at the origin. Normalized to fit within a unit cube.
 * @returns {object} an object containing vertex data, designed to work with a geometry instance
 */
export function generatePyramid() {
    const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
    const h = Math.sqrt(2);
    const vertexArray = new Float32Array([
         1, 0,  1,  0,  h,  0, -1, 0,  1,      // front
         1, 0, -1,  0,  h,  0,  1, 0,  1,      // right
        -1, 0, -1,  0,  h,  0,  1, 0, -1,      // left
        -1, 0,  1,  0,  h,  0, -1, 0, -1,      // back
         1, 0, -1,  1,  0,  1, -1, 0,  1,      // bottom right
        -1, 0,  1, -1,  0, -1,  1, 0, -1,      // bottom left
    ]);
    
    // [ 0, 1, 2, 3, ...];
    const indexArray = Uint16Array.from({ length: 18 }, (v, i) => i);

    const normalArray = GeoUtils.generateNormals(vertexArray, indexArray);
    const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

    const pyramid = {
        vertex: { data: GeoUtils.normalizeVertices(vertexArray), attributes: vertexAttributes, stride: 0 },
        normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
        index:  { data: indexArray,  attributes: [], stride: 0, dataType: 'uint16' },
    }

    return pyramid;
}