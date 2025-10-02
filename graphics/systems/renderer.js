import TextureHandler from "./handlers/texture-handler.js";
import GeometryHandler from "./handlers/geometry-handler.js";
import ShaderHandler from "./handlers/shader-handler.js";
import Scene from "./scene.js";
import { Camera } from "../entities/index.js";
import { Color } from "../utilities/index.js";

/**
 * Renders scenes on an HTMLCanvasElement
 */
export default class Renderer {
    #canvas;
    #gl;

    #prevWidth;
    #prevHeight;

    #clearColor;

    static glTypeMap;

    /**
     * Create a new Renderer instance
     * @param {HTMLCanvasElement} canvas the canvas element to render to.
     * @param {number} width the width of the render target
     * @param {number} height the height of the render target
     * @param {object} contextOptions options for setting up the WebGL rendering context
     */
    constructor(canvas, width, height, contextOptions={}) {
        this.#canvas = canvas;
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#prevWidth = width;
        this.#prevHeight = height;

        const gl = this.#canvas.getContext('webgl2', contextOptions);
        this.#gl = gl;

        console.log(`[Renderer] Created new WebGL context for canvas '${canvas.id}': ${this.#gl.constructor.name}`);

        Renderer.glTypeMap = new Map([
            ['char', gl.BYTE], ['uchar', gl.UNSIGNED_BYTE],
            ['int8', gl.BYTE], ['uint8', gl.UNSIGNED_BYTE],
            ['short', gl.SHORT], ['ushort', gl.UNSIGNED_SHORT],
            ['int16', gl.SHORT], ['uint16', gl.UNSIGNED_SHORT],
            ['int', gl.INT], ['uint', gl.UNSIGNED_INT],
            ['int32', gl.INT], ['uint32', gl.UNSIGNED_INT],
            ['float', gl.FLOAT], ['float32', gl.FLOAT],
        ])

        gl.viewport(0, 0, width, height);

        // enable back-face culling
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);
        gl.cullFace(gl.BACK);

        // enable depth testing
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.DEPTH_TEST);

        this.#clearColor = Color.BLACK;
        gl.clearColor(this.#clearColor.r, this.#clearColor.g, this.#clearColor.b, this.#clearColor.a);

        ShaderHandler.init(gl);
        TextureHandler.init(gl);
        GeometryHandler.init(gl);
    }

    /**
     * Update the size of the viewport for the rendering context
     * @param {number} width the width of the viewport
     * @param {number} height the height of the viewport
     */
    updateViewport(width, height) {
        if (this.#prevWidth !== width || this.#prevHeight !== height) {
            this.#canvas.width = width;
            this.#canvas.height = height;
            this.#gl.viewport(0, 0, width, height);
        }
    }

    /** 
     * Set the clear color for the rendering context.
     * @param {Color} color the color to set the clear color as
     * */
    set clearColor(color) {
        if (!(color instanceof Color)) {
            console.error(`Expected 'color' to be an instance of Color. Cannot set clear color.`);
            return;
        }
        this.#clearColor = color;
        this.#gl.clearColor(this.#clearColor.r, this.#clearColor.g, this.#clearColor.b, this.#clearColor.a);
    }

    /**
     * Renders the provided scene onto this renderer's canvas using the provided camera. Designed to be called every frame.
     * @param {Scene} scene the scene to render
     * @param {Camera} camera the camera to render the scene with
     */
    render(scene, camera) {
        if (!(scene instanceof Scene)) {
            console.error(`[Renderer] Expected 'scene' to be an instance of Scene. Cannot render scene.`);
            return;
        }
        if (!(camera instanceof Camera)) {
            console.error(`[Renderer] Expected 'camera' to be an instance of Camera. Cannot render scene.`);
            return;
        }

        if (!ShaderHandler.isReady) return;

        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT);

        for (const model of scene.renderables) {
            // skip models if they aren't ready to be rendered (dependent data isn't yet loaded)
            if (!model.isReady()) continue;

            const shaderName = model.currentShader;
            const shader = ShaderHandler.getShaderProgram(shaderName);
            if (!shader || !shader.isReady) return;

            shader.use();

            // If a mesh doesn't yet have a VAO for the shader, create one before rendering.
            if (!model.hasVAOfor(shader.name)) {
                model.generateVAOfor(shader);
            }

            camera.applyToShader(shader);

            scene.applyGlobalUniforms(shader);
            scene.applyLights(shader);

            this.#renderMesh(model, shader);

            shader.unuse();
        }
    }

    /**
     * renders a specific mesh to the screen with the given shader
     * @param {Mesh} mesh the mesh to render
     * @param {ShaderProgram} shader the shader to render the mesh with
     */
    #renderMesh(mesh, shader) {
        const gl = this.#gl;

        const meshData = mesh.getDataFor(shader.name);
        gl.bindVertexArray(meshData.VAO);

        mesh.applyToShader(shader);

        const indexArray = mesh.toggles.wireframe ? meshData.geometry.idxLines :  meshData.geometry.idxTriangles;
        const indexArrayType = Renderer.glTypeMap.get(indexArray.dataType);
        const numIndices = indexArray.data.length;

        shader.flush();

        const indexBuffer = mesh.toggles.wireframe ? meshData.buffers.idxLines : meshData.buffers.idxTriangles;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        
        gl.drawElements(gl.TRIANGLES, numIndices, indexArrayType, 0);

        shader.reset();
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }
}
