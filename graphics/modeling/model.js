import ResourceCollector from "../../utilities/containers/collector.js";
import { Vector2, Vector3 } from "../../utilities/math/vector.js";

/**
 * Parses the header of a PLY file to extract essential information.
 * @param {string} modelFileString The entire content of the PLY file.
 * @returns {object} An object containing format, vertex count, face count, data start index,
 * and flags for texture coordinates and explicit normals.
 */
function getHeaderInfo(modelFileString) {
    let format = {};
    let vertexCount = 0;
    let faceCount = 0;
    let dataStartIndex = 0;
    let hasTextureCoords = false;
    let hasExplicitNormals = false;

    let lines = modelFileString.split("\n");
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim(); // Trim whitespace to handle variations
        if (line.startsWith("format")) {
            let tokens = line.split(" ");
            format.type = tokens[1];
            format.version = Number(tokens[2]);
        } else if (line.startsWith("element vertex")) {
            let tokens = line.split(" ");
            vertexCount = Number(tokens[2]);
        } else if (line.startsWith("property float s") && lines[i+1] && lines[i+1].trim() === "property float t") {
            // Check for 's t' texture properties
            hasTextureCoords = true;
        } else if (line.startsWith("property float u") && lines[i+1] && lines[i+1].trim() === "property float v") {
            // Check for 'u v' texture properties
            hasTextureCoords = true;
        } else if (line.startsWith("property float nx") && lines[i+1] && lines[i+1].trim() === "property float ny" && lines[i+2] && lines[i+2].trim() === "property float nz") {
            // Check for 'nx ny nz' normal properties
            hasExplicitNormals = true;
        } else if (line.startsWith("element face")) {
            let tokens = line.split(" ");
            faceCount = Number(tokens[2]);
        } else if (line.startsWith("end_header")) {
            dataStartIndex = i + 1;
            break;
        }
    }

    return {
        "format": format,
        "vertex_count": vertexCount,
        "face_count": faceCount,
        "start_index": dataStartIndex,
        "hasTextureCoords": hasTextureCoords,
        "hasExplicitNormals": hasExplicitNormals
    };
}

/**
 * Computes vertex normals by averaging face normals connected to each vertex.
 * This function is used if explicit normals are NOT provided in the PLY file.
 * @param {Array<Set<string>>} face_normal_sets A list where each element is a Set of JSON-stringified face normals
 * associated with the vertex at that index.
 * @returns {Array<Array<number>>} An array of normalized vertex normal vectors.
 */
function computeVertexNormals(face_normal_sets) {
    let vertex_normals = [];
    for (let i = 0; i < face_normal_sets.length; i++) {
        let normal_list_strs = Array.from(face_normal_sets[i]);

        let normal_list = [];
        normal_list_strs.forEach(normal_str => {
            normal_list.push(JSON.parse(normal_str));
        });

        let vertex_normal_sum = [0, 0, 0];
        if (normal_list.length === 0) {
            // Handle isolated vertices or errors, assign a default normal or throw error
            console.warn(`Vertex ${i} has no associated faces for normal computation. Assigning default normal.`);
            vertex_normals.push(new Vector3()); // Or throw an error, or assign a known default
            continue;
        }

        for (let j = 0; j < normal_list.length; j++) {
            vertex_normal_sum[0] += normal_list[j][0];
            vertex_normal_sum[1] += normal_list[j][1];
            vertex_normal_sum[2] += normal_list[j][2];
        }
        vertex_normals.push(normalize(vertex_normal_sum));
    }
    return vertex_normals;
}

/**
 * Parses the model data (vertices, faces, normals, texture coords) from the PLY file string.
 * @param {object} headerInfo Information parsed from the PLY header.
 * @param {string} modelFileString The entire content of the PLY file.
 * @returns {object} An object containing arrays of vertices, normals, texture coordinates, and faces.
 */
