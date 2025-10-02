import { Renderer, ShaderProgram } from "../rendering/index.js";
import { ResourceCollector } from "../utilities/index.js";
import { Geometry } from "../modeling/index.js";

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
     * Create geometry buffers and store them in the cache
     * @param {string} geometryName the name of the geometry. Will be used as a key in the cache.
     * @param {object} geometryData the data to create the buffers with. 
     * @param {object} options options for buffer creation and storage
     */
    static setupGeometry(geometryName, data, options={}) {
        if (ResourceCollector.contains(geometryName)) {
            ResourceCollector.acquire(geometryName);
            return;
        }

        try {
            const gl = GeometryHandler.#gl;

            const buffers = {}
            for (const arrayName in data) {
                const array = data[arrayName];

                const isIndexArray = arrayName === 'idxTriangles' || arrayName === 'idxLines';
                const bufferType = isIndexArray ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

                const glBuffer = gl.createBuffer();
                gl.bindBuffer(bufferType, glBuffer);
                gl.bufferData(bufferType, array.data, gl.STATIC_DRAW);
                buffers[arrayName] = glBuffer;
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            ResourceCollector.store(geometryName, 
                { data, buffers, VAOs: new Map() }, 
                {
                    disposalCallback: GeometryHandler.#deleteVAO,
                    disposalDelay: options.disposalDelay ?? 0.5,
                    category: 'geometry',
                }
            )
        } catch (error) {
            console.error(`[Geometry] An error occurred while creating buffers for '${geometryName}: ${error}'`)
        }
    }

    /**
     * Check if geometry data exists in the cache.
     * @param {string} geometryName the name of the geometry data
     * @returns {boolean} true if the geometry data exists, false otherwise
     */
    static contains(geometryName) {
        return ResourceCollector.contains(geometryName);
    }

    /**
     * Get the geometry data associated with the provided name
     * @param {string} geometryName the name of the geometry VAO data
     * @returns {object | null} an object containing the geometry data, buffers, and map of shadernames to VAO handles
     */
    static getDataFor(geometryName) {
        if (ResourceCollector.contains(geometryName)) {
            return ResourceCollector.get(geometryName);
        }
        return null;
    }

    /**
     * Generates a VAO for a given geometry using a given shader program
     * @param {Geometry} geometry a geometry instance
     * @param {ShaderProgram} shaderProgram a shaderprogram instance
     * @returns {WebGLVertexArrayObject} the created VAO handle 
     */
    static createVAO(geometryName, shaderProgram, options={}) {
        if (!(shaderProgram instanceof ShaderProgram)) {
            console.error(`[GeometryHandler] Expected 'shaderProgram' to be an instance of ShaderProgram. Cannot create VAO instance`);
            return null;
        }

        const geometry = ResourceCollector.get(geometryName);
        if (geometry.VAOs.has(shaderProgram.name)) {
            return geometry.VAOs.get(shaderProgram.name);
        }

        const VAO = GeometryHandler.#createVAO(geometry, shaderProgram, options);
        geometry.VAOs.set(shaderProgram.name, VAO);
        return VAO;
    }

    /** creates a new VAO instance */
    static #createVAO(geometry, shaderProgram, options={}) {
        try {
            const gl = GeometryHandler.#gl;

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

            for (const arrayName in geometry.data) {
                const array = geometry.data[arrayName];
                const buffer = geometry.buffers[arrayName];

                if (arrayName === 'idxTriangles' || arrayName === 'idxLines') continue;

                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

                for (const attr of array.attributes) {
                    if (Object.keys(attribLocations).includes(attr.name)) {
                        const attribLocation = attribLocations[attr.name];
                
                        const glAttrType = Renderer.glTypeMap.get(attr.dataType);
                        gl.enableVertexAttribArray(attribLocation);
                        gl.vertexAttribPointer(attribLocation, attr.size, glAttrType, false, array.stride, attr.offset);
                    }
                }
            }

            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            return VAO;
        } catch (error) {
            console.error(`[Geometry] An error occurred while constructing VAO '${shaderProgram.name}: ${error}'`)
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