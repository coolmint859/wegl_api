class Mesh {
    static #meshRegistry = new Map();
    static #ID_COUNTER = 0;

    // general properties
    #contextName;
    #gl;

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
     * @param {string} contextName The WebGL context name to associate this mesh with. Note: Must match the context of the provided Material (and it's underlying Texture isntances, if any)
     * @param {string} meshPath the path to the mesh file on disk
     * @param {Material} material the material this mesh should use.
     * @param {object} options options for mesh and buffer definitions (e.g initialTransform, drawMode, etc...)
     */
    constructor(contextName, meshPath, material, options={}) {
        this.#contextName = contextName;
        this.#meshPath = meshPath;
        this.#meshID = Mesh.#ID_COUNTER++;
        this.#meshOptions = options;
        this.#meshCapabilities = ['model']; // list of mesh capabilities - all meshes have a model matrix, rest determined by VAO

        this.#preferredShaderName = this.#meshOptions.preferredShaderName || null;
        this.#shaderSelectionPromise = null;

        // create transform object
        if (!options.initialTransform) {
            this.transform = new Transform(); // give default transform values
        } else if (!(options.initialTransform instanceof Transform)) {
            console.error(`[WebGL@${this.#contextName}] TypeError: Expected 'options.initialTransform' to be an instance of Transform. Assigning default Transform.`);
            this.transform = new Transform(); // give default transform values
        } else {
            this.transform = options.initialTransform;
        }

        // check if the material is valid within the context
        if (!(material instanceof Material) ) {
            console.error(`[WebGL@${this.#contextName}] TypeError: Expected 'material' to be an instance of Material. Assigning default Material`);
            this.#material = new Material(contextName, Color.WHITE); // basic material
        } else { 
            this.#material = material;
        }
        // initialize material capabilities to empty arrays
        this.#currentMaterialCapabilities = { 'properties': [], 'textures': [] };
        
        // check if the context name maps to a known context
        this.#gl = Graphics3D.getGLContext(contextName);
        if (this.#gl) {
            // if the VAO already exists, we can immediate select shaders, otherwise need to wait until VAO finishes loading.
            if (this.#initializeMesh()) this.refreshShaderEvaluation(); 
        } else {
            console.warn(`Warning: 'contextName' is not a known WebGL context name. This mesh @${this.#meshPath} is considered invalid and cannot be used.\nNote: The given WebGL context must exist before instantiating a Mesh.`);
        }
    }

    /**
     * Get the WebGL context name that this mesh was created with.
     * @returns {string} This mesh's webGL context's name
     */
    getGLContextName() {
        return this.#contextName;
    }

    /**
     * Get the current best-fit shader name for this mesh
     * @returns {string} the name of the shader
     */
    getShaderName() {
        return this.#currentShaderName;
    }
    
    /**
     * Checks if the mesh's type and WegGL context are valid and exist, and that the mesh has been loaded
     * @returns {boolean} true if the checks pass and the mesh is valid/loaded, false otherwise
     */
    isValid() {
        // check that a Material is defined (it should always be based on constructor)
        if (!this.#material) return false;

        // check if the context name maps to a known context and the material's context matches
        const glContext = Graphics3D.getGLContext(this.#contextName);
        if (!glContext || this.#material.getGLContextName() !== this.#contextName) return false;

        // check if a shader program is set - this only happens after best fit finishes executing
        if (this.#currentShaderName === null) return false;

        // finally determine if the VAO is loaded
        return this.isLoaded();
    }

    /** 
     * Checks if this mesh was successfully loaded into GPU memory.
     * 
     * Note: a loaded Mesh may not be a valid Mesh (but, its very likely)
     * @returns {boolean} true if successfully loaded, false otherwise
     * */
    isLoaded() {
        const meshData = Mesh.#meshRegistry.get(this.#contextName).getByName(this.#meshPath);
        // check first if this mesh has VAO data
        if (!meshData) return false;

        // then check if the data itself was loaded
        return meshData.isLoaded
    }

    /** 
     * Binds this mesh to it's WebGL context.
     * @returns {boolean} true if this mesh was successfully bound, false otherwise
     * */
    bind() {
        if (!this.isValid()) {
            console.warn(`[WebGL@${this.#contextName}] Warning: Mesh @${this.#meshPath} is not yet loaded or is invalid. Cannot bind this mesh to GPU memory.`)
            return false;
        }
        // mesh is valid and loaded, safe to retrieve mesh data
        const meshData = Mesh.#meshRegistry.get(this.#contextName).getByName(this.#meshPath);
        this.#gl.bindVertexArray(meshData.VAO);
        return true;
    }

    /** 
     * Unbinds this mesh from it's WebGL context.
     * @returns {boolean} true if this mesh was successfully unbound, false otherwise
     * */
    unbind() {
        if (!this.isValid()) {
            console.warn(`[WebGL@${this.#contextName}] Warning: Mesh @${this.#meshPath} is not yet loaded or is invalid. Cannot unbind this mesh from GPU memory.`)
            return false;
        }
        this.#gl.bindVertexArray(null);
        return true;
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
            console.error(`[WebGL@${this.#contextName}] TypeError: Expected 'material' to be an instance of Material. Cannot set Material.`);
            return false;
        }
        if (this.#contextName !== material.getGLContextName()) {
            console.error(`[WebGL@${this.#contextName}] ValueError: ${material.getGLContextName()} does not match this mesh's WebGL context name '${this.#contextName}'. Cannot set Material for this Mesh ID@${this.#meshID}.`);
            return false;
        }
        this.#material = material.clone();
        this.refreshShaderEvaluation();
        return true;
    }

    /**
     * Return a read-only copy of this mesh's data.
     * @returns {object} an immutable js object of this mesh's data
     */
    getMeshData() {
        return Mesh.getMeshData(this.#contextName, this.#meshPath);
    }

    /**
     * Apply this Mesh's properties and material (and textures) to the given Shader instance. 
     * 
     * NOTE: The shader program given must ALREADY be active. 
     * @param {Shader} shaderProgram the shader program istance to set the uniforms for
     */
    applyToShader(shaderProgram) {
        if (!(shaderProgram instanceof Shader && shaderProgram.isActive())) {
            console.error(`[WebGL@${this.#contextName}] TypeError: Expected 'shaderProgram' to be an active instance of Shader. Cannot set mesh uniforms ID@${this.#meshID}.`);
        }
        // apply model matrix
        shaderProgram.setMatrix4('model', this.transform.getWorldMatrix());

        // apply material uniforms, skip textures if texture coords are not present
        const meshData = Mesh.#meshRegistry.get(this.#contextName).getByName(this.#meshPath);
        this.#material.applyToShader(shaderProgram, meshData.hasTexCoords);
    }

    /**
     * Reevaluate this mesh's currently set shader. Only triggers best-fit algorithm if the Material's capabilities have changed.
     * This is safe to call every frame, as best-fit is an asyncronous process. This Mesh's shader is only updated when best-fit finishes execution.
     */
    refreshShaderEvaluation() {
        const materialCapabilities = this.#material.getCapabilities();
        const sameCapabilities = this.#sameMaterialCapabilities(this.#currentMaterialCapabilities, materialCapabilities);   
        // check if a shader is known and material properties/textures havent changed - if so, the current shader is accurate.
        if (this.#currentShaderName !== null && sameCapabilities) {
            return; // shader is all up to date
        }

        // otherwise, shader evaluation is required - make sure one is not already in progress (prevents race conditions)
        if (this.#shaderSelectionPromise === null) {

            // bestFitShader() is *async*
            this.#shaderSelectionPromise = ShaderManager.bestFitShader(this.#meshCapabilities, materialCapabilities, this.#preferredShaderName)
            .then(newShaderName => {
                if (this.#currentShaderName !== newShaderName) {
                    ShaderManager.release(this.#contextName, this.#currentShaderName);
                    console.log(`[WebGL@${this.#contextName}] Mesh: Switched best-fit shader for mesh ${this.#meshPath} from ${this.#currentShaderName} to ${newShaderName}.`);
                    this.#currentShaderName = newShaderName;
                }
                this.#currentMaterialCapabilities = materialCapabilities;
                this.#shaderSelectionPromise = null;
            })
            .catch(error => { 
                // Catch any errors or unexpected issues
                console.error(`[WebGL@${this.#contextName}] Mesh: Error selecting best-fit shader for @${this.#meshPath}: `, error);
                this.#currentShaderName = null;
                this.#shaderSelectionPromise = null
            });
        }
    }

    /** compares material capabilities. Returns true if they're the same, false otherwise */
    #sameMaterialCapabilities(oldCapabilities, newCapabilities) {
        if (!oldCapabilities || !newCapabilities) {
            // case that one or both are null/undefined
            return oldCapabilities === newCapabilities;
        }

        // compare properties
        const oldProps = [...oldCapabilities.properties].sort();
        const newProps = [...newCapabilities.properties].sort();
        if (oldProps.length !== newProps.length || oldProps.join(',') !== newProps.join(',')) {
            return false;
        }

        // compare textures
        const oldTextures = [...oldCapabilities.textures].sort();
        const newTextures = [...newCapabilities.textures].sort();
        if (oldTextures.length !== newTextures.length || oldTextures.join(',') !== newTextures.join(',')) {
            return false;
        }

        // checks pass, the capabilities are the same
        return true;
    }

    /** 
     * Remove this Mesh's VAO and buffer references, as well as the shader, effectly rendering it defunct. Only call this if this mesh object is no longer needed.
     * If no meshes use the same VAO/buffers after disposal, those VAOs and buffers are removed from memory. 
     * */
    dispose() {
        // free material
        this.#material.dispose();

        // free shader
        if (this.#currentShaderName !== null) {
            ShaderManager.release(this.#contextName, this.#currentShaderName);
        }
        // free the mesh data
        Mesh.release(this.#contextName, this.#meshPath);

        // nullify instance references
        this.#material = null;
        this.#currentShaderName = null;
    }

    /** Retrieves meshdata from memory - if doesn't exist, creates a new one */
    #initializeMesh() {
        // get meshCollection. If it doesn't exist, create a new one
        const meshRegistry = Mesh.#meshRegistry;
        if (!meshRegistry.has(this.#contextName)) {
            meshRegistry.set(this.#contextName, new Collection(`MeshCollection@${this.#contextName}`));
        }
        const meshCollection = meshRegistry.get(this.#contextName);

        // if the meshCollection already has the mesh, we increment the reference count and return.
        if (meshCollection.contains(this.#meshPath)) {
            const meshData = meshCollection.getByName(this.#meshPath);
            meshData.refCount++; // new reference! Increment internal counter
            this.#updateMeshCapabilities(meshData);
            return true; // signal that an already loaded mesh was found
        }

        // mesh hasn't been made, so we create a new one
        this.#createNewMesh(meshCollection);
        return false; // signal that a loaded mesh was not found, and that async loading has begun
    }

    /** creates a new meshData object (for the static registry) delegating loading to MeshLoader */
    #createNewMesh(meshCollection) {
        // at this point, a new mesh and VAO object need to be created
        const meshDataObj = {
            VAO: null,
            refCount: 1,
            drawMode: null,
            vertexCount: 0,
            hasTexCoords: false,
            options: this.#meshOptions, // this is a js object
            isLoaded: false
        }
        meshCollection.add(this.#meshPath, meshData); // no tags

        // save promise to prevent race conditions during rendering
        MeshLoader.loadMesh(this.#meshPath)
        .then(rawMeshData => {
            // if the mesh failed to load, can't define the texture
            if (rawMeshData === null){
                console.error(`[WebGL@${this.#contextName}] Mesh: Mesh data failed to load for Mesh '${this.#meshPath}'. Removing asset from registry.`);
                meshCollection.removeByName(this.#meshPath);
                return;
            }
            // make sure gl and meshData are defined
            if (!this.#gl) {
                console.error(`[WebGL@${this.#contextName}] Mesh: GL context '${this.#contextName}' became unavailable during load of '${this.#meshPath}'. Cannot define mesh.`);
                meshCollection.removeByName(this.#meshPath);
                return;
            }

            // Check if VAO creation was successful, setup properties if so
            const webGL_VAO = this.#defineVAO(rawMeshData, meshDataObj);
            if (webGL_VAO) {
                meshDataObj.VAO = webGL_VAO;
                meshDataObj.drawMode = rawMeshData.drawMode,
                meshDataObj.vertexCount = Math.floor(rawMeshData.vertexArray.length / 3);
                meshDataObj.hasTexCoords = !rawMeshData.texCoordsArray ? false : true;
                meshDataObj.isLoaded = true;

                // CRITICAL: once the VAO is created, we need to update the mesh's capability list and trigger shader evaluation so the mesh can render
                this.#updateMeshCapabilities(meshDataObj);
                this.refreshShaderEvaluation(meshDataObj);
            } else {
                console.error(`[WebGL@${this.#contextName}] Mesh: Failed to create VAO for mesh '${this.#meshPath}'. Removing asset from registry.`);
                meshCollection.removeByName(this.#meshPath); // Clean up failed VAO creation
            }
        })
        .catch(error => { 
            // Catch any errors from #defineTexture or unexpected issues
            console.error(`[WebGL@${this.#contextName}] Mesh: Error processing Mesh @${this.#meshPath}: `, error);
            meshCollection.removeByName(this.#meshPath);
        });
    }

    /** Creates a new Vertex Array Object (VAO) for this mesh. Should only be called once. */
    #defineVAO(meshData, meshDataObj) {
        // get context and draw type
        const gl = this.#gl;
        const drawType = this.#meshOptions.drawType ? this.#meshOptions.drawType : gl.STATIC_DRAW;

        // create and bind VAO
        const VAO = gl.createVertexArray();
        gl.bindVertexArray(VAO);

        // create and bind vertex buffer
        const vertexLocation = ShaderManager.ATTRIB_LOCATION_VERTEX;
        const vertexArray = meshData.vertexArray;
        meshDataObj.vertexBuffer = this.#createBuffer(gl, vertexLocation, vertexArray, 3, drawType);

        // create and bind normal buffer
        const normalLocation = ShaderManager.ATTRIB_LOCATION_NORMAL;
        const normalArray = meshData.normalArray;
        meshDataObj.normalBuffer = this.#createBuffer(gl, normalLocation, normalArray, 3, drawType);

        // if texture coordinates present, bind coordinates
        if (meshData.texCoordsArray) {
            // create and bind uv buffer
            const uvLocation = ShaderManager.ATTRIB_LOCATION_UV;
            const uvArray = meshData.texCoordsArray;
            meshDataObj.uvBuffer = this.#createBuffer(gl, uvLocation, uvArray, 2, drawType);
        }

        // bind index buffer
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.indexArray, drawType);
        meshDataObj.indexBuffer = indexBuffer;

        // buffers are all bound to VAO, can safely unbind buffers from context
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        // finally return the created VAO
        return VAO;
    }

    /** creates a new buffer object at the given location with the given data */
    #createBuffer(gl, location, data, elementSize, drawType) {
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

    /**
     * Release the mesh at the given path with the associated context from memory.
     * @param {string} contextName the name of the WebGL context this mesh is associated with
     * @param {string} texturePath the path to the mesh
     * @returns {boolean} true if the mesh was successfully released, false otherwise
     */
    static release(contextName, meshPath) {
        // check first if the context exists and has any meshes defined
        const gl = Graphics3D.getGLContext(contextName);
        const meshCollection = Mesh.#meshRegistry.get(contextName);
        if (!(meshCollection && gl)) {
            console.warn(`Warning: The WebGL context @${contextName} either doesn't exist or has no registered meshes. Cannot release mesh from memory.`);
            return false;
        }
        // then check if the collection has this specific mesh defined
        const meshData = meshCollection.getByName(meshPath);
        if (!meshData) {
            console.warn(`[WebGL@${contextName}] Warning: Mesh @${meshPath} was not found in the collection. Cannot release mesh from memory.`);
            return false;
        }
        // at this point we know that the mesh is defined, we're safe to operate on it
        meshData.refCount--; // decrement reference count

        // if the reference count is <= 0, delete the mesh from memory
        if (meshData.refCount <= 0 ) {
            gl.deleteVertexArray(meshData.VAO);
            if (meshData.vertexBuffer) gl.deleteBuffer(meshData.vertexBuffer);
            if (meshData.normalBuffer) gl.deleteBuffer(meshData.normalBuffer);
            if (meshData.uvBuffer) gl.deleteBuffer(meshData.uvBuffer);
            if (meshData.indexBuffer) gl.deleteBuffer(meshData.indexBuffer);

            meshCollection.removeByName(meshPath);
        }
        return true;
    }

    /**
     * Release all of the meshes associated with the provided context from memory. Note that any Mesh instances created with this context will no longer be valid.
     * @param {string} contextName the name of the WebGL context
     * @returns true if all meshes associated with the context were released, false otherwise
     */
    static releaseAll(contextName) {
        const gl = Graphics3D.getGLContext(contextName);
        const meshCollection = Mesh.#meshRegistry.get(contextName);
        if (!(meshCollection && gl)) {
            console.warn(`Warning: The WebGL context @${contextName} either doesn't exist or has no registered meshes. Cannot release meshes from memory.`);
            return false;
        }

        let allMeshesReleased = true;
        const meshPathsArray = Array.from(meshCollection.getNames());
        for (const meshPath of meshPathsArray) {
            if (!(Mesh.release(contextName, meshPath))) {
                allMeshesReleased = false;
            }
        }
        return allMeshesReleased;
    }

    /**
     * Check if the mesh path with the given context has successfully been loaded into GPU memory
     * @param {string} contextName the name of the WebGL context this mesh is associated with
     * @param {string} meshPath the path to the mesh
     * @returns {boolean} true if the mesh is loaded, false otherwise
     */
    static isMeshLoaded(contextName, meshPath) {
        // first check if the registry has the mesh collection
        const meshCollection = Mesh.#meshRegistry.get(contextName);
        if (!meshCollection) return false;
        
        // then check if the collection has the mesh
        const meshData = meshCollection.getByName(meshPath);
        if (!meshData) return false;

        // finally check if the status of the mesh is loaded
        return meshData.isLoaded;
    }

    /**
     * Retreive a snapshot of the mesh data associated with this mesh. If the mesh is not loaded or is invalid, null is returned.
     * @param {string} contextName the name of the context this mesh is associated with
     * @param {string} meshPath the path to the mesh file
     * @returns {object} a deep copy of the data associated with this mesh, including the path and gl context name. Does not include the VAO or reference count.
     */
    static getMeshData(contextName, meshPath) {
         // check first if registry has the mesh collection
        const meshCollection = Mesh.#meshRegistry.get(contextName);
        if (!meshCollection) {
            console.warn(`Warning: The WebGL context @${contextName} has no registered meshes. Cannot get mesh data.`);
            return null;
        }
        // then check if the collection has this specific mesh defined
        const meshData = meshCollection.getByName(meshPath);
        if (!meshData) {
            console.warn(`[WebGL@${contextName}] Warning: Mesh @${meshPath} was not found. Cannot get mesh data.`);
            return null;
        }
        
        const meshDataCopy = {
            meshPath: meshPath,
            contextName: contextName,
            drawMode: meshData.drawMode,
            vertexCount: meshData.vertexCount,
            hasTexCoords: meshData.hasTexCoords,
            isLoaded: meshData.isLoaded
        }

        // provide read only object
        return Object.freeze(meshDataCopy);
    }
}