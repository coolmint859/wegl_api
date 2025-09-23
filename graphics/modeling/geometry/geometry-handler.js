import { ShaderProgram } from "../../shading/index.js";
import { ResourceCollector } from "../../utilities/index.js";
import Geometry from "./geometry.js";

/**
 * Keeps track of geometry VAOs
 */
export default class GeometryHandler {
    #gl;
    #canvasID;

    /**
     * Create a new Geometry manager instance
     * @param {WebGL2RenderingContext} gl the context this manager should be bound to
     * @param {string} canvasID the canvas id that the context is bound to
     */
    constructor(gl, canvasID) {
        if (!gl instanceof WebGL2RenderingContext) {
            console.error(`[GeometryManager] Cannot create instance as 'gl' is not a valid rendering context.`);
            return;
        }

        this.#gl = gl;
        this.#canvasID = canvasID;

        this.glTypeMap = new Map([
            ['char', gl.BYTE], ['uchar', gl.UNSIGNED_BYTE],
            ['int8', gl.BYTE], ['uint8', gl.UNSIGNED_BYTE],
            ['short', gl.SHORT], ['ushort', gl.UNSIGNED_SHORT],
            ['int16', gl.SHORT], ['uint16', gl.UNSIGNED_SHORT],
            ['int', gl.INT], ['uint', gl.UNSIGNED_INT],
            ['int32', gl.INT], ['uint32', gl.UNSIGNED_INT],
            ['float', gl.FLOAT], ['float32', gl.FLOAT],
        ])
    }

    /**
     * Checks if the VAO data for geometry has been created
     * @param {string} geometryName the name of the geometry VAO data
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {boolean} true if the geometry VAO has been created, false otherwise
     */
    isVAO_Ready(geometryName, shaderName) {
        const vaoName = this.#genVAOName(geometryName, shaderName);
        return ResourceCollector.isLoaded(vaoName);
    }

    /**
     * Check if the VAO is being created and stored in the VAO cache
     * @param {string} geometryName the name of the geometry VAO data
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {boolean} true if the VAO is being created, false otherwise
     */
    containsVAO(geometryName, shaderName) {
        const vaoName = this.#genVAOName(geometryName, shaderName);
        return ResourceCollector.contains(vaoName);
    }

    /**
     * Get a geometry VAO associated with the provided names
     * @param {string} geometryName the name of the geometry VAO data
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {WebGLVertexArrayObject | null} a VAO instance if it has finished being created, null otherwise.
     */
    getVAO(geometryName, shaderName) {
        const vaoName = this.#genVAOName(geometryName, shaderName);
        if (ResourceCollector.isLoaded(vaoName)) {
            return ResourceCollector.get(vaoName).VAO;
        }
        return null;
    }

    /**
     * Acquire a geometry VAO for use
     * @param {string} geometryName the name/path of the geometry instance
     * @param {string} shaderName the name of the shader the vao was created with
     */
    acquireVAO(geometryName, shaderName) {
        const vaoName = this.#genVAOName(geometryName, shaderName)
        ResourceCollector.acquire(vaoName);
    }

    /**
     * Release a geometry VAO from use
     * @param {string} geometryName the name/path of the geometry instance
     * @param {string} shaderName the name of the shader the vao was created with
     */
    releaseVAO(geometryName, shaderName) {
        const vaoName = this.#genVAOName(geometryName, shaderName)
        ResourceCollector.release(vaoName);
    }

    /** generates a standard key used to store a VAO instance */
    #genVAOName(geometryName, shaderName) {
        return `[${shaderName}@${this.#canvasID}]->{${geometryName}}`; 
        // ex: [basic@canvas-main]->[./assets/bunny.ply]
    }

    /**
     * Generates a VAO for a given geometry using a given shader program
     * @param {Geometry} geometry a geometry instance
     * @param {ShaderProgram} shaderProgram a shaderprogram instance
     */
    async createVAO(geometry, shaderProgram, options={}) {
        if (!(geometry instanceof Geometry)) {
            console.error(`[GeometryHandler] Expected 'geometry' to be an instance of Geometry. Cannot create VAO instance`);
            return null;
        }
        if (!(shaderProgram instanceof ShaderProgram)) {
            console.error(`[GeometryHandler] Expected 'shaderProgram' to be an instance of ShaderProgram. Cannot create VAO instance`);
            return null;
        }

        const vaoName = this.#genVAOName(geometry.name, shaderProgram.name);
        if (ResourceCollector.contains(vaoName)) {
            const geometryData = await ResourceCollector.getWhenLoaded(
                vaoName, { pollInterval: 0.2, pollTimeout: 3 }
            )
            return geometryData.VAO;
        }

        const geometryData = await ResourceCollector.load(
            vaoName, this.#createVAO.bind(this),
            { 
                maxRetries: options.maxRetries ?? 3,
                disposalCallback: this.#deleteVAO.bind(this),
                disposalDelay: options.disposalDelay ?? 0.5,
                category: 'texture',
                loadData: { geometry, shaderProgram }
            }
        )

        console.log(vaoName, geometryData);
        return geometryData.VAO;
    }

    /** creates a new VAO instance */
    #createVAO(vaoName, options) {
        try {
            const gl = this.#gl;
            const geometryData = options.geometry.data;
            const shaderProgram = options.shaderProgram;

            const attribLocations = {};
            if (shaderProgram.supports('aPosition')) {
                attribLocations.vertex = shaderProgram.getAttributeLocation('aPosition')
            }
            if (shaderProgram.supports('aNormal')) {
                attribLocations.normal = shaderProgram.getAttributeLocation('aNormal')
            }
            if (shaderProgram.supports('aTexCoord')) {
                attribLocations.uv = shaderProgram.getAttributeLocation('aTexCoord')
            }
            
            const VAO = gl.createVertexArray();
            gl.bindVertexArray(VAO);

            const buffers = {}
            for (const arrayName in geometryData) {
                const array = geometryData[arrayName];
                const bufferType = arrayName === 'index' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

                const glBuffer = gl.createBuffer();
                gl.bindBuffer(bufferType, glBuffer);
                gl.bufferData(bufferType, array.data, gl.STATIC_DRAW);
                buffers[arrayName] = glBuffer;

                for (const attr of array.attributes) {
                    if (Object.keys(attribLocations).includes(attr.name)) {
                        const attribLocation = attribLocations[attr.name];
                
                        const glAttrType = this.glTypeMap.get(attr.dataType);
                        gl.enableVertexAttribArray(attribLocation);
                        gl.vertexAttribPointer(attribLocation, attr.size, glAttrType, false, array.stride, attr.offset);
                    }
                }
            }

            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            return { VAO, buffers };
        } catch (error) {
            console.error(`[Geometry] An error occurred while constructing VAO '${vaoName}: ${error}'`)
        }
    }

    /** deletes a VAO isntance */
    #deleteVAO(geometryInfo) {
        const gl = this.#gl;
        if (gl.isVertexArray(geometryInfo.VAO)) {
            gl.deleteVertexArray(VAO);

            for (const buffer in geometryInfo.buffers) {
                if (gl.isBuffer(buffer)) {
                    gl.deleteBuffer(buffer);
                }
            }
        }
    }
}