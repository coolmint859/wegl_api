import { Quaternion, Vector4, ResourceCollector, StreamReader, Vector3 } from "../../utilities/index.js";
import { Transform } from "../../components/index.js";
import Geometry from "./geometry.js";

/**
 * Utility functions for manipulating geometric data
 */
export default class GeoUtils {
    /**
     * Load and create geometry data from a geometry file (e.g. PLY, OBJ...) 
     * @param {string} geometryPath the path to the geometry file.
     * @param {object} options options for loading and storage of the data
     * @returns {Geometry | null} a promise that resolves with a new geometry instance created with the loaded data, or null if the file data could be loaded.
     */
    static async load(geometryPath, options={}) {
        if (typeof geometryPath !== 'string' || geometryPath.trim() === '') {
            console.error(`[GeometryLoader] Expected 'geometryPath' to be a valid path to a geometry file. Cannot create geometry instance.`)
            return null;
        }

        if (ResourceCollector.contains(geometryPath)) {
            const geometryData = await ResourceCollector.getWhenLoaded(
                geometryPath, { pollInterval: 0.2, pollTimeout: 3 }
            );

            return new Geometry(geometryPath, geometryData);
        }

        const geometryData = await ResourceCollector.load(
            geometryPath, StreamReader.read,
            { 
                maxRetries: options.maxRetries ?? 3,
                disposalDelay: options.disposalDelay ?? 0.5,
                category: 'geometry',
                loadData: options
            }
        )

        // BUG: only works properly when vertices are not interleaved - need to fix so interleaving happens after loading.
        if (options.normalizeVertices) {
            geometryData.vertex.data = GeoUtils.normalizeVertices(geometryData.vertex.data, options)
        }

        console.log(`[GeometryLoader] Successfully Loaded new geometry '${geometryPath}'.`);
        return new Geometry(geometryPath, geometryData);
    }

    /**
     * Performs fan triangulation on a set of vertices. The input vertices should form a convex shape for the best results.
     * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
     * @param {object} options options for triangulating the vertices
     * @param {boolean} options.shareVertices if true, overlapping vertices will be shared (including the center), otherwise each triangle will be independent from eachother. Default is true.
     * @param {number} options.centerOffset the offset along the shape's perpendicular axis for which the central vertex will be defined. Default is 0 (along same plane of other vertices).
     * @returns {object} an object containing the vertices (including center point) and index array. The vertex array is of the same type as the input array, and the index array is a Uint16Array
     */
    static triangulate(vertexArray, options={}) {
        const numVertices = Math.trunc(vertexArray.length/3);
        if (numVertices === 3) {
            return { vertex: vertexArray, idxTri: new Uint16Array([0, 1, 2]) };
        } else if (numVertices === 4) {
            return { vertex: vertexArray, idxTri: new Uint16Array([0, 1, 2, 0, 2, 3]) };
        }

        let xSum = 0, ySum = 0, zSum = 0;
        for (let i = 0; i < vertexArray.length; i+=3) {
            xSum += vertexArray[i+0];
            ySum += vertexArray[i+1];
            zSum += vertexArray[i+2];
        }

        const offset = options.centerOffset ?? 0;
        let offsetVector = new Vector4(0, 0, offset, 0);
        if (options.transform) {
            offsetVector = options.transform.applyTo(offsetVector);
        }

        const cx = xSum / numVertices + offsetVector.x;
        const cy = ySum / numVertices + offsetVector.y;
        const cz = zSum / numVertices + offsetVector.z;
        const centerVertex = new Vector3(cx, cy, cz);

        if (options.shareVertices ?? true) {
            return GeoUtils.#triangulateShared(vertexArray, centerVertex);
        } else {
            return GeoUtils.#triangulateIndep(vertexArray, centerVertex);
        }
    }

    /** Fan triangulation where adjacent vertices are shared */
    static #triangulateShared(vertexArray, centerVertex) {
        const numVertices = Math.trunc(vertexArray.length/3);
        const indexArray = new Uint16Array(numVertices*3);
        const newVertices = new (vertexArray.constructor)(vertexArray.length+3);

        newVertices[0] = centerVertex.x;
        newVertices[1] = centerVertex.y;
        newVertices[2] = centerVertex.z;

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

