import { Quaternion } from "../../utilities/index.js";
import PlanarGeometry from "./planar-geometry.js";
import GeoUtils from "./geometry-utils.js";
import { Transform } from "../../components/index.js";

/**
 * Contains functions for generating the five platonic solids
 */
export default class PlatonicGeometry {
    /**
     * Generates vertex data for a tetahredon, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateTetrahedron() {
        const hh = 2 / Math.sqrt(8);
        const vertexArray = new Float32Array([
            1,  hh,  0,  0, -hh, -1, -1,  hh,  0,
            1,  hh,  0,  0, -hh,  1,  0, -hh, -1,
            -1,  hh,  0,  0, -hh,  1,  1,  hh,  0,
            0, -hh,  1, -1,  hh,  0,  0, -hh, -1
        ]);

        // [ 0, 1, 2, 3, ...];
        const indexArray = Uint16Array.from({ length: 12 }, (v, i) => i);

        return { vertex: vertexArray, idxTri: indexArray };
    }

    /**
     * Generates vertex data for a unit cube, centered at the origin.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateCube() {
        const vertexArray = new Float32Array([
             1, -1, -1,  1,  1, -1, -1, -1, -1, -1,  1, -1, // back
            -1, -1,  1,  1, -1,  1, -1,  1,  1,  1,  1,  1, // front
             1, -1,  1,  1,  1,  1,  1, -1, -1,  1,  1, -1, // right
            -1, -1, -1, -1,  1, -1, -1, -1,  1, -1,  1,  1, // left
            -1,  1,  1, -1,  1, -1,  1,  1,  1,  1,  1, -1, // top
            -1, -1, -1, -1, -1,  1,  1, -1, -1,  1, -1,  1  // bottom
        ])

        const indexArray = new Uint16Array([
            0,  2,  1,  1,  2,  3,  // back
            4,  5,  6,  5,  7,  6,  // front
            9,  8,  10, 9,  10, 11, // right
            15, 12, 14, 15, 13, 12, // left
            17, 16, 18, 17, 18, 19, // top
            20, 23, 21, 20, 22, 23  // bottom
        ])

        const uvArray = new Float32Array([
            0, 1, 0, 0, 1, 1, 1, 0,
            0, 1, 1, 1, 0, 0, 1, 0,
            0, 1, 0, 0, 1, 1, 1, 0,
            0, 1, 0, 0, 1, 1, 1, 0,
            0, 1, 0, 0, 1, 1, 1, 0,
            0, 1, 0, 0, 1, 1, 1, 0
        ]);

        return { vertex: vertexArray, idxTri: indexArray, texCrd: uvArray };
    }

    /**
     * Generates vertex data for an octahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateOctahedron() {
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
        const indexArray = Uint16Array.from({ length: 24 }, (v, i) => i);

        return { vertex: vertexArray, idxTri: indexArray };
    }

    /**
     * Generates vertex data for a dodecahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateDodecahedron() {
        const midRadius = 1.309;
        const goldRatio = (1 + Math.sqrt(5)) / 2;
        const pentagon = PlanarGeometry.generateRegularPolygon(5, 1);

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

            rotations.push(Quaternion.fromEulerAngles(pitch, yaw, roll, Quaternion.EulerOrder.YXZ));
        }

        const transforms = [];
        for (let i = 0; i < rotations.length; i++) {
            const pos = rotations[i].rotateVector(Transform.localForward).mult(midRadius);
            transforms.push(new Transform({ position: pos, rotation: rotations[i] }));
        }

        return GeoUtils.tessellate(pentagon.vertex, pentagon.idxTri, transforms);
    }

    /**
     * Generates vertex data for an icosahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateIcosahedron() {
        const midRadius = 1.3101;
        const triangle = PlanarGeometry.generateRegularPolygon(3, 1);

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

        const transforms = [];
        for (let i = 0; i < rotations.length; i++) {
            const pos = rotations[i].rotateVector(Transform.localForward).mult(midRadius);
            transforms.push(new Transform({ position: pos, rotation: rotations[i] }));
        }

        const icosa = GeoUtils.tessellate(triangle.vertex, triangle.idxTri, transforms);
        icosa.vertex = GeoUtils.snapVertices(icosa.vertex, 0.08);
        return icosa;
    }
}
