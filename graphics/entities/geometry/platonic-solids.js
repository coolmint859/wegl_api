import { Quaternion } from "../../utilities/index.js";
import Planar from "./planar-geometry.js";
import GeoUtils from "./geometry-utils.js";

/**
 * Contains functions for generating the five platonic solids
 */
export default class PlatonicGeometry {
    /**
     * Generates vertex data for a tetahredon, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateTetrahedron() {
        const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
        const hh = 2 / Math.sqrt(8);
        const vertexArray = new Float32Array([
            1,  hh,  0,  0, -hh, -1, -1,  hh,  0,
            1,  hh,  0,  0, -hh,  1,  0, -hh, -1,
            -1,  hh,  0,  0, -hh,  1,  1,  hh,  0,
            0, -hh,  1, -1,  hh,  0,  0, -hh, -1
        ]);

        // [ 0, 1, 2, 3, ...];
        const triIndexArray = Uint16Array.from({ length: 12 }, (v, i) => i);
        const wireIndexArray = GeoUtils.generateWireframe(triIndexArray);

        const normalArray = GeoUtils.generateNormals(vertexArray, triIndexArray);
        const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

        const tetrahedron = {
            vertex: { data: GeoUtils.normalizeVertices(vertexArray), attributes: vertexAttributes, stride: 0 },
            normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
            idxTriangles: { data: triIndexArray, attributes: [], stride: 0, dataType: 'uint16' },
            idxLines: { data: wireIndexArray, attributes: [], stride: 0, dataType: 'uint16' },
        }

        return tetrahedron;
    }

    /**
     * Generates vertex data for a unit cube, centered at the origin.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateCube() {
        const baseSquare = GeoUtils.triangulate(new Float32Array([ 1, -1, 0, 1, 1, 0, -1,  1, 0, -1, -1, 0 ]));
        const rotations = [
            new Quaternion(),                               // front face
            Quaternion.fromEulerAngles(0, Math.PI, 0),      // back face
            Quaternion.fromEulerAngles(0, Math.PI/2, 0),    // right face
            Quaternion.fromEulerAngles(0, -Math.PI/2, 0),   // left face
            Quaternion.fromEulerAngles(-Math.PI/2, 0, 0),   // top face
            Quaternion.fromEulerAngles(Math.PI/2, 0, 0)     // bottom face
        ];

        const uvAttributes = [{ name: 'uv', size: 2, dataType: 'float', offset: 0 }]
        const uvArray = new Float32Array([
            1, 1, 1, 0, 0, 0, 0, 1,
            1, 1, 1, 0, 0, 0, 0, 1,
            1, 1, 1, 0, 0, 0, 0, 1,
            1, 1, 1, 0, 0, 0, 0, 1,
            1, 1, 1, 0, 0, 0, 0, 1,
            1, 1, 1, 0, 0, 0, 0, 1,
        ]);

        const cube = GeoUtils.createRegularPolyhedron(baseSquare, rotations, 1);
        cube.uv = { data: uvArray, attributes: uvAttributes, stride: 0};

        return cube;
    }

    /**
     * Generates vertex data for an octahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateOctahedron() {
        const vertexAttributes = [{ name: 'vertex', size: 3, dataType: 'float', offset: 0 }];
        const h = Math.sqrt(2);
        const vertexArray = new Float32Array([
            0,  h, 0,  1, 0,  1,  1, 0, -1,
            0,  h, 0,  1, 0, -1, -1, 0, -1,
            0,  h, 0, -1, 0,  1,  1, 0,  1,
            0,  h, 0, -1, 0, -1, -1, 0,  1,
            0, -h, 0,  1, 0,  1, -1, 0,  1,
            0, -h, 0,  1, 0, -1,  1, 0,  1,
            0, -h, 0, -1, 0, -1,  1, 0, -1,
            0, -h, 0, -1, 0,  1, -1, 0, -1,
        ]);

        // [ 0, 1, 2, 3, ...];
        const triIndexArray = Uint16Array.from({ length: 24 }, (v, i) => i);
        const wireIndexArray = GeoUtils.generateWireframe(triIndexArray);

        const normalArray = GeoUtils.generateNormals(vertexArray, triIndexArray);
        const normalAttributes = [{ name: 'normal', size: 3, dataType: 'float', offset: 0 }];

        const octahedron = {
            vertex: { data: GeoUtils.normalizeVertices(vertexArray), attributes: vertexAttributes, stride: 0 },
            normal: { data: normalArray, attributes: normalAttributes, stride: 0 },
            idxTriangles: { data: triIndexArray, attributes: [], stride: 0, dataType: 'uint16' },
            idxLines: { data: wireIndexArray, attributes: [], stride: 0, dataType: 'uint16' },
        }

        return octahedron;
    }

    /**
     * Generates vertex data for a dodecahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateDodecahedron() {
        const midRadius = 1.309;
        const goldRatio = (1 + Math.sqrt(5)) / 2;
        const basePentagon = Planar.generateRegularPolygon(5, 1);
        const pentagon = { vertex: basePentagon.vertex.data, idxTriangles: basePentagon.idxTriangles.data };

        const pi_2 = Math.PI/2;
        const rotations = [
            // these are for the 'top' and 'bottom' pentagons
            Quaternion.fromEulerAngles(pi_2, 0, pi_2, Quaternion.EulerOrder.YXZ),
            Quaternion.fromEulerAngles(-pi_2, 0, pi_2, Quaternion.EulerOrder.YXZ),
        ];

        for (let i = 0; i <= 9; i++) {
            // these are for the side-facing pentagons
            const pitch = (i % 2 === 0 ? Math.atan(2) : 2*Math.atan(goldRatio)) + pi_2;
            const yaw = i * Math.PI/5;
            const roll = i % 2 === 0 ? -pi_2 : pi_2;
            rotations.push(Quaternion.fromEulerAngles(pitch, yaw, roll, Quaternion.EulerOrder.YXZ))
        }

        return GeoUtils.createRegularPolyhedron(pentagon, rotations, midRadius);
    }

    /**
     * Generates vertex data for an icosahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateIcosahedron() {
        const midRadius = 1.3101;
        const triangle = {
            vertex: new Float32Array([1, 0, 0, -0.5, 0.866, 0, -0.5, -0.866, 0]),
            idxTriangles: new Uint16Array([0, 1, 2])
        }

        // empirically found as true angles weren't working, not sure why
        const ringPitch = 0.186;
        const capPitch = 2*Math.atan(0.5)-0.004;

        // calculate rotation transformations
        const rotations = [];
        for (let i = 0; i < 10; i++) {
            const pitch1 = i % 2 === 0 ? -ringPitch : ringPitch;
            const yaw1 = i * Math.PI/5;
            const roll1 = i % 2 === 0 ? -Math.PI/2 : Math.PI/2;
            rotations.push(Quaternion.fromEulerAngles(pitch1, yaw1, roll1, Quaternion.EulerOrder.YXZ))

            const pitch2 = i % 2 === 0 ? -capPitch : capPitch;
            const yaw2 = i * Math.PI/5;
            const roll2 = i % 2 === 0 ? Math.PI/2 : -Math.PI/2;
            rotations.push(Quaternion.fromEulerAngles(pitch2, yaw2, roll2, Quaternion.EulerOrder.YXZ))
        }

        return GeoUtils.createRegularPolyhedron(triangle, rotations, midRadius);
    }
}