function getModelInfo(headerInfo, modelFileString) {
    let lines = modelFileString.split("\n");

    let vertices = [];
    let faces = [];
    let textureCoords = [];
    let explicitNormals = []; // Store normals if they are explicitly in the PLY

    // This set is only used if we need to compute normals (i.e., hasExplicitNormals is false)
    let vertex_normal_sets = Array.from({ length: headerInfo.vertex_count }, () => new Set());

    // Determine the number of properties per vertex line
    let propertiesPerVertex = 3; // x, y, z
    if (headerInfo.hasTextureCoords) {
        propertiesPerVertex += 2; // s, t (or u, v)
    }
    if (headerInfo.hasExplicitNormals) {
        propertiesPerVertex += 3; // nx, ny, nz
    }

    // Parse vertex data
    for (let i = headerInfo.start_index; i < headerInfo.start_index + headerInfo.vertex_count; i++) {
        let line = lines[i].trim();
        if (line.startsWith("//") || line.length === 0) { // Skip comments or empty lines
            continue;
        }
        let tokens = line.split(" ").filter(t => t.length > 0); // Filter out empty strings from multiple spaces
        let values = tokens.map(t => Number(t));

        if (values.length < propertiesPerVertex) {
            console.warn(`Line ${i+1}: Expected ${propertiesPerVertex} vertex properties, but found ${values.length}. Skipping line.`);
            // This could indicate a malformed PLY or a mismatch in header parsing logic.
            // For robustness, you might push default values or throw an error.
            continue;
        }

        let currentIdx = 0;
        vertices.push(new Vector3(
            values[currentIdx++], 
            values[currentIdx++], 
            values[currentIdx++]
        ));

        if (headerInfo.hasTextureCoords) {
            textureCoords.push(new Vector2(
                values[currentIdx++],
                values[currentIdx++]
            ));
        }
        if (headerInfo.hasExplicitNormals) {
            explicitNormals.push(new Vector3(
                values[currentIdx++], 
                values[currentIdx++], 
                values[currentIdx++]
            ));
        }
    }

    // Parse face data
    for (let i = headerInfo.start_index + headerInfo.vertex_count; i < headerInfo.start_index + headerInfo.vertex_count + headerInfo.face_count; i++) {
        let line = lines[i].trim();
        if (line.startsWith("//") || line.length === 0) { // Skip comments or empty lines
            continue;
        }
        let tokens = line.split(" ").filter(t => t.length > 0);
        let faceInfo = tokens.map(t => Number(t));

        if (faceInfo[0] !== 3) { // Assuming triangles (list property is 3)
            console.warn(`Line ${i+1}: Expected 3 vertices per face, but found ${vertex_indices[0]}. Skipping face.`);
            continue;
        }
        if (faceInfo.length < 4) { // 3 (for count) + 3 (for indices)
            console.warn(`Line ${i+1}: Malformed face line. Skipping.`);
            continue;
        }

        // Store face indices
        // values.slice(1) gets [idx1, idx2, idx3]
        faces.push(faceInfo.slice(1, 4));

        // Only compute face normals if explicit normals are NOT provided in PLY
        if (!headerInfo.hasExplicitNormals) {
            let v1_idx = faceInfo[1];
            let v2_idx = faceInfo[2];
            let v3_idx = faceInfo[3];

            // Basic validation for vertex indices
            if (v1_idx >= vertices.length || v2_idx >= vertices.length || v3_idx >= vertices.length) {
                console.warn(`Face references out-of-bounds vertex index at line ${i+1}. Skipping normal calculation for this face.`);
                continue;
            }

            let vert1 = vertices[v1_idx];
            let vert2 = vertices[v2_idx];
            let vert3 = vertices[v3_idx];

            let vector1 = vert2.sub(vert1);
            let vector2 = vert2.sub(vert3);
            let face_normal = vector1.cross(vector2).normal();

            // Add face normal to the sets for each vertex
            vertex_normal_sets[v1_idx].add(JSON.stringify(face_normal));
            vertex_normal_sets[v2_idx].add(JSON.stringify(face_normal));
            vertex_normal_sets[v3_idx].add(JSON.stringify(face_normal));
        }
    }

    let vertex_normals;
    if (headerInfo.hasExplicitNormals) {
        vertex_normals = explicitNormals;
    } else {
        // If no explicit normals, compute them from face normals
        vertex_normals = computeVertexNormals(vertex_normal_sets);
    }
    
    return {
        "vertices": vertices,
        "normals": vertex_normals,
        "textureCoords": textureCoords,
        "faces": faces
    };
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
function generateModel(vertices, normals, faces, textureCoords) {
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
 * Main entry function for parsing a PLY model file.
 * @param {string} modelFilePath The path to the PLY file.
 * @returns {Promise<object>} A promise that resolves to an object containing WebGL-ready buffers.
 */
export async function createModel(modelFilePath) {
    if (modelFilePath.split(".").pop() !== "ply") {
        throw new Error("[ModelLoader] File type is not PLY.");
    }
    let modelFileString;
    if (!ResourceCollector.contains(modelFilePath)) {
        console.log(`loading new resource ${modelFilePath}`)
        modelFileString = await ResourceCollector.load(modelFilePath, ResourceCollector.fetchTextFile);
    } else {
        console.log(`waiting for resource ${modelFilePath}`)
        modelFileString = await ResourceCollector.getWhenLoaded(modelFilePath, { pollTimeout: 1.5, pollInterval: 0.1});
    }
    // if (modelFileString === null) {
    //     console.error(`[modelLoader] Could not load file '${modelFilePath}' before timeout. Using default.`);
    //     return generateRectPrism();
    // }
    if (!modelFileString.startsWith("ply") || modelFilePath.split(".").pop() !== "ply") {
        throw new Error("[ModelLoader] File type is not ply or file does not start with 'ply'.");
    }

    // Get the header info
    let headerInfo = getHeaderInfo(modelFileString);
    // console.log("Header Info:", headerInfo); // For debugging

    // From the header info, parse out the vertices, normals, and faces
    let modelInfo = getModelInfo(headerInfo, modelFileString);
    // console.log("Model Info (parsed):", modelInfo); // For debugging

    // The resulting mesh contains the vertices, normals, and indices needed for rendering.
    let model = generateModel(modelInfo.vertices, modelInfo.normals, modelInfo.faces, modelInfo.textureCoords);
    console.log("Model Data:", model);
    return model;
}

/**
 * generates a unit sphere
 * @param numBands a band is a set of polygons from north to south pole
 * @param numRings a ring is lateral set of polygons
 */
export function gernerateSphere(numRings, numBands) {
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

    return generateModel(vertices, normals, faces, []);
}


export function generateRectPrism() {
    let vertices = new Float32Array([
        1, -1, -1, 1, 1, -1, -1, -1, -1, -1, 1, -1,
        -1, -1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1,
        1, -1, 1, 1, 1, 1, 1, -1, -1, 1, 1, -1,
        -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, 1, 1,
        -1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1, -1,
        -1, -1, -1, -1, -1, 1, 1, -1, -1, 1, -1, 1,
    ]);

    let normals = new Float32Array([
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    ]);

    let indices = new Int16Array([
        0, 2, 1, 1, 2, 3, 4, 5, 6,
        5, 7, 6, 9, 8, 10, 9, 10, 11,
        15, 12, 14, 15, 13, 12, 17, 16, 18,
        17, 18, 19, 20, 23, 21, 20, 22, 23,
    ]);

    let textureCoords = new Float32Array([
        0, 1, 0, 0, 1, 1, 1, 0,
        0, 1, 1, 1, 0, 0, 1, 0,
        0, 1, 0, 0, 1, 1, 1, 0,
        0, 1, 0, 0, 1, 1, 1, 0,
        0, 1, 0, 0, 1, 1, 1, 0,
        0, 1, 0, 0, 1, 1, 1, 0,
    ]);

    return {
        "vertices": vertices,
        "textureCoords": textureCoords,
        "normals": normals,
        "indices": indices
    };
}