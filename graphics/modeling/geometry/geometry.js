import PlanarGeometry from "./procedural/planar-geometry.js";
import RadialGeometry from "./procedural/radial-geometry.js";
import PlatonicGeometry from "./procedural/platonic-solids.js";
import MiscGeometry from "./procedural/misc-geometry.js";
import { GeometryHandler } from "../../handlers/index.js";

/**
 * Represents mesh data - vertices, normals, and texture coordinates
 */
export default class Geometry {
    #name;
    #data;
    #capabilities;

    /**
     * Create a new geometry instance
     * @param {string} name the name of the geometry, used as a unique indentifier for storage
     * @param {object} data the raw data to be used by this Geometry instance. See docs for format
     */
    constructor(name, data) {
        this.#name = name;
        this.#data = data;

        GeometryHandler.setupGeometry(this.#name, this.#data);

        this.#capabilities = this.#genCapabilityList();
    }

    /**
     * Get the name of this geometry
     */
    get name() {
        return this.#name;
    }

    /**
     * Get the raw data associated with this geometry
     */
    get data() {
        return this.#data
    }

    /**
     * Get the capabililities of this geometry as a list of strings.
     */
    get capabilities() {
        return this.#capabilities;
    }

    /**
     * Check if a VAO has been created from this geometry data for the given shader
     * @param {string} shaderName the name of the shader to check with
     * @returns {boolean} true if a VAO has been created for the geometry, false otherwise
     */
    hasVAOFor(shaderName) {
        const geometryData = GeometryHandler.getDataFor(this.#name);
        return geometryData.VAOs.has(shaderName);
    }

    /**
     * Create a VAO for the given shader
     * @param {ShaderProgram} shaderProgram the shader program the VAO should be created with
     * @param {object} shaderProgram the shader program the VAO should be created with
     */
    generateVAO(shaderProgram, options={}) {
        GeometryHandler.createVAO(this.#name, shaderProgram, options);
    }
    
    /**
     * Get the arrays and VAO for the geometry instance.
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {object | null} an object with the array data and VAO object, if ready. If the VAO data is not ready, null is returned
     */
    getDataFor(shaderName) {
        const geometryData = GeometryHandler.getDataFor(this.#name);
        if (!geometryData.VAOs.has(shaderName)) {
            return null;
        }

        return {
            geometry: geometryData.data, 
            buffers: geometryData.buffers, 
            VAO: geometryData.VAOs.get(shaderName)
        }
    }

    /**
     * Create an exact replica of this geometry instance.
     */
    clone() {
        return new Geometry(this.#name, this.#data);
    }

    /** generates the capabilities of this geometry from it's provided data */
    #genCapabilityList() {
        const geoCapabilities = new Set();

        function addCapability(searchKey, keyword, cap) {
            if (searchKey === keyword) {
                geoCapabilities.add(cap);
            }
        }

        for (const arrayName in this.#data) {
            addCapability(arrayName, 'vertex', 'aPosition');
            addCapability(arrayName, 'normal', 'aNormal');
            addCapability(arrayName, 'uv', 'aTexCoord');

            for (const attrib of this.#data[arrayName].attributes) {
                addCapability(attrib.name, 'vertex', 'aPosition');
                addCapability(attrib.name, 'normal', 'aNormal');
                addCapability(attrib.name, 'uv', 'aTexCoord');
            }
        }
        return Array.from(geoCapabilities);
    }

    // ------------ PLATONIC SOLIDS ------------ //

    /**
     * Generates a tetahredon, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a geometry instance representing a tetrahedron.
     */
    static tetrahedron() {
        const name = 'tetrahedron';
        const tetrahedron = PlatonicGeometry.generateTetrahedron();

        return new Geometry(name, tetrahedron);
    }

    /** 
     * Generates a cube, centered at the origin.
     * @returns {Geometry} a geometry instance representing a cube.
     */
    static cube() {
        const name = 'cube';
        const cube = PlatonicGeometry.generateCube();

        return new Geometry(name, cube);
    }

    /**
     * Generates an octahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a geometry instance representing an octahedron.
     */
    static octahedron() {
        const name = 'octahedron';
        const octahedron = PlatonicGeometry.generateOctahedron();

        return new Geometry(name, octahedron);
    }

    /**
     * Generates a dodecahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a geometry instance representing a dodecahedron.
     */
    static dodecahedron() {
        const name = 'dodecahedron';
        const dodecahedron = PlatonicGeometry.generateDodecahedron();

        return new Geometry(name, dodecahedron);
    }

    /**
     * Generates an icosahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a geometry instance representing an icosahedron.
     */
    static icosahedron() {
        const name = 'icosahedron';
        const icosahedron = PlatonicGeometry.generateIcosahedron();

        return new Geometry(name, icosahedron);
    }

    // ------------ RADIAL GEOMETRY ------------ //

    /**
     * Generates a cube, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numBands the number of bands around the cone. Must be at least 3.
     * @returns {Geometry} a geometry instance representing a cone.
     */
    static cone(numBands) {
        if (numBands < 3) {
            console.warn(`[Geometry-Cone] Generating a cone must have 'numBands' to be greater than 2. Assigning default (numBands=5).`);
            numBands = 5;
        }

        const name = `cone#b:${numBands}`;
        const cone = RadialGeometry.generateCone(numBands);

        return new Geometry(name, cone);
    }

    /**
     * Generates a cylinder, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numBands the number of bands around the cylinder. Must be at least 3.
     * @returns {Geometry} a geometry instance representing a cylinder.
     */
    static cylinder(numBands) {
        if (numBands < 3) {
            console.warn(`[Geometry-Cylinder] Generating a cylinder must have 'numBands' to be greater than 2. Assigning default (numBands=10).`);
            numBands = 10;
        }

        const name = `cylinder#b:${numBands}`;
        const cylinder = RadialGeometry.generateCylinder(numBands);
        
        return new Geometry(name, cylinder);
    }

    /**
     * Generates a sphere, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numRings the number of rings around the sphere
     * @param {number} numBands the number of bands from pole to pole around the sphere
     * @returns {Geometry} a geometry instance representing a sphere.
     */
    static sphere(numRings, numBands) {
        if (numRings < 2) {
            console.warn(`[Geometry-Sphere] Generating a sphere must have 'numBands' to be greater than 2. Assigning default (numRings=5).`);
            numRings = 5;
        }
        if (numBands < 3) {
            console.warn(`[Geometry-Sphere] Generating a sphere must have 'numRings' to be greater than 1. Assigning default (numBands=10).`);
            numBands = 10;
        }

        const name = `sphere#r:${numRings}b:${numBands}`;
        const sphere = RadialGeometry.generateSphere(numRings, numBands);

        return new Geometry(name, sphere);
    }

    // ------------ MISC GEOMETRY ------------ //

    /**
     * Generates a pyramid, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a geometry instance representing a pyramid.
     */
    static pyramid() {
        const name = 'pyramid';
        const pyramid = MiscGeometry.generatePyramid();

        return new Geometry(name, pyramid);
    }

    // ------------ 2D GEOMETRY ------------ //

    /**
     * Generates a plane, centered at the origin.
     * @param {number} rows the number of rows on the plane. a higher value means more triangles
     * @param {number} cols the number of columns on the plane. a higher value means more triangles
     * @param {number} width the width (x-axis) of the plane
     * @param {number} depth the depth (z-axis) of the plane
     * @returns {Geometry} a geometry instance representing a plane.
     */
    static plane(rows, cols, width, depth) {
        if (rows <= 0) {
            console.warn(`[Geometry-Plane] 'rows' must be greater than 0. Assigning default (rows=1).`);
            numSides = 1;
        }
        if (cols <= 0) {
            console.warn(`[Geometry-Plane] 'cols' must be greater than 0. Assigning default (cols=1).`);
            cols = 1;
        }
        if (width <= 0) {
            console.warn(`[Geometry-Plane] 'width' must be greater than 0. Assigning default (width=1).`);
            width = 1;
        }
        if (depth <= 0) {
            console.warn(`[Geometry-Plane] 'depth' must be greater than 0. Assigning default (depth=1).`);
            depth = 1;
        }

        const name = `plane#r:${rows}c:${cols}w:${width}d:${depth}`;
        const plane = PlanarGeometry.generatePlane(rows, cols, width, depth);
        
        return new Geometry(name, plane);
    }

    /**
     * Generates a regular polygon, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numSides the number of sides of the polygon. Must be at least 3.
     * @param {object} options options for determining how the polygon should be made
     * @param {number} options.initRotation initial rotation about central axis. default is 0.
     * @param {boolean} options.shareVertices if true, the vertices around the perimeter will be shared, otherwise each triangle will be independent from eachother. Default is true.
     * @param {number} options.centerOffset the offset along the polygon's perpendicular axis for which the central vertex will be defined. Default is 0.
     * @returns {Geometry} a geometry instance representing a regular polygon with the specified number of sides.
     */
    static regularPolygon(numSides, options={}) {
        if (numSides < 3) {
            console.warn(`[Geometry-RegularPolygon] numSides must be at least 3. Assigning default (numSides=3).`);
            numSides = 3;
        }

        const initRotation = options.initRotation ?? 0
        const shareVerts = options.shareVertices ?? false;
        const centerOffset = options.centerOffset ?? 0;

        const name = `reg-pol#s:${numSides}ir:${initRotation}sv:${shareVerts}co:${centerOffset}`;
        const regpoly = PlanarGeometry.generateRegularPolygon(numSides, options);

        return new Geometry(name, regpoly);
    }

    /**
     * Generates a rectangle.
     * @returns {Geometry} a geometry instance representing a rectangle.
     */
    static rectangle() {
        const name = `fs-quad`;
        const screenQuad = PlanarGeometry.generateRectangle();

        return new Geometry(name, screenQuad);
    }
}