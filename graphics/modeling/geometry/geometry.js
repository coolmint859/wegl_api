import * as platonic from "./procedural/platonic-solids.js";
import * as radial from "./procedural/radial-geometry.js";
import * as planar from "./procedural/planar-geometry.js";
import * as miscgeo from "./procedural/misc-geometry.js";
import { ResourceCollector } from "../../utilities/index.js";
import GeometryHandler from "./geometry-handler.js";

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

        if (ResourceCollector.contains(name)) {
            ResourceCollector.acquire(name);
        } else {
            ResourceCollector.store(name, data);
        }

        this.#capabilities = this.#genCapabilityList();
    }

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
     * Create a VAO for the given shader
     * @param {ShaderProgram} shaderProgram the shader program the VAO should be created with
     * @param {object} shaderProgram the shader program the VAO should be created with
     */
    generateVAO(shaderProgram, options={}) {
        GeometryHandler.createVAO(this, shaderProgram, options)
    }

    /**
     * Check if a VAO has been created with the given shader.
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {boolean} true if the VAO for this geometry has been created, false otherwise
     */
    isReadyFor(shaderName) {
        return GeometryHandler.isReady(this.#name, shaderName)
    }

    isBuilding(shaderName) {
        return GeometryHandler.contains(this.#name, shaderName);
    }
    
    /**
     * Get the arrays and VAO for the geometry instance, if ready
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {object | null} an object with the array data and VAO object, if ready. If the VAO data is not ready, null is returned
     */
    getDataFor(shaderName) {
        if (!this.isReadyFor(shaderName)) return null;
        const { VAO, buffers } = GeometryHandler.get(this.#name, shaderName);
        return { 
            geometry: this.#data, 
            VAO, buffers
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
     * @returns {Geometry} a new Geometry instance with tetrahedron data
     */
    static tetrahedron() {
        const name = 'tetrahedron';
        if (ResourceCollector.contains(name)) {
            const tetrahedron = ResourceCollector.get(name);
            return new Geometry(name, tetrahedron);
        }
        
        const tetrahedron = platonic.generateTetrahedron();
        ResourceCollector.store(name, tetrahedron);
        return new Geometry(name, tetrahedron);
    }

    /** 
     * Generates a cube, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a new Geometry instance with cube data
     */
    static cube() {
        const name = 'cube';
        if (ResourceCollector.contains(name)) {
            const cube = ResourceCollector.get(name);
            return new Geometry(name, cube);
        }

        const cube = platonic.generateCube();
        ResourceCollector.store(name, cube);
        return new Geometry(name, cube);
    }

    /**
     * Generates an octahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a new Geometry instance with octahedron data
     */
    static octahedron() {
        const name = 'octahedron';
        if (ResourceCollector.contains(name)) {
            const octahedron = ResourceCollector.get(name);
            return new Geometry(name, octahedron);
        }

        const octahedron = platonic.generateOctahedron();
        ResourceCollector.store(name, octahedron)
        return new Geometry(name, octahedron);
    }

    /**
     * Generates a dodecahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a new Geometry instance with dodecahedron data
     */
    static dodecahedron() {
        const name = 'dodecahedron';
        if (ResourceCollector.contains(name)) {
            const dodecahedron = ResourceCollector.get(name);
            return new Geometry(name, dodecahedron);
        }

        const dodecahedron = platonic.generateDodecahedron();
        ResourceCollector.store(name, dodecahedron);
        return new Geometry(name, dodecahedron);
    }

    /**
     * Generates an icosahedron, centered at the origin. Normalized to fit within a unit cube.
     * @returns {Geometry} a new Geometry instance with icosahedron data
     */
    static icosahedron() {
        const name = 'icosahedron';
        if (ResourceCollector.contains(name)) {
            const icosahedron = ResourceCollector.get(name);
            return new Geometry(name, icosahedron);
        }

        const icosahedron = platonic.generateIcosahedron();
        ResourceCollector.store(name, icosahedron);
        return new Geometry(name, icosahedron);
    }

    // ------------ RADIAL GEOMETRY ------------ //

    /**
     * Generates a cube, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numBands the number of bands around the cone. Must be at least 3.
     * @returns {object} an object containing the arrays and accompanying attributes
     */
    static cone(numBands) {
        if (numBands < 3) {
            console.warn(`[Geometry] Generating a cone must have 'numBands' to be greater than 2. Assigning default (numBands=5).`);
            numBands = 5;
        }

        const name = `cone#b${numBands}`;
        if (ResourceCollector.contains(name)) {
            const cone = ResourceCollector.get(name);
            return new Geometry(name, cone);
        }

        const cone = radial.generateCone(numBands);
        ResourceCollector.store(name, cone);
        return new Geometry(name, cone);
    }

    /**
     * Generates a cylinder, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numBands the number of bands around the cylinder. Must be at least 3.
     * @returns {object} an object containing the arrays and accompanying attributes
     */
    static cylinder(numBands) {
        if (numBands < 3) {
            console.warn(`[Geometry] Generating a cylinder must have 'numBands' to be greater than 2. Assigning default (numBands=10).`);
            numBands = 10;
        }

        const name = `cylinder#b${numBands}`;
        if (ResourceCollector.contains(name)) {
            const cylinder = ResourceCollector.get(name);
            return new Geometry(name, cylinder);
        }
    
        const cylinder = radial.generateCylinder(numBands);
        ResourceCollector.store(name, cylinder);
        return new Geometry(name, cylinder);
    }

    static sphere(numRings, numBands) {
        if (numRings < 2) {
            console.warn(`[Geometry] Generating a sphere must have 'numBands' to be greater than 2. Assigning default (numRings=5).`);
            numRings = 5;
        }
        if (numBands < 3) {
            console.warn(`[Geometry] Generating a sphere must have 'numRings' to be greater than 1. Assigning default (numBands=10).`);
            numBands = 10;
        }

        const name = `sphere#r${numRings}b${numBands}`;
        if (ResourceCollector.contains(name)) {
            const sphere = ResourceCollector.get(name);
            return new Geometry(name, sphere);
        }
    
        const sphere = radial.generateSphere(numRings, numBands);
        ResourceCollector.store(name, sphere);
        return new Geometry(name, sphere);
    }

    // ------------ MISC GEOMETRY ------------ //

    /**
     * Generates a pyramid, centered at the origin. Normalized to fit within a unit cube.
     * @returns {object} an object containing the arrays and accompanying attributes
     */
    static pyramid() {
        const name = 'pyramid';
        if (ResourceCollector.contains(name)) {
            const pyramid = ResourceCollector.get(name);
            return new Geometry(name, pyramid);
        }

        const pyramid = miscgeo.generatePyramid();
        ResourceCollector.store(name, pyramid);
        return new Geometry(name, pyramid);
    }

    // ------------ 2D GEOMETRY ------------ //

    /**
     * Generates a plane, centered at the origin.
     * @param {number} rows the number of rows on the plane. a higher value means more triangles
     * @param {number} cols the number of columns on the plane. a higher value means more triangles
     * @param {number} width the width (x-axis) of the plane
     * @param {number} depth the depth (z-axis) of the plane
     * @returns {object} an object containing the arrays and accompanying attributes
     */
    static plane(rows, cols, width, depth) {
        if (rows <= 0) {
            console.warn(`[GeneratePlane] 'rows' must be greater than 0. Assigning default (rows=1).`);
            numSides = 1;
        }
        if (cols <= 0) {
            console.warn(`[GeneratePlane] 'cols' must be greater than 0. Assigning default (cols=1).`);
            cols = 1;
        }
        if (width <= 0) {
            console.warn(`[GeneratePlane] 'width' must be greater than 0. Assigning default (width=1).`);
            width = 1;
        }
        if (depth <= 0) {
            console.warn(`[GeneratePlane] 'depth' must be greater than 0. Assigning default (depth=1).`);
            depth = 1;
        }

        const name = `plane#r${rows}c${cols}w${width}d${depth}`;
        if (ResourceCollector.contains(name)) {
            const plane = ResourceCollector.get(name);
            return new Geometry(name, plane);
        }
    
        const plane = planar.generatePlane(rows, cols, width, depth);
        ResourceCollector.store(name, plane);
        return new Geometry(name, plane);
    }

    /**
     * Generates a regular polygon, centered at the origin. Normalized to fit within a unit cube.
     * @param {number} numSides the number of sides of the polygon. Must be at least 3.
     * @param {object} options options for determining how the polygon should be made
     * @param {number} options.initRotation initial rotation about central axis. default is 0.
     * @param {boolean} options.shareVertices if true, the vertices around the perimeter will be shared, otherwise each triangle will be independent from eachother. Default is true.
     * @param {number} options.centerOffset the offset along the polygon's perpendicular axis for which the central vertex will be defined. Default is 0.
     * @returns {object} an object containing the new vertex and index array. The size of each is proportional to the number of polygon sides
     */
    static regularPolygon(numSides, options={}) {
        if (numSides < 3) {
            console.warn(`[GenerateRegularPolygon] numSides must be at least 3. Assigning default (numSides=3).`);
            numSides = 3;
        }

        const name = `reg-pol#s${numBands}`;
        if (ResourceCollector.contains(name)) {
            const regpoly = ResourceCollector.get(name);
            return new Geometry(name, regpoly);
        }
    
        const regpoly = planar.generateRegularPolygon(numSides, options);
        ResourceCollector.store(name, regpoly);
        return new Geometry(name, regpoly);
    }
}