        return { vertex: newVertices, idxTri: indexArray };
    }

    /** Fan triangulation where triangles are independent (no shared vertices) */
    static #triangulateIndep(vertexArray, centerVertex) {
        const numVertices = Math.trunc(vertexArray.length/3);
        const numNewVertices = numVertices * 3;
        const newVertices = new (vertexArray.constructor)(numNewVertices*3);

        for (let i = 0; i < numVertices; i++) {
            const vOffset = i*9;
            newVertices[vOffset+0] = centerVertex.x;
            newVertices[vOffset+1] = centerVertex.y;
            newVertices[vOffset+2] = centerVertex.z;

            const initOffset1 = i*3;
            newVertices[vOffset+3] = vertexArray[initOffset1+0];
            newVertices[vOffset+4] = vertexArray[initOffset1+1];
            newVertices[vOffset+5] = vertexArray[initOffset1+2];

            const initOffset2 = i < numVertices-1 ? (i+1)*3 : 0;
            newVertices[vOffset+6] = vertexArray[initOffset2+0];
            newVertices[vOffset+7] = vertexArray[initOffset2+1];
            newVertices[vOffset+8] = vertexArray[initOffset2+2];
        }

        const indexArray = Uint16Array.from({ length: numNewVertices }, (v, i) => i);

        return { vertex: newVertices, idxTri: indexArray };
    }

    /**
     * Generate vertex normals given a flat vertex array and a flat index array. These can be any kind of typed array.
     * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
     * @param {ArrayBufferLike} indexArray a flat typed array of indices into the vertex array, representing faces.
     * @returns {Float32Array} a flat Float32Array of vertex normals
     */
    static generateNormals(vertexArray, indexArray) {
        const sharedNormals = GeoUtils.#calculateSharedNormals(vertexArray, indexArray);
        return GeoUtils.#calculateVertexNormals(sharedNormals, vertexArray.length);
    }

    /** Calculates the face normals shared by the vertices */
    static #calculateSharedNormals(vertexArray, indexArray) {
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
    static #calculateVertexNormals(sharedNormals, arrayLength) {
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
    static normalizeVertices(vertexArray, options = {}) {
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
     * Tesselates a primitive shape by applying a set of transformations to it.
     * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
     * @param {ArrayBufferLike} indexArray the indices defining the faces created by the input vertices. The faces are treated as one unit during the transformations.
     * @param {Array<Transform>} transforms a js array of Transform instances. These will each be applied to the vertices given, generating new vertices.
     * @returns {object} an object containing the new vertex and index array. The size of each is proportional to the number of transforms and the size of the input arrays
     */
    static tessellate(vertexArray, indexArray, transforms) {
        if (transforms.length === 0) {
            return { vertex: vertexArray, idxTri: indexArray };
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

        return { vertex: newVertices, idxTri: newIndices };
    }

    /**
     * Generate a wireframe index array for drawing lines from a triangle-based index array.
     * @param {ArrayBufferLike} indexTriangle an index array representing triangles on an arbitrary mesh.
     * @returns {ArrayBufferLike | null} a new index array representing unique edges between vertices from the provided index array. Returns null if the provided array was invalid.
     */
    static generateWireframe(indexTriangle) {
        if (!indexTriangle || indexTriangle.length % 3 !== 0) {
            console.error(`[GeoUtils] Expected 'indexTriangle' to be a typed array of indices whose length is divisible by 3. Cannot create wireframe array.`);
            return null;
        }

        const uniqueEdges = new Set();
        const indexWire = [];

        const addEdge = function(a, b) {
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            if (!uniqueEdges.has(key)) {
                uniqueEdges.add(key);
                indexWire.push(a, b);
            }
        }

        for (let i = 0; i < indexTriangle.length; i+=3) {
            const v0 = indexTriangle[i+0];
            const v1 = indexTriangle[i+1];
            const v2 = indexTriangle[i+2];

            addEdge(v0, v1);
            addEdge(v1, v2);
            addEdge(v2, v0);
        }

        const ArrayType = indexTriangle.constructor;
        return new ArrayType(indexWire);
    }

    /**
     * Merges geometric data into a single set of data.
     * @param {Array<object>} geometries an array of objects containing the raw arrays mapped by arrayname
     * @returns {object} a single object of raw arrays mapped by array name.
     */
    static mergeGeometries(geometries) {
        let totalVertexComponents = 0, totalIndices = 0;
        for (const geo of geometries) {
            totalVertexComponents += geo.vertex.length;
            totalIndices += geo.idxTri.length;
        }

        const vertexArray = new Float32Array(totalVertexComponents);
        const indexArray = new Uint32Array(totalIndices);

        let vIndexComp = 0, vIndex = 0, iIndex = 0;
        for (const geo of geometries) {
            const currVertexCompCount = geo.vertex.length;
            const currVertexCount = currVertexCompCount / 3;
            const currIndexCount = geo.idxTri.length;

            vertexArray.set(geo.vertex, vIndexComp);
            for (let i = 0; i < currIndexCount; i++) {
                indexArray[iIndex+i] = geo.idxTri[i] + vIndex;
            }

            vIndexComp += currVertexCompCount;
            vIndex += currVertexCount;
            iIndex += currIndexCount;
        }

        return { vertex: vertexArray, idxTri: indexArray };
    }

    /**
     * Formats typed arrays into a form easily transformable into webgl buffers.
     * @param {object} arrays an object mapping array names to their raw typed arrays
     * @param {boolean} interleave if true, will interleave non-index arrays in the order they were recieved. Otherwise will keep every array independent.
     * @returns {object} the array data formatted with metadata
     */
    static formatArrays(arrays, interleave = false) {
        const sizes = { vertex: 3, normal: 3, color: 4, texCrd: 2 };

        const indexArrays = {}, vertexArrays = {}
        for (const arrayName in arrays) {
            const array = arrays[arrayName];

            let arrayEntry = {
                data: array,
                attributes: [],
                stride: 0,
                isIndex: arrayName.startsWith('idx')
            }

            if (arrayEntry.isIndex) {
                arrayEntry.dataType = array.constructor.name.startsWith('Uint16') ? 'uint16' : 'uint32';
                indexArrays[arrayName] = arrayEntry;
            } else {
                arrayEntry.attributes.push({
                    name: arrayName, size: sizes[arrayName], dataType: 'float', offset: 0
                });
                vertexArrays[arrayName] = arrayEntry;
            }
        }

        let formattedOutput = {};
        if (interleave) {
            formattedOutput.vertex = GeoUtils.#interleave(vertexArrays);
        } else {
            formattedOutput = {...vertexArrays};
        }

        formattedOutput = {...formattedOutput, ...indexArrays};

        return formattedOutput;
    }

    /**
     * Interleaves a set of arrays into a single contiguous array.
     */
    static #interleave(vertexArrays) {

    }

    /**
     * Generates a map of quantized vertices to a list of their indices, influenced by a precision value.
     * @param {ArrayBufferLike} vertexArray the vertex array to merge vertices with with the given merge function
     * @param {number} precision the size of the volume that determines how vertices are grouped. A larger value means less precision and higher chance of grouping.
     * @returns {Map<String, Array<number>>} an map of quantized vertices to indices.
     */
    static #genVertexMap(vertexArray, precision=0.01) {
        const vertexMap = new Map();

        for (let i = 0; i < vertexArray.length; i+=3) {
            const x = vertexArray[i+0];
            const y = vertexArray[i+1];
            const z = vertexArray[i+2];
            const index = i / 3;

            const qx = Math.trunc(x / precision);
            const qy = Math.trunc(y / precision);
            const qz = Math.trunc(z / precision);

            const key = `${qx}-${qy}-${qz}`;

            if (!vertexMap.has(key)) {
                vertexMap.set(key, []);
            }
            vertexMap.get(key).push(index);
        }

        return vertexMap;
    }

    /**
     * Welds vertices that are close together using their average. Use to preserve/introduce smooth shading
     * @param {ArrayBufferLike} oldVertexArray the vertex array to merge vertices with with the given merge function
     * @param {ArrayBufferLike} oldIndexArray the index array for the vertices
     * @param {number} precision the size of the volume that determines how vertices are grouped. A larger value means less precision and higher chance of grouping.
     * @returns {object} an object containing the new welded vertex and index arrays
     */
    static weldVertices(oldVertexArray, oldIndexArray, precision=0.01) {
        const vertexMap = GeoUtils.#genVertexMap(oldVertexArray, precision);

        const numIndices = oldVertexArray.length / 3;
        const indexTable = new Uint32Array(numIndices);
        for (let i = 0; i < numIndices; i++) {
            indexTable[i] = i;
        }

        const newVertexArray = new Float32Array(vertexMap.size*3);
        let vIndex = 0;
        for (const indices of vertexMap.values()) {
            let newIndex = vIndex/3;

            let sumX = 0, sumY = 0, sumZ = 0;
            for (const idx of indices) {
                const vertexIndex = idx*3;
                sumX += oldVertexArray[vertexIndex+0];
                sumY += oldVertexArray[vertexIndex+1];
                sumZ += oldVertexArray[vertexIndex+2];

                indexTable[idx] = newIndex;
            }

            newVertexArray[vIndex++] = sumX / indices.length;
            newVertexArray[vIndex++] = sumY / indices.length;
            newVertexArray[vIndex++] = sumZ / indices.length;
        }

        const ArrayType = oldIndexArray.constructor;
        const newIndexArray = new ArrayType(oldIndexArray.length);

        for (let i = 0; i < oldIndexArray.length; i++) {
            const iOld = oldIndexArray[i];
            newIndexArray[i] = indexTable[iOld];
        }

        return { vertex: newVertexArray, idxTri: newIndexArray };
    }

    /**
     * Snaps vertices that are close together using their average. Use to preserve flat shading.
     * @param {ArrayBufferLike} oldVertexArray the vertex array to merge vertices with with the given merge function
     * @param {number} precision the size of the volume that determines how vertices are grouped. A larger value means less precision and higher chance of grouping.
     * @returns {object} an object containing the new snapped vertex and index arrays
     */
    static snapVertices(oldVertexArray, precision=0.01) {
        const vertexMap = GeoUtils.#genVertexMap(oldVertexArray, precision);
        const newVertexArray = oldVertexArray.slice();

        for (const indices of vertexMap.values()) {
            let sumX = 0, sumY = 0, sumZ = 0;
            for (const idx of indices) {
                const vertexIndex = idx*3;
                sumX += oldVertexArray[vertexIndex+0];
                sumY += oldVertexArray[vertexIndex+1];
                sumZ += oldVertexArray[vertexIndex+2];
            }

            for (const idx of indices) {
                const vertexIndex = idx*3;
                newVertexArray[vertexIndex+0] = sumX / indices.length;
                newVertexArray[vertexIndex+1] = sumY / indices.length;
                newVertexArray[vertexIndex+2] = sumZ / indices.length;
            }
        }

        return newVertexArray;
    }
}
