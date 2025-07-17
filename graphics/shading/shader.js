
/**
 * Represents a generic shader program. Handling creation, linking, and setting uniforms.
 */
class Shader {
    constructor(gl, vertex_path, fragment_path) {
        this.gl = gl;

        this.locationMap = new Map();

        this.vertex_path = vertex_path;
        this.fragment_path = fragment_path;

        this.inUse = true;
    }

    /** create a new shader program with the given vertex and fragment shader paths */
    async create() {
        try {
            let vertexShader = await this.#loadVertexShader(this.vertex_path);
            let fragmentShader = await this.#loadFragmentShader(this.fragment_path);

            this.programID = this.gl.createProgram();
            this.gl.attachShader(this.programID, vertexShader);
            this.gl.attachShader(this.programID, fragmentShader);
            this.gl.linkProgram(this.programID);

            const linkSuccess = this.gl.getProgramParameter(this.programID, this.gl.LINK_STATUS);
            if (!linkSuccess) {
                const infoLog = this.gl.getProgramInfoLog(this.programID);
                console.error(`Failed to link shader program:\n` + infoLog);
                return false;
            }
        } catch (error) {
            console.log(error);
            return false;
        }
        return true;
    }

    async #loadVertexShader() {
        let vertexShaderSource = await loadFileFromServer(this.vertex_path);
        let vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(vertexShader, vertexShaderSource);
        this.gl.compileShader(vertexShader);

        const compileSuccess = this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS);
        if (!compileSuccess) {
            const infoLog = this.gl.getShaderInfoLog(vertexShader);
            console.error(`Failed to compile vertex shader:\n` + infoLog);
        }

        return vertexShader;
    }

    async #loadFragmentShader() {
        let fragmentShaderSource = await loadFileFromServer(this.fragment_path);
        let fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(fragmentShader, fragmentShaderSource);
        this.gl.compileShader(fragmentShader);

        const compileSuccess = this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS);
        if (!compileSuccess) {
            const infoLog = this.gl.getShaderInfoLog(fragmentShader);
            console.error(`Failed to compile fragment shader:\n` + infoLog);
        }
        
        return fragmentShader;
    }

    #getUniformLocation(name) {
        if (this.locationMap.has(name)) {
            return this.locationMap.get(name);
        }

        let location = this.gl.getUniformLocation(this.programID, name);
        if (location === -1) {
            console.warn(`Unable to find uniform location for '${name}'.`);
            return -1;
        }

        this.locationMap.set(name, location);
        return location;
    }

    /**
     * sets this shader as currently active.
     */
    use() {
        this.gl.useProgram(this.programID);
        this.inUse = true;
    }

    /**
     * sets the active shader to null
     */
    unuse() {
        this.gl.useProgram(null);
        this.inUse = false;
    }

    isActive() {
        return this.inUse;
    }

    /**
    * Set a uniform boolean value with the given name
    */
    setBool(name, bool) {
        if (typeof bool != 'boolean') {
            console.error(`Value ${bool} is not of type 'boolean'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniform1i(location, bool);
    }

    /**
    * Set a uniform integer value with the given name
    */
    setInt(name, value) {
        if (typeof value != 'number') {
            console.error(`Value ${value} is not of type 'integer'. Unable to set attribute.`);
            return;
        }
        
        let location = this.#getUniformLocation(name);
        this.gl.uniform1i(location, value);
    }

    /**
    * Set a uniform float value with the given name
    */
    setFloat(name, value) {
        if (typeof value != 'number') {
            console.error(`Value ${value} is not of type 'float'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniform1f(location, value);
    }

    /**
    * Set a uniform Matrix4 value with the given name
    */
    setMatrix4(name, matrix) {
        if (!(matrix instanceof Matrix4)) {
            console.error(`Value ${matrix} is not of type 'Matrix4'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniformMatrix4fv(location, false, matrix.transpose().asList());
    }

    /**
    * Set a uniform Matrix3 value with the given name
    */
    setMatrix3(name, matrix) {
        if (!(matrix instanceof Matrix3)) {
            console.error(`Value ${matrix} is not of type 'Matrix3'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniformMatrix3fv(location, false, matrix.transpose().asList());
    }

    /**
    * Set a uniform Matrix2 value with the given name
    */
    setMatrix2(name, matrix) {
        if (!(matrix instanceof Matrix2)) {
            console.error(`Value ${matrix} is not of type 'Matrix2'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniformMatrix2fv(location, false, matrix.transpose().asList());
    }

    /**
    * Set a uniform Vector4 value with the given name
    */
    setVector4(name, vector) {
        if (!(vector instanceof Vector4)) {
            console.error(`Value ${vector} is not of type 'Vector4'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniform4fv(location, vector.asList());
    }

    /**
    * Set a uniform Vector3 value with the given name
    */
    setVector3(name, vector) {
        if (!(vector instanceof Vector3)) {
            console.error(`Value ${vector} is not of type 'Vector3'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniform3fv(location, vector.asList());
    }

    /**
    * Set a uniform Vector2 value with the given name
    */
    setVector2(name, vector) {
        if (!(vector instanceof Vector2)) {
            console.error(`Value ${vector} is not of type 'Vector2'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniform2fv(location, vector.asList());
    }

    /**
    * Set a uniform Color value with the given name
    */
    setColor(name, color) {
        if (!(color instanceof Color)) {
            console.error(`Value ${color} is not of type 'Color'. Unable to set attribute.`);
            return;
        }

        let location = this.#getUniformLocation(name);
        this.gl.uniform3fv(location, color.asList());
    }
}
