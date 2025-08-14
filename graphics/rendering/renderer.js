import FPSCamera from "../cameras/FPSCamera.js";
import Shader from "../shading/shader.js";
import Color from "../../utilities/containers/color.js";
import { Matrix4 } from "../../utilities/math/matrix.js";
import EventScheduler from "../../utilities/scheduler.js";
import Camera from "../cameras/camera.js";
import ShaderManager from "../shading/shader_manager.js";

/**
 * Core real-time 3D application renderer. 
 */
export default class Graphics3D {
    static #canvas = document.getElementById("canvas-main");
    static #gl =  Graphics3D.#canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: false });

    static glTypeMap = new Map([
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
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);
        gl.cullFace(gl.BACK);

        this.aspectRatio = height / width;

        this.sceneObjects = [];
        this.pointLights = [];
        this.shaders = new Map();

        this.RenderType = Object.freeze({
            PHONG: 'phong',
            BASIC: 'basic',
            LIGHT: 'basic',
            TEXTURE: 'texture'
        });
        this.DrawModes = Object.freeze({
            POINTS: gl.POINTS,
            LINES: gl.LINES,
            LINE_STRIP: gl.LINE_STRIP,
            TRIANGLES: gl.TRIANGLES,
            TRIANGLE_STRIP: gl.TRIANGLE_STRIP,
            TRIANGLE_FAN: gl.TRIANGLE_FAN,
        })
        this.drawMode = this.DrawModes.TRIANGLES;
        
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

    setDrawMode(drawMode) {
        if (!drawMode in this.DrawModes) {
            console.error(`${drawMode} is not a valid webgl draw mode.`);
            return;
        }
        this.drawMode = this.DrawModes[drawMode];
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
    draw(mesh, renderType = 'BASIC') {
        let rType;
        if (renderType != null) {
            if (!(renderType in this.RenderType)) {
                console.warn(`Invalid render type '${renderType}'. Defaulting to BASIC.`)
                rType = this.RenderType.BASIC;
            } else {
                rType = this.RenderType[renderType];
            }
        } else {
            rType = this.RenderType.BASIC;
        }

        mesh.renderType = rType;
        this.sceneObjects.push(mesh);
        if (rType === this.RenderType.LIGHT) {
            this.pointLights.push(mesh);
        }
    }

    /** renders objects and lights to the screen. */
    end(dt) {
        const gl = Graphics3D.#gl;
        for (let i = 0; i < this.sceneObjects.length; i++) {
            const mesh = this.sceneObjects[i];
            
            // determine shader
            const shader = this.shaders.get(mesh.renderType);
            shader.use(); // VERY IMPORTANT LINE, this sets the current shader appropriately.

            // set up and bind object VAO
            if (!mesh.VAO) {
                this.#createMeshVAO(shader, mesh);
            }
            gl.bindVertexArray(mesh.VAO);

            // set up shader uniforms && attributes
            const modelMatrix = Matrix4.TRS4(mesh.center, mesh.rotation, mesh.dimensions);
            shader.setMatrix4("model", modelMatrix);
            shader.setMatrix4('view', this.currentCamera.viewMatrix);
            shader.setMatrix4('projection', this.currentCamera.projectionMatrix);

            let shouldUseTextures = false;
            if (mesh.renderType === this.RenderType.PHONG) {
                shader.setColor('ambientColor', this.ambientColor);
                this.#setLightingAttributes(shader);
            } else if (mesh.renderType === this.RenderType.TEXTURE) {
                shader.setColor('ambientColor', this.ambientColor);
                this.#setLightingAttributes(shader);
                shouldUseTextures = true;
            }
            mesh.material.applyToShader(shader, shouldUseTextures); 

            const indexArray = mesh.arrays.index;
            const indexArrayType = Graphics3D.glTypeMap.get(indexArray.dataType);
            const numIndices = indexArray.data.length;

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.index);
            gl.drawElements(this.drawMode, numIndices, indexArrayType, 0);

            // unbind material textures (if exist)
            if (mesh.material) {
                mesh.material.unbindTextures();
            }
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.bindVertexArray(null);
        }
        EventScheduler.update(dt);
    }

    #setLightingAttributes(shader) {
        shader.setInt("numLights", this.pointLights.length);
        for (let i = 0; i < this.pointLights.length; i++) {
            const currentLightName = "pointLights[" + i + "]";
            const currentLight = this.pointLights[i];

            // light colors
            const diffuseColor = currentLight.material.getProperty('diffuseColor')
            shader.setColor(currentLightName + ".diffuseColor", diffuseColor);

            const specularColor = currentLight.material.getProperty('specularColor')
            shader.setColor(currentLightName + ".specularColor", specularColor);
            
            // light attenuation factors
            const attenuation = currentLight.material.getProperty('attenuation');
            shader.setFloat(currentLightName + ".atten_const", attenuation.x);
            shader.setFloat(currentLightName + ".atten_linear", attenuation.y);
            shader.setFloat(currentLightName + ".atten_quad", attenuation.z);

            // light position
            shader.setVector3(currentLightName + ".position", currentLight.center);
        }
    }

