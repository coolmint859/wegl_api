/**
 * Core real-time 3D application renderer. 
 */
class Graphics3D {
    constructor(canvasID, width, height) {
        this.canvas = document.getElementById(canvasID);
        this.gl = this.canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: false });
        console.log("WebGL Context Type:", this.gl ? this.gl.constructor.name : "null");
        this.gl.viewport(0, 0, width, height);

        // enable color blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)

        // enable back-face culling
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.frontFace(this.gl.CCW);
        this.gl.cullFace(this.gl.BACK);

        this.canvas.width = width;
        this.canvas.height = height;
        this.aspectRatio = height / width;

        this.sceneObjects = [];
        this.pointLights = [];
        this.shaders = new Map();
        this.shadersLoaded = new Map();

        this.RenderType = {
            'PHONG': 'phong',
            'BASIC': 'basic',
            'LIGHT': 'light',
            'TEXTURE': 'texture'
        }
        this.MeshType = {
            'STRIP': this.gl.TRIANGLE_STRIP,
            'FAN': this.gl.TRIANGLE_FAN,
            'TRIANGLES': this.gl.TRIANGLES
        }
        Object.freeze(this.RenderType);
        Object.freeze(this.MeshType);
        

        this.scenes = new Map();

        // setup camera information
        this.cameras = new Map();
        this.cameras.set('default', new FPSCamera());
        this.currentCamera = this.cameras.get('default');
        this.currentCamera.initMouseControls(this.canvas);

        this.ambientColor = Color.BLACK;
        this.clearColor = Color.CF_BLUE;

        this.#setupShader(this.RenderType.BASIC);
        this.#setupShader(this.RenderType.PHONG);
        this.#setupShader(this.RenderType.TEXTURE);
        this.#setupShader(this.RenderType.LIGHT);
    }

    #setupShader(name) {
        let vertexPath = "shaders/" + name + ".vert";
        let fragmentPath = "shaders/" + name + ".frag";

        let shader = new Shader(this.gl, vertexPath, fragmentPath);

        this.shaders.set(name, shader);
        this.shadersLoaded.set(name, false);

        shader.create().then((success) => {
            let capitalName = name.charAt(0).toUpperCase() + name.slice(1);

            if (success) {
                console.log(capitalName + " shaders created successfully.");
            } else {
                console.warn(capitalName + " shaders were not created successfully.");
            }
            this.shadersLoaded.set(name, success);
        })
        return shader;
    }

    /** Returns the current WebGl context. */
    getGLContext() {
        return this.gl;
    }

    /** Go through all active shaders and check if they're loaded */
    activeShadersLoaded() {
        for (const isLoaded of this.shadersLoaded.values()) {
            if (!isLoaded) return false; 
        }
        return true;
    }

    /** sets the width/height of the viewport */
    setViewport(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.aspectRatio = width/height;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    /** add a new camera to the scene */
    addCamera(name, camera) {
        if (!(camera instanceof Camera)) {
            console.error(`${camera} is not an instance of Camera. Cannot add to system.`);
            return;
        }
        this.cameras.set(name, camera);
    }

    /** Sets the current active camera. If no camera of the name is found, creates a default camera with that name */
    setCurrentCamera(cameraName) {
        if (!this.cameras.has(cameraName)) {
            this.addCamera(cameraName, new Camera());
        }
        this.currentCamera = this.cameras.get(cameraName);
    }

    /** get the currently active camera */
    getCurrentCamera() {
        return this.currentCamera;
    }

    /** set the ambient color */
    setAmbientColor(color) {
        this.ambientColor = color;
    }

    /** set the clear (background) color */
    setClearColor(color) {
        this.clearColor = color;
    }

    /** clears the screen and scene to make way for new objects. Should be called every frame before rendering */
    begin(dt) {
        // update current camera
        this.currentCamera.update(dt, this.aspectRatio);

        // this is to make sure a shader is always in use.
        this.shaders.get(this.RenderType.BASIC).use();

        // reset scene objects to be empty
        this.sceneObjects = [];
        this.pointLights = [];

        // set background color
        this.gl.clearColor(this.clearColor.r, this.clearColor.g, this.clearColor.b, this.clearColor.a);
        this.gl.clearDepth(1.0);

        // enable depth testing
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.enable(this.gl.DEPTH_TEST);

        // clear the screen & depth buffer
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    /** draws an object */
    draw(mesh, renderType, meshType) {
        let rType;
        if (renderType != null) {
            let validRenderType = false;
            Object.values(this.RenderType).forEach(value => {
                if (renderType == value) validRenderType = true;
            })

            if (!validRenderType) {
                console.warn(`Invalid render type '${renderType}'. Defaulting to BASIC.`)
                rType = this.RenderType.BASIC;
            } else {
                rType = renderType;
            }
        } else {
            rType = this.RenderType.BASIC;
        }

        let mType;
        if (meshType != null) {
            let validMeshType = false;
            Object.values(this.MeshType).forEach(value => {
                if (meshType == value) validMeshType = true;
            })

            if (!validMeshType) {
                console.warn(`Invalid mesh type '${meshType}'. Defaulting to TRIANGLES.`)
                mType = this.MeshType.TRIANGLES;
            } else {
                mType = meshType;
            }
        } else {
            mType = this.MeshType.TRIANGLES;
        }

        if (rType == this.RenderType.LIGHT) {
            this.pointLights.push({
                "mesh": mesh,
                "rType": rType,
                "mType": mType,
            });
        }
        this.sceneObjects.push({
            "mesh": mesh,
            "rType": rType,
            'mType': mType,
        });
    }

    /** renders objects and lights to the screen. */
    end() {
        for (let i = 0; i < this.sceneObjects.length; i++) {
            let object = this.sceneObjects[i];
            
            // determine shader
            const shader = this.shaders.get(object.rType);
            shader.use(); // VERY IMPORTANT LINE, this sets the current shader appropriately.

            // set up and bind object VAO
            if (!object.mesh.VAO) {
                this.#setupBuffers(shader, object.rType, object.mesh);
            }
            this.gl.bindVertexArray(object.mesh.VAO);

            // set up shader uniforms && attributes
            if (object.rType == this.RenderType.PHONG) {
                this.#setPhongShaderUniforms(shader, object);
                this.#setLightingAttributes(shader);
            } else if (object.rType == this.RenderType.TEXTURE) {
                this.#setTextureShaderUniforms(shader, object);
                this.#setLightingAttributes(shader);
            } else {
                this.#setBasicShaderUniforms(shader, object);
            }
            
            // draw object
            this.gl.drawElements(object.mType, object.mesh.indices.length, this.gl.UNSIGNED_SHORT, 0);
            
            // unbind vertex array
            this.gl.bindVertexArray(null);
        }
    }

    #setBasicShaderUniforms(baseShader, object) {
        // in case something goes wrong with the other shaders, this ensures that
        // the object will still be rendered (even if it's just black)
        let baseColor;
        if (object.mesh.diffuseColor == null) {
            baseColor = new Vector3(); // black
        } else {
            baseColor = object.mesh.diffuseColor;
        }
            
        const modelMatrix = Matrix4.TRS4(object.mesh.center, object.mesh.rotation, object.mesh.dimensions);
        baseShader.setMatrix4("model", modelMatrix);
        baseShader.setMatrix4('view', this.currentCamera.getViewMatrix());
        baseShader.setMatrix4('projection', this.currentCamera.getProjectionMatrix());
        baseShader.setColor('baseColor', baseColor);
    }

    #setPhongShaderUniforms(phongShader, object) {
        const modelMatrix = Matrix4.TRS4(object.mesh.center, object.mesh.rotation, object.mesh.dimensions);
        phongShader.setMatrix4("model", modelMatrix);
        phongShader.setMatrix4('view', this.currentCamera.getViewMatrix());
        phongShader.setMatrix4('projection', this.currentCamera.getProjectionMatrix());
        phongShader.setColor('ambientColor', this.ambientColor);
        phongShader.setColor("object.diffuseColor", object.mesh.diffuseColor);
        phongShader.setColor("object.specularColor", object.mesh.specularColor);
        phongShader.setFloat("object.shininess", object.mesh.shininess);
    }

    #setTextureShaderUniforms(textureShader, object) {
        const modelMatrix = Matrix4.TRS4(object.mesh.center, object.mesh.rotation, object.mesh.dimensions);
        textureShader.setMatrix4("model", modelMatrix);
        textureShader.setMatrix4('view', this.currentCamera.getViewMatrix());
        textureShader.setMatrix4('projection', this.currentCamera.getProjectionMatrix());
        textureShader.setColor('ambientColor', this.ambientColor);
        textureShader.setFloat("object.shininess", object.mesh.shininess);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, object.mesh.diffuseTexBuffer);
        textureShader.setInt('object.diffuseMap', 0);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, object.mesh.specularTexBuffer);
        textureShader.setInt('object.specularMap', 1);
    }

    #setLightingAttributes(shader) {
        shader.setInt("numLights", this.pointLights.length);
        for (let i = 0; i < this.pointLights.length; i++) {
            const currentLightName = "pointLights[" + i + "]";
            const currentLight = this.pointLights[i];

            // light colors
            shader.setColor(currentLightName + ".diffuseColor", currentLight.mesh.diffuseColor);
            shader.setColor(currentLightName + ".specularColor", currentLight.mesh.specularColor);
            
            // light attenuation factors
            shader.setFloat(currentLightName + ".atten_const", currentLight.mesh.attenuation.x);
            shader.setFloat(currentLightName + ".atten_linear", currentLight.mesh.attenuation.y);
            shader.setFloat(currentLightName + ".atten_quad", currentLight.mesh.attenuation.z);

            // light position
            shader.setVector3(currentLightName + ".position", currentLight.mesh.center);
        }
    }

    #createVertexBuffer(shader, vertices) {
        let vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

        let positionLocation = this.gl.getAttribLocation(shader.programID, 'aPosition');
        if (positionLocation !== -1){
            this.gl.enableVertexAttribArray(positionLocation);
            this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 0, 0);
        } else {
            console.warn("Attribute 'aPosition' not found in shader.");
        }
        
        return vertexBuffer;
    }

    #createNormalBuffer(shader, normals) {
        let normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, normals, this.gl.STATIC_DRAW);

        let normalLocation = this.gl.getAttribLocation(shader.programID, 'vertex_normal');
        if (normalLocation !== -1){
            this.gl.enableVertexAttribArray(normalLocation);
            this.gl.vertexAttribPointer(normalLocation, 3, this.gl.FLOAT, false, 0, 0);
        } else {
            console.warn("Attribute 'vertex_normal' not found in shader.");
        }
        
        return normalBuffer;
    }

    #createTextureCoordBuffer(shader, textureCoords) {
        // create coordinate buffer
        let textureCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, textureCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, textureCoords, this.gl.STATIC_DRAW);

        let texCoord = this.gl.getAttribLocation(shader.programID, 'aTexCoord');
        if (texCoord !== -1){
            this.gl.enableVertexAttribArray(texCoord);
            this.gl.vertexAttribPointer(texCoord, 2, this.gl.FLOAT, false, 0, 0);
        } else {
            console.warn("Attribute 'aTexCoord' not found in shader.");
        }
        return textureCoordBuffer;
    }

    #createTextureImageBuffer(textureImage) {
        let textureImageBuffer = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, textureImageBuffer);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

        // const borderColor = [1.0, 1.0, 1.0, 1.0]; // set to white
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, textureImage);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        
        return textureImageBuffer;
    }

    #createIndexBuffer(indices) {
        let indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

        return indexBuffer;
    }

    #setupBuffers(shader, renderType, mesh) {
        mesh.VAO = this.gl.createVertexArray();
        this.gl.bindVertexArray(mesh.VAO);

        mesh.vertexBuffer = this.#createVertexBuffer(shader, mesh.vertices);
        if (renderType != this.RenderType.BASIC && renderType != this.RenderType.LIGHT) {
            mesh.normalBuffer = this.#createNormalBuffer(shader, mesh.normals);
        }

        if (renderType == this.RenderType.TEXTURE) {
            mesh.textureCoordBuffer = this.#createTextureCoordBuffer(shader, mesh.textureCoords);
            mesh.diffuseTexBuffer = this.#createTextureImageBuffer(mesh.diffuseImage);
            mesh.specularTexBuffer = this.#createTextureImageBuffer(mesh.specularImage);
        }
        mesh.indexBuffer = this.#createIndexBuffer(mesh.indices);

        this.gl.bindVertexArray(null);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }
}