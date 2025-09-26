import Graphics3D from "../../rendering/renderer.js";
import { ShaderProgram } from "../../shading/index.js";
import { ResourceCollector } from "../../utilities/index.js";
import Geometry from "./geometry.js";

/**
 * Keeps track of geometry VAOs
 */
export default class GeometryHandler {
    static #gl;

    /**
     * Initialize this handler
     * @param {WebGL2RenderingContext} gl the currently active rendering context
     */
    static init(gl) {
        if (!gl instanceof WebGL2RenderingContext) {
            console.error(`[GeometryHandler] Cannot initialize handler as 'gl' is not a valid rendering context.`);
            return;
        }

        GeometryHandler.#gl = gl;
    }

    /**
     * Checks if the VAO data for geometry has been created
     * @param {string} geometryName the name of the geometry VAO data
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {boolean} true if the geometry VAO has been created, false otherwise
     */
    static isReady(geometryName, shaderName) {
        const vaoName = GeometryHandler.#genStorageName(geometryName, shaderName);
        return ResourceCollector.isLoaded(vaoName);
    }

    /**
     * Check if the VAO is being created and stored in the VAO cache
     * @param {string} geometryName the name of the geometry VAO data
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {boolean} true if the VAO is being created, false otherwise
     */
    static contains(geometryName, shaderName) {
        const vaoName = GeometryHandler.#genStorageName(geometryName, shaderName);
        return ResourceCollector.contains(vaoName);
    }

    /**
     * Get the geometry data associated with the provided names
     * @param {string} geometryName the name of the geometry VAO data
     * @param {string} shaderName the name of the shader the VAO was created with
     * @returns {WebGLVertexArrayObject | null} a VAO instance if it has finished being created, null otherwise.
     */
    static get(geometryName, shaderName) {
        const vaoName = GeometryHandler.#genStorageName(geometryName, shaderName);
        if (ResourceCollector.isLoaded(vaoName)) {
            return ResourceCollector.get(vaoName);
        }
        return null;
    }

    /** generates a standard key used to store a VAO instance */
    static #genStorageName(geometryName, shaderName) {
        return `${geometryName}@${shaderName}`; 
        // ex: ./assets/bunny.ply@basic
    }

    /**
     * Generates a VAO for a given geometry using a given shader program
     * @param {Geometry} geometry a geometry instance
     * @param {ShaderProgram} shaderProgram a shaderprogram instance
     */
    static async createVAO(geometry, shaderProgram, options={}) {
        if (!(geometry instanceof Geometry)) {
            console.error(`[GeometryHandler] Expected 'geometry' to be an instance of Geometry. Cannot create VAO instance`);
            return null;
        }
        if (!(shaderProgram instanceof ShaderProgram)) {
            console.error(`[GeometryHandler] Expected 'shaderProgram' to be an instance of ShaderProgram. Cannot create VAO instance`);
            return null;
        }

        const vaoName = GeometryHandler.#genStorageName(geometry.name, shaderProgram.name);
        if (ResourceCollector.contains(vaoName)) {
            const geometryData = await ResourceCollector.getWhenLoaded(
                vaoName, { pollInterval: 0.2, pollTimeout: 3 }
            )
            ResourceCollector.acquire(vaoName);
            return geometryData.VAO;
        }

        const geometryData = await ResourceCollector.load(
            vaoName, GeometryHandler.#createVAO,
            { 
                maxRetries: options.maxRetries ?? 3,
                disposalCallback: GeometryHandler.#deleteVAO,
                disposalDelay: options.disposalDelay ?? 0.5,
                category: 'texture',
                loadData: { geometry, shaderProgram }
            }
        )

        console.log(vaoName, geometryData);
        return geometryData.VAO;
    }

    /** creates a new VAO instance */
    static #createVAO(vaoName, options) {
        try {
            const gl = GeometryHandler.#gl;
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
                
                        const glAttrType = Graphics3D.glTypeMap.get(attr.dataType);
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
    static #deleteVAO(geometryInfo) {
        const gl = GeometryHandler.#gl;
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