/** -------------------- GEOMETRY UTILITY FUNCTIONS -------------------- */

import { Quaternion, Vector4 } from "../../utilities/index.js";
import Transform from "../../scene/transform.js";

/**
 * Utility functions for manipulating geometric data
 */
export default class GeoUtils {
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

        let xSum = 0, ySum = 0, zSum = 0;
        for (let i = 0; i < vertexArray.length-2; i+=3) {
            xSum += vertexArray[i+0];
            ySum += vertexArray[i+1];
            zSum += vertexArray[i+2];
        }
        const x = xSum / numVertices;
        const y = ySum / numVertices;
        const z = zSum / numVertices + (options.centerOffset ?? 0);
        const centerVertex = { x, y, z };

        if (options.shareVertices ?? true) {
            return GeoUtils.#triangulateShared(vertexArray, centerVertex);
        } else {
            return GeoUtils.#triangulateIndep(vertexArray, centerVertex);
        }
    }

    /** Fan triangulation where adjacent vertices are shared */
    static #triangulateShared(vertexArray, centerVertex) {
        const numVertices = Math.trunc(vertexArray.length/3);
        if (numVertices === 3) {
            return { vertex: vertexArray, idxTriangles: new Uint16Array([0, 1, 2]) };
        } else if (numVertices === 4) {
            return { vertex: vertexArray, idxTriangles: new Uint16Array([0, 1, 2, 0, 2, 3])};
        }

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

        return { vertex: newVertices, idxTriangles: indexArray };
    }

    /** Fan triangulation where triangles are independent (no shared vertices) */
    static #triangulateIndep(vertexArray, centerVertex) {
        const numVertices = Math.trunc(vertexArray.length/3);
        if (numVertices === 3) {
            return { vertex: vertexArray, idxTriangles: new Uint16Array([0, 1, 2]) };
        } else if (numVertices === 4) {
            return { vertex: vertexArray, idxTriangles: new Uint16Array([0, 1, 2, 0, 2, 3])};
        }

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

        return { vertex: newVertices, idxTriangles: indexArray };
    }

    /**
     * create a regular polyhedron by tesselating a 2D primitive
     * @param {object} primitive the primitive shape to construct the polyhedron with (should include 'vertex' and 'index' properties, which are typed arrays)
     * @param {Array<Quaternion>} rotations a array of quaternions representing the rotations needed
     * @param {number} positionOffset value that is applied on the position vector of a primitive after rotating it, effively moving it along it's normal.
     * @returns {object} an object containing the arrays and accompanying attributes
     */
    static createRegularPolyhedron(primitive, rotations, positionOffset) {
        const transforms = [];
        for (let i = 0; i < rotations.length; i++) {
            const pos = rotations[i].rotateVector(Transform.localForward).mult(positionOffset);
            transforms.push(new Transform({ position: pos, rotation: rotations[i] }));
        }

        const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
        const polyhedron = GeoUtils.tessellate(primitive.vertex, primitive.idxTriangles, transforms);

        const normalArray = GeoUtils.generateNormals(polyhedron.vertex, polyhedron.idxTriangles);
        const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

        return {
            vertex: { data: GeoUtils.normalizeVertices(polyhedron.vertex), attributes: vertexAttributes, stride: 0 },
            normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
            idxTriangles:  { data: polyhedron.idxTriangles,  attributes: [], stride: 0, dataType: 'uint16' },
        }
    }

    /**
     * Generate vertex normals given a flat vertex array and a flat index array. These can be any kind of typed array.
     * @param {ArrayBufferLike} vertexArray a flat typed array of vertices. This function treats each three consecutive values as the three components for a vertex.
     * @param {ArrayBufferLike} indexArray a flat typed array of indices into the vertex array, representing faces.
     * @param {object} options options for generating the normals.
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
            return { vertex: vertexArray, idxTriangles: indexArray };
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

        return { vertex: newVertices, idxTriangles: newIndices };
    }
}