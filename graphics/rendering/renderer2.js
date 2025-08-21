import FPSCamera from "../cameras/FPSCamera.js";
import Shader from "../shading/shader.js";
import Color from "../../utilities/containers/color.js";
import { Matrix4 } from "../../utilities/math/matrix.js";
import EventScheduler from "../../utilities/scheduler.js";

/**
 * Core real-time 3D application renderer. 
 */
export default class Graphics3D {
    static #canvas = document.getElementById("canvas-main");
    static #gl =  Graphics3D.#canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: false });

    static commonTypeToGL_type = new Map([
        ['char', Graphics3D.#gl.BYTE], ['uchar', Graphics3D.#gl.UNSIGNED_BYTE],
        ['int8', Graphics3D.#gl.BYTE], ['uint8', Graphics3D.#gl.UNSIGNED_BYTE],
        ['short', Graphics3D.#gl.SHORT], ['ushort', Graphics3D.#gl.UNSIGNED_SHORT],
        ['int16', Graphics3D.#gl.SHORT], ['uint16', Graphics3D.#gl.UNSIGNED_SHORT],
        ['int', Graphics3D.#gl.INT], ['uint', Graphics3D.#gl.UNSIGNED_INT],
        ['int32', Graphics3D.#gl.INT], ['uint32', Graphics3D.#gl.UNSIGNED_INT],
        ['float', Graphics3D.#gl.FLOAT], ['float32', Graphics3D.#gl.FLOAT],
    ])

    constructor(width, height) {
        const gl = Graphics3D.#gl;
        const canvas = Graphics3D.#canvas;
        canvas.width = width;
        canvas.height = height;

        console.log("WebGL Context Type:", gl ? gl.constructor.name : "null");
        gl.viewport(0, 0, width, height);

        // enable color blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        // enable back-face culling
        // gl.enable(gl.CULL_FACE);
        // gl.frontFace(gl.CCW);
        // gl.cullFace(gl.BACK);

        this.aspectRatio = height / width;

        this.sceneObjects = [];
        this.pointLights = [];
        this.shaders = new Map();

        this.RenderType = Object.freeze({
            'PHONG': 'phong',
            'BASIC': 'basic',
            'LIGHT': 'light',
            'TEXTURE': 'texture'
        });
        this.MeshType = Object.freeze({
            'STRIP': gl.TRIANGLE_STRIP,
            'FAN': gl.TRIANGLE_FAN,
            'TRIANGLES': gl.TRIANGLES
        });
        
        this.scenes = new Map();

        // setup camera information
        this.cameras = new Map();
        this.cameras.set('default', new FPSCamera());
        this.currentCamera = this.cameras.get('default');
        this.currentCamera.initMouseControls(canvas);

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

        let shader = new Shader(name, vertexPath, fragmentPath);
        this.shaders.set(name, shader);
    }

    /** Returns the current WebGl context. */
    static getGLContext() {
        return Graphics3D.#gl;
    }

    /** Go through all active shaders and check if they're loaded */
    activeShadersLoaded() {
        let shadersLoaded = true;
        for (const shader of this.shaders.values()) {
            if (!shader.isLoaded()) shadersLoaded = false;
        }
        return shadersLoaded;
    }

    /** sets the width/height of the viewport */
    setViewport(width, height) {
        const canvas = Graphics3D.#canvas;
        canvas.width = width;
        canvas.height = height;
        this.aspectRatio = width/height;
        Graphics3D.#gl.viewport(0, 0, canvas.width, canvas.height);
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
        const gl = Graphics3D.#gl;
        // update current camera
        this.currentCamera.update(dt, this.aspectRatio);

        // this is to make sure a shader is always in use.
        this.shaders.get(this.RenderType.BASIC).use();

        // reset scene objects to be empty
        this.sceneObjects = [];
        this.pointLights = [];

        // set background color
        gl.clearColor(this.clearColor.r, this.clearColor.g, this.clearColor.b, this.clearColor.a);
        gl.clearDepth(1.0);

        // enable depth testing
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.DEPTH_TEST);

        // clear the screen & depth buffer
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    /** draws an object */
    draw(model, renderType, meshType) {
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
                "model": model,
                "rType": rType,
                "mType": mType,
            });
        }
        this.sceneObjects.push({
            "model": model,
            "rType": rType,
            'mType': mType,
        });
    }

    /** renders objects and lights to the screen. */
    end(dt) {
        const gl = Graphics3D.#gl;
        for (let i = 0; i < this.sceneObjects.length; i++) {
            let object = this.sceneObjects[i];
            
            // determine shader
            const shader = this.shaders.get(object.rType);
            shader.use(); // VERY IMPORTANT LINE, this sets the current shader appropriately.

            // set up and bind object VAO
            if (!object.model.VAO) {
                this.#createMeshVAO(shader, object.rType, object.model);
            }
            gl.bindVertexArray(object.model.VAO);
            const indexAttribute = object.model.mesh.attributes.find(attr => attr.isIndexArray);
            const indexBuffer = object.model.glBuffers[indexAttribute.arrayIndex];
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

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

            const indexArrayLength = object.model.mesh.arrays[indexAttribute.arrayIndex].length;
            gl.drawElements(object.mType, indexArrayLength, gl.UNSIGNED_SHORT, 0);

            // unbind material textures (if exist)
            if (object.model.material) {
                object.model.material.unbindTextures();
            }
            
            // unbind buffers
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.bindVertexArray(null);
        }
        EventScheduler.update(dt);
    }

    #setBasicShaderUniforms(baseShader, object) {
        // in case something goes wrong with the other shaders, this ensures that
        // the object will still be rendered (even if it's just black)
        // let baseColor;
        // if (object.mesh.diffuseColor == null) {
        //     baseColor = new Vector3(); // black
        // } else {
        //     baseColor = object.mesh.diffuseColor;
        // }
            
        const modelMatrix = Matrix4.STR4(object.model.center, object.model.rotation, object.model.dimensions);
        baseShader.setMatrix4("model", modelMatrix);
        baseShader.setMatrix4('view', this.currentCamera.viewMatrix);
        baseShader.setMatrix4('projection', this.currentCamera.projectionMatrix);
        object.model.material.applyToShader(baseShader, false);
    }

    #setPhongShaderUniforms(phongShader, object) {
        const modelMatrix = Matrix4.STR4(object.model.center, object.model.rotation, object.model.dimensions);
        phongShader.setMatrix4("model", modelMatrix);
        phongShader.setMatrix4('view', this.currentCamera.viewMatrix);
        phongShader.setMatrix4('projection', this.currentCamera.projectionMatrix);
        phongShader.setColor('ambientColor', this.ambientColor);
        object.model.material.applyToShader(phongShader, false);
    }

    #setTextureShaderUniforms(textureShader, object) {
        const gl = Graphics3D.#gl;
        const modelMatrix = Matrix4.STR4(object.model.center, object.model.rotation, object.model.dimensions);
        textureShader.setMatrix4("model", modelMatrix);
        textureShader.setMatrix4('view', this.currentCamera.viewMatrix);
        textureShader.setMatrix4('projection', this.currentCamera.projectionMatrix);
        textureShader.setColor('ambientColor', this.ambientColor);
        object.model.material.applyToShader(textureShader, true);
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
        const gl = Graphics3D.#gl;
        let vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        let positionLocation = gl.getAttribLocation(shader.getProgramID(), 'aPosition');
        if (positionLocation !== -1){
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        } else {
            console.warn("Attribute 'aPosition' not found in shader.");
        }
        
        return vertexBuffer;
    }

    #createNormalBuffer(shader, normals) {
        const gl = Graphics3D.#gl;

        let normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        let normalLocation = gl.getAttribLocation(shader.getProgramID(), 'aNormal');
        if (normalLocation !== -1){
            gl.enableVertexAttribArray(normalLocation);
            gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
        } else {
            console.warn("Attribute 'aNormal' not found in shader.");
        }
        
        return normalBuffer;
    }

