import { Transform } from "../../components/index.js";
import { Quaternion, Vector3 } from "../../utilities/index.js";
import GeoUtils from "./geometry-utils.js";
import MiscGeometry from "./misc-geometry.js";
import PlanarGeometry from "./planar-geometry.js";

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
            console.warn(`[GenerateCylinder] numBands must be greater than 2. Assigning default (numBands=5).`);
            numBands = 5;
        }

        const sideTransform = new Transform()
            .translate(new Vector3(0, -1, 0))
            .rotate(Quaternion.fromAxisAngle(
                new Vector3(-1, 0, 0), Math.PI/2
            ));

        const baseTransform = new Transform()
            .translate(new Vector3(0, -1, 0))
            .rotate(Quaternion.fromAxisAngle(
                new Vector3(1, 0, 0), Math.PI/2
            ));

        const sideOffset = Math.sqrt(2);
        const base = PlanarGeometry.generateRegularPolygon(numBands, { transform: baseTransform });
        const side = PlanarGeometry.generateRegularPolygon(numBands, { 
            transform: sideTransform, 
            centerOffset: sideOffset, 
            shareVertices: false 
        });

        const cone = GeoUtils.mergeGeometries([base, side]);

        const precision = 0.3 / numBands * 11; // empirically derived
        cone.vertex = GeoUtils.snapVertices(cone.vertex, precision);

        return cone;
    }

    /**
     * Generates vertex data for a cylinder, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numBands the number of bands around the cylinder. Must be at least 3.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generateCylinder(numBands) {
        if (typeof numBands !== 'number' || numBands < 3) {
            console.warn(`[GenerateCylinder] numBands must be greater than 2. Assigning default (numBands=5).`);
            numBands = 5;
        }

        const topCapTransform = new Transform()
            .translate(new Vector3(0, 0.5, 0))
            .rotate(Quaternion.fromAxisAngle(
                new Vector3(-1, 0, 0), Math.PI/2
            ));

        const bottomCapTransform = new Transform()
            .translate(new Vector3(0, -0.5, 0))
            .rotate(Quaternion.fromAxisAngle(
                new Vector3(1, 0, 0), Math.PI/2
            ));

        const topCap = PlanarGeometry.generateRegularPolygon(numBands, { transform: topCapTransform});
        const bottomCap = PlanarGeometry.generateRegularPolygon(numBands, { transform: bottomCapTransform});
        const prism = MiscGeometry.generatePrismWall(numBands, 0.5, false);

        const wall = GeoUtils.weldVertices(prism.vertex, prism.idxTri);

        const cylinder = GeoUtils.mergeGeometries([topCap, bottomCap, wall]);
        cylinder.vertex = GeoUtils.snapVertices(cylinder.vertex);

        return cylinder;
    }

    /**
     * generates a unit sphere
     * @param numBands a band is a set of polygons from north to south pole
     * @param numRings a ring is lateral set of polygons
     */
    static generateSphere(numRings, numBands) {
        if (numRings === undefined || numRings < 2) {
            console.warn(`[RadialGeometry] Generating a sphere must have 'numBands' to be at least 3. Assigning default (numRings=5).`);
            numRings = 5;
        }
        if (numBands === undefined || numBands < 3) {
            console.warn(`[RadialGeometry] Generating a sphere must have 'numRings' to at least 2. Assigning default (numBands=10).`);
            numBands = 10;
        }

        const numVertices = numBands * (numRings-1) + 2;
        const vertexArray = new Float32Array(numVertices*3);

        const numIndices = (2*(numRings-1) * numBands)*3;
        const indexArray = numVertices < 65536 ? new Uint16Array(numIndices) : new Uint32Array(numIndices);

        //----- vertices -----//

        const azimu = 2 * Math.PI / numBands;
        const polar = Math.PI / numRings;

        const cosPhi = new Float32Array(numBands);
        const sinPhi = new Float32Array(numBands);
        for (let iBand = 0; iBand < numBands; iBand++) { 
            const phi = azimu * iBand;
            cosPhi[iBand] = Math.cos(phi);
            sinPhi[iBand] = Math.sin(phi);
        }

        let vIndex = 0;
        for (let iRing = 1; iRing < numRings; iRing++) {
            const theta = polar * iRing;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let iBand = 0; iBand < numBands; iBand++) {
                vertexArray[vIndex++] = sinTheta * cosPhi[iBand];
                vertexArray[vIndex++] = cosTheta;
                vertexArray[vIndex++] = sinTheta * sinPhi[iBand];
            }
        }

        // poles
        vertexArray[vIndex+1] = 1;
        vertexArray[vIndex+4] = -1;

        //----- indices -----//

        const northIndex = numBands * (numRings-1);
        const southIndex = northIndex+1;

        let iIndex = 0;
        for (let iBand = 0; iBand < numBands; iBand++) {
            for (let iRing = 1; iRing <= numRings; iRing++) {
                const bottomLeft = numBands * (iRing-1) + iBand;
                const topLeft = bottomLeft - numBands;
                const bottomRight = iBand < numBands-1 ? bottomLeft+1 : numBands * (iRing-1);
                const topRight = iBand < numBands-1 ? topLeft+1 : bottomRight - numBands;

                // north pole triangle
                if (iRing === 1) {
                    indexArray[iIndex++] = northIndex;
                    indexArray[iIndex++] = bottomRight;
                    indexArray[iIndex++] = bottomLeft;
                }
                // inner quad
                else if (iRing > 1 && iRing < numRings) {
                    // bottom-left triangle
                    indexArray[iIndex++] = bottomLeft;
                    indexArray[iIndex++] = topLeft;
                    indexArray[iIndex++] = bottomRight;

                    // top-right triangle
                    indexArray[iIndex++] = topLeft;
                    indexArray[iIndex++] = topRight;
                    indexArray[iIndex++] = bottomRight;
                }
                // south pole triangle
                else {
                    indexArray[iIndex++] = southIndex;
                    indexArray[iIndex++] = topLeft;
                    indexArray[iIndex++] = topRight;
                }
            }
        }

        return { vertex: vertexArray, idxTri: indexArray };
    }
}