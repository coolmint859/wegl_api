import { Vector3 } from "../../../utilities/index.js";
import GeoUtils from "../geometry-utils.js";

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
     * Generates the final model arrays (Float32Array for vertices, normals, textureCoords; Uint16Array for indices)
     * from the parsed data, suitable for WebGL buffers.
     * @param {Array<Vector3>} vertices An array of Vector3's, representing vertex positions.
     * @param {Array<Vector3>} normals An array Vector3's, representing vertex normals.
     * @param {Array<Array<number>>} faces An array of [v1, v2, v3] face indices.
     * @param {Array<Array<number>>} textureCoords An array of [s, t] texture coordinates.
     * @returns {object} An object containing Float32Arrays for 'vertices', 'normals', 'textureCoords' (if present),
     * and a Uint16Array for 'indices'.
     */
    static #generateModel(vertices, normals, faces, textureCoords) {
        let vertex_array = new Float32Array(vertices.length * 3);
        let normal_array = new Float32Array(vertices.length * 3);
        let index_array = new Uint16Array(faces.length * 3);

        // Populate vertex and normal arrays
        for (let i = 0; i < vertices.length; i++) {
            let vi = i * 3;

            vertex_array[vi] = vertices[i].x;
            vertex_array[vi + 1] = vertices[i].y;
            vertex_array[vi + 2] = vertices[i].z;

            // Ensure normals array has data for this vertex index
            if (normals[i]) {
                normal_array[vi] = normals[i].x;
                normal_array[vi + 1] = normals[i].y;
                normal_array[vi + 2] = normals[i].z;
            } else {
                // Fallback if a normal is somehow missing (shouldn't happen with robust parsing)
                normal_array[vi] = 0;
                normal_array[vi + 1] = 0;
                normal_array[vi + 2] = 0;
                console.warn(`Normal data missing for vertex ${i}.`);
            }
        }

        // Populate index array
        for (let i = 0; i < faces.length; i++) {
            let index_i = i * 3;

            // Ensure face indices are valid (refer to existing vertices)
            if (faces[i][0] < vertices.length && faces[i][1] < vertices.length && faces[i][2] < vertices.length) {
                index_array[index_i] = faces[i][0];
                index_array[index_i + 1] = faces[i][1];
                index_array[index_i + 2] = faces[i][2];
            } else {
                console.warn(`Invalid face index found at face ${i}. Skipping this face in index buffer.`);
                // You might need a more robust way to handle invalid faces,
                // e.g., shrinking the index_array or marking faces as invalid.
                // For now, this will put default values or potentially cause issues if not handled upstream.
            }
        }

        // If texture coordinates exist, create and populate texture_array
        if (textureCoords.length > 0) {
            let texture_array = new Float32Array(textureCoords.length * 2);
            for (let i = 0; i < textureCoords.length; i++) {
                let ti = i * 2;
                texture_array[ti] = textureCoords[i].x;
                texture_array[ti + 1] = textureCoords[i].y;
            }

            return {
                "vertices": vertex_array,
                "textureCoords": texture_array,
                "normals": normal_array,
                "indices": index_array
            };
        }

        // Return without textureCoords if not present
        return {
            "vertices": vertex_array,
            "normals": normal_array,
            "indices": index_array
        };
    }


    /**
     * generates a unit sphere
     * @param numBands a band is a set of polygons from north to south pole
     * @param numRings a ring is lateral set of polygons
     */
    static generateSphere(numRings, numBands) {
        if (numBands < 3 || numRings < 2)
            throw Error("Degenerate shape, not enough vertices.");

        let polar = Math.PI/numRings;
        let azimuthal = 2*Math.PI/numBands;

        let vertices = [];
        let faces = [];
        let normals = [];

        let tolerance = 0.00001;
        for (let azum_i = 0; azum_i <= numBands; azum_i++) {
            let azimuthal_next = azimuthal*azum_i;
            for (let polar_i = 1; polar_i < numRings; polar_i++) {
                let polar_next = polar*polar_i;
                let x = Math.sin(polar_next) * Math.cos(azimuthal_next);
                let y = Math.sin(polar_next) * Math.sin(azimuthal_next);
                let z = Math.cos(polar_next);

                // sin/cos functions are approximate, so this prevents really small numbers
                if (x < tolerance && x > -tolerance) x = 0;
                if (y < tolerance && y > -tolerance) y = 0;
                if (z < tolerance && z > -tolerance) z = 0;

                // dont add vertices on last band
                if (azum_i < numBands) {
                    vertices.push(new Vector3(x, y, z));
                    normals.push(new Vector3(x, y, z)); // a unit sphere's vertex normal vectors are it's vertices
                }
                // add faces with inner vertices
                if (azum_i > 0 && azum_i < numBands && polar_i >= 2 && polar_i < numRings) {
                    let curr_vert = vertices.length-1;
                    let vert_above = curr_vert-1;
                    let vert_left = vertices.length - numRings;
                    let vert_diag = vert_left-1;

                    faces.push([vert_diag, vert_left, curr_vert]);
                    faces.push([vert_diag, curr_vert, vert_above]);
                } else if (azum_i > 0 && polar_i >= 2 && polar_i < numRings) {
                    let curr_vert = polar_i-1;
                    let vert_above = curr_vert-1;
                    let vert_left = vertices.length-numRings+polar_i;
                    let vert_diag = vert_left-1;

                    faces.push([vert_diag, vert_left, curr_vert]);
                    faces.push([vert_diag, curr_vert, vert_above]);
                }
            }
        }

        // append poles
        vertices.push(new Vector3(0, 0, 1), new Vector3(0, 0, -1));
        normals.push(new Vector3(0, 0, 1), new Vector3(0, 0, -1));

        let north_pole = vertices.length-2;
        let south_pole = vertices.length-1;

        // add pole faces
        for (let i = 0; i < numBands; i++) {
            let vert_left_north = (numRings-1)*i;
            let vert_left_south = vert_left_north + (numRings-2);

            let vert_right_north;
            let vert_right_south;
            if (i < numBands-1) {
                vert_right_north = vert_left_north + numRings-1;
                vert_right_south = vert_right_north + (numRings-2);
            } else {
                vert_right_north = 0;
                vert_right_south = vert_right_north + (numRings-2);
            }
            
            faces.push([north_pole, vert_left_north, vert_right_north]);
            faces.push([south_pole, vert_right_south, vert_left_south]);
        }

        const model = RadialGeometry.#generateModel(vertices, normals, faces, []);
        const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
        const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

        return {
            vertex: { data: model.vertices, attributes: vertexAttributes, stride: 0 },
            normal: { data: model.normals, attributes: normalAttributes, stride: 0 },
            idxTriangles:  { data: model.indices,  attributes: [], stride: 0, dataType: 'uint16' },
        }
    }
}