    #createTextureCoordBuffer(shader, textureCoords) {
        const gl = Graphics3D.#gl;

        // create coordinate buffer
        let textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);

        let texCoord = gl.getAttribLocation(shader.getProgramID(), 'aTexCoord');
        if (texCoord !== -1){
            gl.enableVertexAttribArray(texCoord);
            gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, 0, 0);
        } else {
            console.warn("Attribute 'aTexCoord' not found in shader.");
        }
        return textureCoordBuffer;
    }

    #createIndexBuffer(indices) {
        const gl = Graphics3D.#gl
        let indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        return indexBuffer;
    }

    #createAttribute(shader, attribInfo) {
        console.log(attribInfo);
        if (attribInfo.isIndexArray) return;

        const gl = Graphics3D.#gl;

        let attribName = '';
        if (attribInfo.attribName === 'vertex') {
            attribName = 'aPosition';
        } else if (attribInfo.attribName === 'normal') {
            attribName = 'aNormal'
        } else if (attribInfo.attribName === 'uv') {
            attribName = 'aTexCoord'
        }

        const glAttrType = Graphics3D.commonTypeToGL_type.get(attribInfo.dataType);
        const location = gl.getAttribLocation(shader.getProgramID(), attribName);
        if (location === -1) {
            // console.warn(`[Graphics3D] Shader '${shader.getName()}' does not support vertex attribute '${attribName}'.`)
        } else {
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, attribInfo.size, glAttrType, false, attribInfo.stride, attribInfo.offset);
        }
    }

    #createMeshVAO(shader, renderType, model) {
        const gl = Graphics3D.#gl;

        model.VAO = gl.createVertexArray();
        gl.bindVertexArray(model.VAO);

        // create buffer and bind attributes
        model.glBuffers = [];
        for (let i = 0; i < model.mesh.arrays.length; i++) {
            console.log(model.mesh.arrays[i]);
            const glBuffer = gl.createBuffer();
            const arrayAttrs = model.mesh.attributes.filter(attr => attr.arrayIndex === i);
            const bufferType = arrayAttrs[0].isIndexArray ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

            gl.bindBuffer(bufferType, glBuffer);
            gl.bufferData(bufferType, model.mesh.arrays[i], gl.STATIC_DRAW);

            arrayAttrs.forEach(attr => this.#createAttribute(shader, attr));

            model.glBuffers.push(glBuffer);

            gl.bindBuffer(bufferType, null);
        }

        // mesh.vertexBuffer = this.#createVertexBuffer(shader, mesh.vertices);
        // if (renderType != this.RenderType.BASIC && renderType != this.RenderType.LIGHT) {
        //     mesh.normalBuffer = this.#createNormalBuffer(shader, mesh.normals);
        // }

        // if (renderType == this.RenderType.TEXTURE) {
        //     mesh.textureCoordBuffer = this.#createTextureCoordBuffer(shader, mesh.textureCoords);
        // }
        // mesh.indexBuffer = this.#createIndexBuffer(mesh.indices);

        gl.bindVertexArray(null);
    }
}