    #createBuffer(bufferType, array) {
        const gl = Graphics3D.#gl;

        const glBuffer = gl.createBuffer();
        gl.bindBuffer(bufferType, glBuffer);
        gl.bufferData(bufferType, array, gl.STATIC_DRAW);

        return glBuffer;
    }

    #createAttribute(shader, attribInfo, stride) {
        const gl = Graphics3D.#gl;

        const glAttrType = Graphics3D.glTypeMap.get(attribInfo.dataType);
        const location = gl.getAttribLocation(shader.getProgramID(), attribInfo.name);
        if (location === -1) {
            console.warn(`[Graphics3D] Shader '${shader.getName()}' does not support vertex attribute '${attribInfo.name}'.`)
        } else {
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, attribInfo.size, glAttrType, false, stride, attribInfo.offset);
        }
    }

    #createMeshVAO(shader, mesh) {
        const gl = Graphics3D.#gl;

        if (mesh.arrays.vertex && mesh.arrays.uv) {
            console.log('checking vertex and uv arrays')
            const numPositions = mesh.arrays.vertex.data.length / 3;
            const numUVs = mesh.arrays.uv.data.length / 2;

            if (numPositions !== numUVs) {
                console.warn(`[Graphics3D] Mismatch between number of vertices and UVs! Positions: ${numPositions}, UVs: ${numUVs}. This could be the source of the visual error.`);
            }
        }

        mesh.VAO = gl.createVertexArray();
        gl.bindVertexArray(mesh.VAO);

        mesh.buffers = {};
        for (const name in mesh.arrays) {
            const array = mesh.arrays[name];

            const bufferType = name === 'index' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

            const glBuffer = gl.createBuffer();
            gl.bindBuffer(bufferType, glBuffer);
            gl.bufferData(bufferType, array.data, gl.STATIC_DRAW);
            mesh.buffers[name] = glBuffer;
        }
            
        for (const name in mesh.buffers) {
            if (name === 'index') continue;

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers[name]);

            const array = mesh.arrays[name]
            for (const attr of array.attributes) {
                let attribLocation;
                if (attr.name === 'vertex') attribLocation = ShaderManager.ATTRIB_LOCATION_VERTEX;
                if (attr.name === 'uv') attribLocation = ShaderManager.ATTRIB_LOCATION_UV;
                if (attr.name === 'normal') attribLocation = ShaderManager.ATTRIB_LOCATION_NORMAL;

                const glAttrType = Graphics3D.glTypeMap.get(attr.dataType);
                gl.enableVertexAttribArray(attribLocation);
                gl.vertexAttribPointer(attribLocation, attr.size, glAttrType, false, array.stride, attr.offset);
            }
        }
        console.log(mesh.buffers);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }
}