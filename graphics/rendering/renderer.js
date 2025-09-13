import FPSCamera from "../cameras/FPSCamera.js";
import Shader from "../shading/shader.js";
import Color from "../utilities/containers/color.js";
import { Matrix4 } from "../utilities/math/matrix.js";
import EventScheduler from "../utilities/scheduler.js";
import Camera from "../cameras/camera.js";
import ShaderManager from "../shading/shader_manager.js";
import Light from "../lighting/light.js";
import TextureManager from "../material/texture-manager.js";

/**
 * Core real-time 3D application renderer. 
 */
export default class Graphics3D {
    static #canvas = document.getElementById("canvas-main");
    static #gl = Graphics3D.#canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: false });

    static RenderType = Object.freeze({
        PHONG: 'blinn-phong',
        BASIC: 'basic',
        LIGHT: 'light',
        TEXTURE: 'bp-texture',
        WAVES: 'bp-waves'
    });
    static RenderMode = Object.freeze({
        POINTS: Graphics3D.#gl.POINTS,
        LINES: Graphics3D.#gl.LINES,
        LINE_STRIP: Graphics3D.#gl.LINE_STRIP,
        TRIANGLES: Graphics3D.#gl.TRIANGLES,
        TRIANGLE_STRIP: Graphics3D.#gl.TRIANGLE_STRIP,
        TRIANGLE_FAN: Graphics3D.#gl.TRIANGLE_FAN,
    })

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

        // enable depth testing
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.DEPTH_TEST);

        this.aspectRatio = height / width;

        this.sceneObjects = [];
        this.lights = [];
        this.waves = [];
        this.shaders = new Map();

        this.renderMode = Graphics3D.RenderMode.TRIANGLES;
        
        this.scenes = new Map();

        // setup camera information
        this.cameras = new Map();
        this.cameras.set('default', new FPSCamera());
        this.currentCamera = this.cameras.get('default');
        this.currentCamera.initMouseControls(canvas);

        this.ambientColor = Color.BLACK;
        this.clearColor = Color.CF_BLUE;

        TextureManager.init(gl);
        ShaderManager.init();
    }

    /** Returns the current WebGl context. */
    static getGLContext() {
        return Graphics3D.#gl;
    }

    /** sets the width/height of the viewport */
    setViewport(width, height) {
        const canvas = Graphics3D.#canvas;
        canvas.width = width;
        canvas.height = height;
        this.aspectRatio = width/height;
        Graphics3D.#gl.viewport(0, 0, canvas.width, canvas.height);
    }

    setRenderMode(renderMode) {
        if (!Object.values(Graphics3D.RenderMode).includes(renderMode)) {
            console.error(`${renderMode} is not a valid webgl draw mode.`);
            return;
        }
        this.renderMode = renderMode;
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

        // reset scene objects to be empty
        this.sceneObjects = [];
        this.lights = [];

        // set background color
        gl.clearColor(this.clearColor.r, this.clearColor.g, this.clearColor.b, this.clearColor.a);
        gl.clearDepth(1.0);

        // clear the screen & depth buffer
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    /** draws an object */
    draw(object) {
        if (object instanceof Light) {
            this.lights.push(object);

            // if debug enabled, we should render the light's debug model
            if (!object.debugEnabled) return;
            this.sceneObjects.push(object.debugModel);
        } else {
            if (object.renderType === null || !Object.values(Graphics3D.RenderType).includes(object.renderType)) {
                object.renderType = Graphics3D.RenderType.BASIC;
            }

            this.sceneObjects.push(object);
        }
    }

    /** renders objects and lights to the screen. */
    end(dt, totalTime) {
        if (!ShaderManager.isReady) return;
        for (let i = 0; i < this.sceneObjects.length; i++) {
            const mesh = this.sceneObjects[i];
            // if (!mesh.isReady) continue;
            
            // const bestFitShader = ShaderManager.bestFitShader(mesh.capabilities);
            const shader = ShaderManager.getShaderProgram(mesh.currentShader);
            if (!shader || !shader.isReady) return;
            // console.log(shader.name);
            // console.log(shader.isReady);
            shader.use();

            this.#renderMesh(mesh, shader, dt, totalTime);

            shader.unuse();
        }
        EventScheduler.update(dt);
    }

    #renderMesh(mesh, shader, dt, totalTime) {
        const gl = Graphics3D.#gl;

        if (!mesh.VAO) {
            mesh.VAO = this.#createMeshVAO(mesh);
        }
        gl.bindVertexArray(mesh.VAO);

        // set up shader uniforms && attributes
        shader.setUniform("uModel", mesh.transform.worldMatrix);
        shader.setUniform('uView', this.currentCamera.viewMatrix);
        shader.setUniform('uProjection', this.currentCamera.projectionMatrix);

        this.#setShaderUniforms(shader, mesh.renderType, totalTime);
        // mesh.applyToShader(shader);
        mesh.material.applyToShader(shader); 

        const indexArray = mesh.arrays.index;
        const indexArrayType = Graphics3D.glTypeMap.get(indexArray.dataType);
        const numIndices = indexArray.data.length;

        shader.flush();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.index);
        gl.drawElements(this.renderMode, numIndices, indexArrayType, 0);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    #setShaderUniforms(shader, renderType, totalTime) {
        function setLightingAttribs(lights, shader) {
            shader.setUniform("numPointLights", self.lights.length);
            for (let i = 0; i < lights.length; i++) {
                lights[i].applyToShader(shader, i);
            }
        }

        switch (renderType) {
            case Graphics3D.RenderType.PHONG:
                shader.setUniform('ambientColor', this.ambientColor);
                setLightingAttribs(this.lights, shader);
                break;
            case Graphics3D.RenderType.TEXTURE:
                shader.setUniform('ambientColor', this.ambientColor);
                setLightingAttribs(this.lights, shader);
                break;
            case Graphics3D.RenderType.WAVES:
                shader.setUniform('ambientColor', this.ambientColor);
                shader.setUniform('totalTime', totalTime);
                setLightingAttribs(this.lights, shader);
                break;
            default:
                break; // nothing for basic shader
        }
    }

    #createMeshVAO(mesh) {
        const gl = Graphics3D.#gl;

        const VAO = gl.createVertexArray();
        gl.bindVertexArray(VAO);

        mesh.buffers = {};
        for (const name in mesh.arrays) {
            if (name === 'buffers') continue;

            const array = mesh.arrays[name];
            const bufferType = name === 'index' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

            const glBuffer = gl.createBuffer();
            gl.bindBuffer(bufferType, glBuffer);
            gl.bufferData(bufferType, array.data, gl.STATIC_DRAW);
            mesh.buffers[name] = glBuffer;

            for (const attr of array.attributes) {
                let attribLocation;
                if (attr.name === 'vertex') attribLocation = ShaderManager.ATTRIB_LOCATION_VERTEX;
                if (attr.name === 'normal') attribLocation = ShaderManager.ATTRIB_LOCATION_NORMAL;
                if (attr.name === 'uv') attribLocation = ShaderManager.ATTRIB_LOCATION_UV;

                const glAttrType = Graphics3D.glTypeMap.get(attr.dataType);
                gl.enableVertexAttribArray(attribLocation);
                gl.vertexAttribPointer(attribLocation, attr.size, glAttrType, false, array.stride, attr.offset);
            }
        }

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        return VAO;
    }
}