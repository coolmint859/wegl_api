import Graphics3D from "../rendering/renderer.js";
import ResourceCollector from "../../utilities/containers/collector.js";
import Transform from "../../utilities/containers/transform.js";
import MeshLoader from "../../utilities/meshloader.js";
import ShaderManager from "../shading/shader_manager.js"
import Material from "./material.js";

export default class Mesh {
    static #ID_COUNTER = 0;
    static #gl;

    // mesh properties
    #meshID;
    #meshPath;
    #meshOptions;
    #meshCapabilities;

    // material properties
    #material;
    #currentMaterialCapabilities;

    // shader information
    #currentShaderName;
    #preferredShaderName;
    #shaderSelectionPromise;

    /**
     * Create a new Mesh object
     * @param {string} meshPath the path to the mesh file on disk
     * @param {Material} material the material this mesh should use.
     * @param {object} options options for mesh and buffer definitions (e.g initialTransform, drawMode, etc...)
     */
    constructor(meshPath, material, options={}) {
        if (!Mesh.#gl) Mesh.#gl = Graphics3D.getGLContext();
        this.#meshPath = meshPath;
        this.#meshID = Mesh.#ID_COUNTER++;
        this.#meshOptions = options;
        this.#meshCapabilities = ['model']; // list of mesh capabilities - all meshes have a model matrix, rest determined by VAO

        this.#preferredShaderName = options.preferredShaderName || null;
        this.#shaderSelectionPromise = null;

        // create transform object
        if (!options.initialTransform) {
            this.transform = new Transform(); // give default transform values
        } else if (!(options.initialTransform instanceof Transform)) {
            console.warn(`[Mesh ID#${this.#meshID}] TypeError: Expected 'options.initialTransform' to be an instance of Transform. Assigning default Transform.`);
            this.transform = new Transform(); // give default transform values
        } else {
            this.transform = options.initialTransform;
        }

        // check if the material is valid within the context
        if (!(material instanceof Material) ) {
            console.error(`[Mesh ID#${this.#meshID}] TypeError: Expected 'material' to be an instance of Material. Assigning default Material`);
            this.#material = new Material(contextName, Color.WHITE); // basic material
        } else { 
            this.#material = material;
        }
        // initialize material capabilities to empty arrays
        this.#currentMaterialCapabilities = { 'properties': [], 'textures': [] };
        
        if (typeof meshPath === 'string' && meshPath.trim() !== '') {
            ResourceCollector.load(meshPath, this.#loadMesh.bind(this), this.#disposeMesh.bind(this))
            .then(meshData => {
                this.refreshShaderEvaluation(); 
                console.log(`[Mesh ID#${this.#meshID}] Created new mesh '${meshPath}'.`);
            }).catch(error => {
                console.error(`[Mesh ID#${this.#meshID}] Failed to create mesh '${meshPath}': ${error}`);
            })
        } else {
            console.error(`[Mesh ID#${this.#meshID}] TypeError: Expected 'meshPath' to be a non-empty string. Cannot load mesh into memory.`);
        }
    }

    /**
     * Get the current best-fit shader name for this mesh
     * @returns {string} the name of the shader
     */
    getShaderName() {
        return this.#currentShaderName;
    }
    
    /**
     * Checks if the mesh has a material, has a shader, and that the mesh has been loaded
     * @returns {boolean} true if the checks pass, false otherwise
     */
    isValid() {
        if (!this.#material || this.#currentShaderName === null) {
            return false;
        }
        return this.isLoaded();
    }

    /** 
     * Checks if this mesh was successfully loaded into GPU memory.
     * 
     * Note: a loaded Mesh may not be a valid Mesh (but, its very likely)
     * @returns {boolean} true if successfully loaded, false otherwise
     * */
    isLoaded() {
        return ResourceCollector.isLoaded(this.#meshPath);
    }

    /**
     * Reload the mesh data this mesh represents.
     * @returns {Promise} a promise indicating success or failure on reloading the mesh.
     */
    async reload() {
        try {
            reloadedData = await ResourceCollector.reload(this.#meshPath);
            console.log(`[Mesh ID#${this.#meshID}]: Successfully reloaded '${this.#meshPath}'.`);
            return reloadedData;
        } catch (error) {
            console.log(`[Mesh ID#${this.#meshID}]: Failed to reload '${this.#meshPath}'.`);
            throw error;
        }
    }

    /** 
     * Binds this mesh to it's WebGL context.
     * @returns {boolean} true if this mesh was successfully bound, false otherwise
     * */
    bind() {
        if (this.isValid()) {
            const meshData = ResourceCollector.get(this.#meshPath);
            Mesh.#gl.bindVertexArray(meshData.VAO);
            return true;
        } else {
            console.warn(`[Mesh ID#${this.#meshID}] Warning: Mesh '${this.#meshPath}' is not yet loaded or is invalid. Cannot bind this mesh to GPU memory.`)
            return false;
        }
    }

    /** 
     * Unbinds this mesh from it's WebGL context.
     * @returns {boolean} true if this mesh was successfully unbound, false otherwise
     * */
    unbind() {
        if (this.isValid()) {
            Mesh.#gl.bindVertexArray(null);
            return true;
        } else {
            console.warn(`[Mesh ID#${this.#meshID}] Warning: Mesh '${this.#meshPath}' is not yet loaded or is invalid. Cannot unbind this mesh to GPU memory.`)
            return false;
        }
    }

    /**
     * Get an exact replica of the material associated with this mesh
     * @returns {Material} a copy of this Mesh's material
     */
    getMaterial() {
        return this.#material.clone();
    }

    /**
     * Set this Mesh's material
     * @param {Material} material 
     * @returns {boolean} true if the material was successfully set, false otherwise
     */
    setMaterial(material) {
        if (!(material instanceof Material) ) {
            console.error(`[Mesh ID#${this.#meshID}] TypeError: Expected 'material' to be an instance of Material. Cannot set Material.`);
            return false;
        }
        this.#material = material.clone();
        this.refreshShaderEvaluation();
        return true;
    }

    /**
     * Apply this Mesh's properties and material (and textures) to the given Shader instance. 
     * 
     * NOTE: The shader program given must ALREADY be active. 
     * @param {Shader} shaderProgram the shader program istance to set the uniforms for
     */
    applyToShader(shaderProgram) {
        if (!(shaderProgram instanceof Shader && shaderProgram.isActive())) {
            console.error(`[Mesh ID#${this.#meshID}] TypeError: Expected 'shaderProgram' to be an active instance of Shader. Cannot set mesh uniforms.`);
        }
        shaderProgram.setMatrix4('model', this.transform.getWorldMatrix());

        // apply material uniforms, skip textures if texture coords are not present
        const meshData = ResourceCollector.get(this.#meshPath);
        this.#material.applyToShader(shaderProgram, meshData.hasTexCoords);
    }

    /**
     * Reevaluate this mesh's currently set shader. Only triggers best-fit algorithm if the Material's capabilities have changed.
     * This is safe to call every frame, as best-fit is an asyncronous process. This Mesh's shader is only updated when best-fit finishes execution.
     */
    refreshShaderEvaluation() {
        const materialCapabilities = this.#material.getCapabilities();
        const sameCapabilities = this.#sameMaterialCapabilities(this.#currentMaterialCapabilities, materialCapabilities);   
        if (this.#currentShaderName !== null && sameCapabilities) {
            return; // current shader is accurate, do nothing
        }

        // otherwise, shader evaluation is required - make sure one is not already in progress (prevents race conditions)
        if (this.#shaderSelectionPromise === null) {
            const capabilities = this.#meshCapabilities.concat(materialCapabilities).sort();

            this.#shaderSelectionPromise = ShaderManager.bestFitShader(capabilities, this.#preferredShaderName)
            .then(newShaderName => {
                if (this.#currentShaderName !== newShaderName) {
                    ShaderManager.release(this.#currentShaderName);
                    console.log(`[Mesh ID#${this.#meshID}] Mesh: Switched best-fit shader for mesh ${this.#meshPath} from ${this.#currentShaderName} to ${newShaderName}.`);
                    this.#currentShaderName = newShaderName;
                }
                this.#currentMaterialCapabilities = materialCapabilities;
                this.#shaderSelectionPromise = null;
            })
            .catch(error => { 
                console.error(`[Mesh ID#${this.#meshID}] Mesh: Error selecting best-fit shader for @${this.#meshPath}: `, error);
                this.#currentShaderName = null;
                this.#shaderSelectionPromise = null
            });
        }
    }

    /** compares material capabilities. Returns true if they're the same, false otherwise */
    #sameMaterialCapabilities(oldCapabilities, newCapabilities) {
        if (!oldCapabilities || !newCapabilities) {
            return oldCapabilities === newCapabilities;
        }

        const oldProps = [...oldCapabilities.properties].sort();
        const newProps = [...newCapabilities.properties].sort();
        if (oldProps.length !== newProps.length || oldProps.join(',') !== newProps.join(',')) {
            return false;
        }

        const oldTextures = [...oldCapabilities.textures].sort();
        const newTextures = [...newCapabilities.textures].sort();
        if (oldTextures.length !== newTextures.length || oldTextures.join(',') !== newTextures.join(',')) {
            return false;
        }

        return true;
    }

    /** 
     * Release this Mesh's VAO, buffer, material, and shader references.
     * @returns {boolean} true if the shader, mesh, and material were all successfully released, false otherwise
     * */
    dispose() {
        let shaderReleased = true;
        if (this.#currentShaderName !== null) {
            shaderReleased = ShaderManager.release(this.#currentShaderName);
        }
        let meshReleased = ResourceCollector.release(this.#meshPath);

        let materialDisposed = this.#material.dispose();
        this.#material = null;
        this.#currentShaderName = null;

        return shaderReleased && meshReleased && materialDisposed;
    }

    async #loadMesh() {
        const rawMeshData = await MeshLoader.load(this.#meshPath);
        const meshData = {
            drawMode: rawMeshData.drawMode,
            vertexCount: Math.floor(rawMeshData.vertexArray.length / 3),
            hasTexCoords: !rawMeshData.texCoordsArray ? false : true
        }
        Mesh.#defineVAO(rawMeshData, meshData, this.#meshOptions);
        this.#updateMeshCapabilities(meshData);
        return meshData;
    }

    /** Creates a new Vertex Array Object (VAO) for this mesh. Should only be called once. */
    static #defineVAO(rawMeshData, meshDataObj, meshOptions) {
        // get context and draw type
        const gl = Mesh.#gl;
        const drawType = meshOptions.drawType ? meshOptions.drawType : gl.STATIC_DRAW;

        // create and bind VAO
        const meshVAO = gl.createVertexArray();
        gl.bindVertexArray(meshVAO);

        // create and bind vertex buffer
        const vertexLocation = ShaderManager.ATTRIB_LOCATION_VERTEX;
        const vertexArray = rawMeshData.vertexArray;
        meshDataObj.vertexBuffer = Mesh.#createBuffer(vertexLocation, vertexArray, 3, drawType);

        // create and bind normal buffer
        const normalLocation = ShaderManager.ATTRIB_LOCATION_NORMAL;
        const normalArray = rawMeshData.normalArray;
        meshDataObj.normalBuffer = Mesh.#createBuffer(normalLocation, normalArray, 3, drawType);

        // if texture coordinates present, bind coordinates
        if (rawMeshData.texCoordsArray) {
            const uvLocation = ShaderManager.ATTRIB_LOCATION_UV;
            const uvArray = rawMeshData.texCoordsArray;
            meshDataObj.uvBuffer = Mesh.#createBuffer(uvLocation, uvArray, 2, drawType);
        }

        // bind index buffer
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, rawMeshData.indexArray, drawType);
        meshDataObj.indexBuffer = indexBuffer;

        // unbind buffers
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        // finally attach VAO to mesh
        meshDataObj.VAO = meshVAO;
    }

    /** creates a new buffer object at the given location with the given data */
    static #createBuffer(location, data, elementSize, drawType) {
        const gl = Mesh.#gl;

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, drawType);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, elementSize, gl.FLOAT, false, 0, 0);
        return buffer;
    }

    /** update this meshes capabilities using the provided data object */
    #updateMeshCapabilities(meshDataObj) {
        // reset capability array
        this.#meshCapabilities = ['model'];

        if (meshDataObj.vertexBuffer) this.#meshCapabilities.push('position');
        if (meshDataObj.normalBuffer) this.#meshCapabilities.push('normal');
        if (meshDataObj.uvBuffer) this.#meshCapabilities.push('uv');
        // add more checks as mesh data becomes more sophisticated

        this.#meshCapabilities.sort();
    }

    /** called when no more meshes exists with this data */
    #disposeMesh(meshData) {
        const gl = Mesh.#gl;

        gl.deleteVertexArray(meshData.VAO);
        if (meshData.vertexBuffer) gl.deleteBuffer(meshData.vertexBuffer);
        if (meshData.normalBuffer) gl.deleteBuffer(meshData.normalBuffer);
        if (meshData.uvBuffer) gl.deleteBuffer(meshData.uvBuffer);
        if (meshData.indexBuffer) gl.deleteBuffer(meshData.indexBuffer);
    }
}