import { Transform } from "../../components/index.js";
import { Quaternion, Vector3 } from "../../utilities/index.js";
import GeoUtils from "./geometry-utils.js";
import PlanarGeometry from "./planar-geometry.js";

/**
 * Contains functions for generating geometry not found in other geometry classes
 */
export default class MiscGeometry {
    
    /**
     * Generates vertex data for a pyramid, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing vertex data, designed to work with a geometry instance
     */
    static generatePyramid() {
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

        return { vertex: vertexArray, idxTri: indexArray };
    }

    static generatePrism(numSides) {
        const topCapTransform = new Transform()
            .translate(new Vector3(0, 0.5, 0))
            .rotate(Quaternion.fromAxisAngle(
                new Vector3(1, 0, 0), -Math.PI/2
            ));

        const bottomCapTransform = new Transform()
            .translate(new Vector3(0, -0.5, 0))
            .rotate(Quaternion.fromAxisAngle(
                new Vector3(1, 0, 0), Math.PI/2
            ));
        
        const topCap = PlanarGeometry.generateRegularPolygon(numSides, { transform: topCapTransform});
        const bottomCap = PlanarGeometry.generateRegularPolygon(numSides, { transform: bottomCapTransform});
        const side = MiscGeometry.generatePrismWall(numSides, 0.5);
        const prism = GeoUtils.mergeGeometries([topCap, bottomCap, side]);

        prism.vertex = GeoUtils.snapVertices(prism.vertex);

        return prism;
    }

    static generatePrismWall(numSides, radius, invertWinding=false) {
        const inversionFactor = invertWinding ? -1 : 1;

        const width = 2 * radius * Math.sin(Math.PI/numSides);
        const apothem = 2 * radius * Math.cos(Math.PI/numSides) * inversionFactor;

        const dimensions = new Vector3(width, 0.5, 1);

        const angleStep = 2 * Math.PI / numSides;
        const angleOffset = (Math.PI - angleStep)/2;  // this is to orient it along x-axis
        const transforms = [];
        for (let i = 0; i < numSides; i++) {
            const angle = i * angleStep + angleOffset;

            const rotation = Quaternion.fromEulerAngles(0, angle, 0);
            const position = rotation.rotateVector(Transform.localForward).mult(apothem);
            transforms.push(new Transform({ position, rotation, dimensions }));
        }

        const baseRect = PlanarGeometry.generateQuad();

        return GeoUtils.tessellate(baseRect.vertex, baseRect.idxTri, transforms);
    }

    static generateAntiPrism(numSides) {
        const sideLength = 2 * Math.sin(Math.PI / 3);

        const radius = 1 / (2*Math.sin(Math.PI/numSides));
        const chord1 = 2 * radius * Math.sin(Math.PI / (2*numSides));
        const halfHeight = 0.5 * Math.sqrt(Math.pow(sideLength, 2) - Math.pow(chord1, 2));

        const topCapTransform = new Transform()
            .translate(new Vector3(0, halfHeight, 0))
            .rotate(Quaternion.fromAxisAngle(
                Transform.localRight, -Math.PI/2
            ));

        const bottomCapTransform = new Transform()
            .translate(new Vector3(0, -halfHeight, 0))
            .rotate(Quaternion.fromEulerAngles(Math.PI/2, 0, 0))


        const topCap = PlanarGeometry.generateRegularPolygon(numSides, { transform: topCapTransform});
        const bottomCap = PlanarGeometry.generateRegularPolygon(numSides, { transform: bottomCapTransform});
        const wall = MiscGeometry.generateAntiPrismWall(numSides, 0.5);
        const antiprism = GeoUtils.mergeGeometries([topCap, bottomCap, wall]);

        // antiprism.vertex = GeoUtils.snapVertices(antiprism.vertex, 0.08);

        return antiprism;
    }

    static generateAntiPrismWall(numSides) {
        // const inversionFactor = invertWinding ? -1 : 1;

        const sideLength = 2 * Math.sin(Math.PI / 3);

        const radius = 1 / (2*Math.sin(Math.PI/numSides));
        const chord1 = 2 * radius * Math.sin(Math.PI / (2*numSides));
        const halfHeight = 0.5 * Math.sqrt(Math.pow(sideLength, 2) - Math.pow(chord1, 2));
        const radialDist = sideLength * radius * Math.cos(Math.PI / (2 * numSides));

        const apothem = Math.cos(Math.PI/numSides);
        const chord2 = 1 - apothem;

        const pitchMag = Math.atan(0.565/(2*radialDist));
        console.log({apothem, chord1, chord2})

        const angleStep = Math.PI / numSides;
        // const angleOffset = (Math.PI - angleStep)/2;  // this is to orient it along x-axis
        const transforms = [];
        for (let i = 0; i < 2*numSides; i++) {
            const yaw = i * angleStep;
            const roll = i % 2 === 0 ? Math.PI/2 : -Math.PI/2;
            // const roll = i % 2 === 0 ? 0 : Math.PI;
            const pitch = i % 2 === 0 ? pitchMag : -pitchMag;

            const rotation = Quaternion.fromEulerAngles(pitch, yaw, roll, Quaternion.EulerOrder.YXZ);
            const position = rotation.rotateVector(Transform.localForward).mult(radialDist-0.12);
            position.y = i % 2 === 0 ? -0.25 : 0.25;

            transforms.push(new Transform({ position, rotation }));
        }

        const baseTriangle = PlanarGeometry.generateRegularPolygon(3);

        return GeoUtils.tessellate(baseTriangle.vertex, baseTriangle.idxTri, transforms);
    }

    static generateAntiPrismWall2(numSides) {
        // L_actual ≈ 1.73205
        const apothem = Math.cos(Math.PI/numSides);
        const chord1 = 1 - apothem;

        const radius = 1 / (2*Math.sin(Math.PI/numSides));
        const chord2 = 2 * radius * Math.sin(Math.PI / (2*numSides));

        console.log({chord1, chord2});

        const transforms = []
        const angleStep = Math.PI / numSides;
        for (let i = 0; i < 2 * numSides; i++) {
            const yaw = i * angleStep;
            const roll = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
            const pitch = i % 2 === 0 ? pitchMag : -pitchMag;
            
            const rotation = Quaternion.fromEulerAngles(pitch, yaw, roll, Quaternion.EulerOrder.YXZ);
            

            transforms.push(new Transform({ position, rotation }));
        }
        
        const baseTriangle = PlanarGeometry.generateRegularPolygon(3);
        return GeoUtils.tessellate(baseTriangle.vertex, baseTriangle.idxTri, transforms);
    }
} 