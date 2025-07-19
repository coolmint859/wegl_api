
/**
 * Represents a generic shader program. Handling creation, linking, and setting uniforms.
 */
class Shader {
    static #gl;

    #shaderName;
    #vertexPath;
    #fragmentPath;

    /**
     * Create a new Shader instance
     * @param {string} shaderName the name of the shader. Must be unique.
     * @param {string} vertex_path the path to the vertex shader
     * @param {string} fragment_path the path to the fragment shader
     */
    constructor(shaderName, vertex_path, fragment_path) {
        Shader.#gl = Graphics3D.getGLContext();
        this.#shaderName = shaderName;

        this.#vertexPath = vertex_path;
        this.#fragmentPath = fragment_path;

        AssetRegistry.load(shaderName, this.#buildProgram.bind(this), this.#disposeProgram.bind(this))
        .then(programData => {
            console.log(`[Shader @${shaderName}] Compiled and linked Shader successfully.`);
        }).catch(error => {
            console.error(`[Shader @${shaderName}] Failed to compile and link Shader. Error: ${error}`);
        });
    }

    getName() {
        return this.#shaderName;
    }

    getProgramID() {
        const shaderData = AssetRegistry.getAssetData(this.#shaderName);
        return shaderData.programID;
    }

    /**
     * Retreive the capabilities of this shader. (Obtained through shader reflection)
     * @returns {Array<string>} an array of sorted shader variable names (uniforms + attributes)
     */
    getCapabilities() {
        if (this.isLoaded()) {
            const shaderData = AssetRegistry.getAssetData(this.#shaderName);
            return shaderData.variableNames.sort();
        } else {
            console.warn(`[Shader @${this.#shaderName}] Cannot retreive shader variables as this shader is not yet loaded.`);
            return [];
        }
    }

    /**
     * Checks if the shader supports the provided variable (uniform/attribute)
     * @param {string} variableName the name of the variable
     * @returns {boolean} returns true if the shader supports the variable, false otherwise.
     */
    supports(variableName) {
        // const shaderData = AssetLoader.getAssetData(this.#shaderName);
        // return shaderData.variableNames.includes(variableName);
        return true;
    }

    /**
     * Checks if the shader is compiled, linked and successfully loaded
     * @returns {boolean} true if the shader is ready, false otherwise
     */
    isLoaded() {
        return AssetRegistry.isLoaded(this.#shaderName);
    }

    /**
     * Set this shader as the currently active shader.
     */
    use() {
        Shader.#gl.useProgram(this.getProgramID());
    }

    /**
     * Set the active shader to null
     */
    unuse() {
        Shader.#gl.useProgram(null);
    }

    /**
     * Checks if this shader is currently in active use by WebGL
     * @returns {boolean} true if this shader is in active use, false otherwise
     */
    isActive() {
        if (!this.isLoaded()) return false;

        const gl = Shader.#gl;
        const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
        if (!currentProgram) return false;

        const shaderData = AssetRegistry.getAssetData(this.#shaderName);
        if (!shaderData) return false;

        return shaderData.programID === currentProgram;
    }

    /**
    * Set a uniform boolean value with the given name
    */
    setBool(name, bool) {
        if (this.isActive() && typeof bool === 'boolean') {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniform1i(location, bool);
        } else if (typeof value !== 'boolean') {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'value' to be a boolean. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set boolean uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform integer value with the given name
    */
    setInt(name, value) {
        if (this.isActive() && typeof value === 'number') {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniform1i(location, value);
        } else if (typeof value !== 'number') {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'value' to be an integer. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set integer uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform float value with the given name
    */
    setFloat(name, value) {
        if (this.isActive() && typeof value === 'number') {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniform1f(location, value);
        } else if (typeof value !== 'number') {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'value' to be a float. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set float uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform Matrix4 value with the given name
    */
    setMatrix4(name, matrix) {
        if (this.isActive() && matrix instanceof Matrix4) {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniformMatrix4fv(location, false, matrix.transpose().asList());
        } else if (!(matrix instanceof Matrix4)) {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'matrix' to be an instance of Matrix4. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set mat4 uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform Matrix3 value with the given name
    */
    setMatrix3(name, matrix) {
        if (this.isActive() && matrix instanceof Matrix3) {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniformMatrix3fv(location, false, matrix.transpose().asList());
        } else if (!(matrix instanceof Matrix3)) {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'matrix' to be an instance of Matrix3. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set mat3 uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform Matrix2 value with the given name
    */
    setMatrix2(name, matrix) {
        if (this.isActive() && matrix instanceof Matrix2) {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniformMatrix2fv(location, false, matrix.transpose().asList());
        } else if (!(matrix instanceof Matrix2)) {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'matrix' to be an instance of Matrix2. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set mat2 uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform Vector4 value with the given name
    */
    setVector4(name, vector) {
        if (this.isActive() && vector instanceof Vector4) {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniform4fv(location, vector.asList());
        } else if (!(vector instanceof Vector4)) {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'vector' to be an instance of Vector4. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set vec4 uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform Vector3 value with the given name
    */
    setVector3(name, vector) {
        if (this.isActive() && vector instanceof Vector3) {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniform3fv(location, vector.asList());
        } else if (!(vector instanceof Vector3)) {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'vector' to be an instance of Vector3. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set vec3 uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform Vector2 value with the given name
    */
    setVector2(name, vector) {
        if (this.isActive() && vector instanceof Vector2) {            
            let location = this.#getUniformLocation(name);
            Shader.#gl.uniform2fv(location, vector.asList());
        } else if (!(vector instanceof Vector2)) {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'vector' to be an instance of Vector2. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set vec2 uniform as this shader is not yet loaded.`)
        }
    }

    /**
    * Set a uniform Color value with the given name
    */
    setColor(name, color, useAlpha = false) {
        if (this.isActive() && color instanceof Color) {            
            let location = this.#getUniformLocation(name);
            if (useAlpha) {
                Shader.#gl.uniform4fv(location, color.asList(true));
            } else {
                Shader.#gl.uniform3fv(location, color.asList());
            }
        } else if (!(color instanceof Color)) {
            console.error(`[Shader @${this.#shaderName}] TypeError: Expected 'color' to be an instance of Color. Unable to set uniform.`);
        } else {
            console.error(`[Shader @${this.#shaderName}] Cannot set vec3/vec4 uniform as this shader is not yet loaded.`)
        }
    }

    /** Retrieve uniform location names from map */
    #getUniformLocation(name) {
        const programData = AssetRegistry.getAssetData(this.#shaderName);
        if (programData.uniformMap.has(name)) {
            return programData.uniformMap.get(name);
        }

        let location = Shader.#gl.getUniformLocation(programData.programID, name);
        if (location === -1) {
            console.warn(`[Shader @${this.#shaderName}] Unable to find uniform location for '${name}'.`);
            return -1;
        }

        programData.uniformMap.set(name, location);
        return location;
    }

    /** create a new shader program with the given vertex and fragment shader paths */
    async #buildProgram(shaderName) {
        try {
            const gl = Shader.#gl;

            const vertexShaderSource = await AssetRegistry.load(this.#vertexPath, loadFileFromServer);
            const fragmentShaderSource = await AssetRegistry.load(this.#fragmentPath, loadFileFromServer);

            const vertexShader = this.#compileShader(shaderName, vertexShaderSource, gl.VERTEX_SHADER);
            const fragmentShader = this.#compileShader(shaderName, fragmentShaderSource, gl.FRAGMENT_SHADER);
            const shaderProgram = this.#linkShaders(shaderName, vertexShader, fragmentShader);

            // once program is linked, we don't need the individual shaders anymore
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);

            // get shader variable names
            const shaderUniforms = this.#getUniqueUniforms(shaderProgram);
            const shaderAttributes = this.#getUniqueAttributes(shaderProgram);
            const shaderVariableNames = shaderUniforms.concat(shaderAttributes).sort();

            // this is stored in the AssetLoader cache
            return {
                shaderName: shaderName,
                programID: shaderProgram,
                vertexPath: this.#vertexPath,
                fragmentPath: this.#fragmentPath,
                variableNames: shaderVariableNames,
                uniformMap: new Map()
            }
        } catch (error) {
            console.error(`[Shader @${shaderName}] An error occurred during shader compilation:\n${error}`);
            throw error;
        }
    }

    #compileShader(shaderName, sourceText, shaderType) {
        const gl = Shader.#gl;
        const shaderTypeName = shaderType === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';

        const shaderObject = gl.createShader(shaderType);
        gl.shaderSource(shaderObject, sourceText);
        gl.compileShader(shaderObject);

        const compileSuccess = gl.getShaderParameter(shaderObject, gl.COMPILE_STATUS);
        if (!compileSuccess) {
            const infoLog = gl.getShaderInfoLog(shaderObject);
            console.error(`[Shader @${shaderName}] Failed to compile ${shaderTypeName} shader: ${infoLog}`);
        }
        return shaderObject;
    }

    #linkShaders(shaderName, vertexShader, fragmentShader) {
        const gl = Shader.#gl;
        const programID = gl.createProgram();
        gl.attachShader(programID, vertexShader);
        gl.attachShader(programID, fragmentShader);
        gl.linkProgram(programID);

        const linkSuccess = gl.getProgramParameter(programID, gl.LINK_STATUS);
        if (!linkSuccess) {
            const infoLog = gl.getProgramInfoLog(programID);
            console.error(`[Shader @${shaderName}] Failed to link shader program: ${infoLog}`);
        }
        return programID;
    }

    /** performs shader reflection to find all unique uniforms */
    #getUniqueUniforms(programID) {
        // TODO: filter out unique names
        const gl = Shader.#gl;

        const uniformNames = new Set();
        const numUniforms = gl.getProgramParameter(programID, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const uniformInfo = gl.getActiveUniform(programID, i);
            uniformNames.add(uniformInfo.name);
        }
        return Array.from(uniformNames);
    }

    /** performs shader reflection to find all unique attributes */
    #getUniqueAttributes(programID) {
        // TODO: filter out unique names
        const gl = Shader.#gl;

        const attributeNames = new Set();
        const numAttributes = gl.getProgramParameter(programID, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttributes; i++) {
            const attributeInfo = gl.getActiveAttrib(programID, i);
            attributeNames.add(attributeInfo.name);
        }
        return Array.from(attributeNames);
    }

    #disposeProgram(programData) {
        Shader.#gl.deleteProgram(programData.programID);
    }
}
