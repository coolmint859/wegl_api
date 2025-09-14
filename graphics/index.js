/**
 * Default exports for everything graphics
 */

// ----- math and utilities ----- //
export { default as ResourceCollector  } from "./utilities/containers/collector.js";
export { default as Color  } from "./utilities/containers/color.js";
export { default as Transform  } from "./utilities/containers/transform.js";
export { default as StreamReader  } from "./utilities/file-parsing/stream-reader.js";
export { default as Parser  } from "./utilities/file-parsing/base-parser.js";
export { default as GLSLParser  } from "./utilities/file-parsing/glsl-parser.js";
export { default as JSONParser  } from "./utilities/file-parsing/json-parser.js";
export { default as PLYParser  } from "./utilities/file-parsing/ply-parser.js";
export { Matrix2, Matrix3, Matrix4 } from "./utilities/math/matrix.js";
export { Vector2, Vector3, Vector4 } from "./utilities/math/vector.js";
export { default as Quaternion  } from "./utilities/math/quaternion.js";
export { default as KeyboardInput  } from "./utilities/keyboard.js";
export { default as Scheduler  } from "./utilities/scheduler.js";

// ----- animations ----- //
export {
    // utility functions
    EasingFunc, mapRange, clamp,
    // interpolation functions
    interpolate, lerp, smoothstep, smootherstep, ease_in, ease_out, ease_inout,
} from "./utilities/math/blend.js";

// ----- cameras and controls ----- //
export { default as Camera          } from "./cameras/camera.js";
export { default as FPSCamera       } from "./cameras/FPSCamera.js";
export { default as MoveableCamera  } from "./cameras/mCamera.js";

// ----- components ---- //
export { default as Component       } from "./components/component.js";
export { default as BoolComponent   } from "./components/boolean-component.js";
export { default as FloatComponent  } from "./components/float-component.js";
export { default as ColorComponent  } from "./components/color-component.js";
export { default as IntComponent    } from "./components/int-component.js";
export { default as Mat2Component   } from "./components/matrix2-component.js";
export { default as Mat3Component   } from "./components/matrix3-component.js";
export { default as Mat4Component   } from "./components/matrix4-component.js";
export { default as QuatComponent   } from "./components/quaternion-component.js";
export { default as Vec2Component   } from "./components/vector2-component.js";
export { default as Vec3Component   } from "./components/vector3-component.js";
export { default as Vec4Component   } from "./components/vector4-component.js";

// ----- models, materials, textures ----- //
export { default as TextureManager  } from "./modeling/texture-manager.js";
export { default as Material        } from "./modeling/material.js";
export { default as Mesh            } from "./modeling/mesh.js";
export { default as Texture         } from "./modeling/texture.js";


// ----- 2D/3D primitive shapes ----- //
export {
    // platonic solids
    generateTetrahedron, generateRectPrism, generateOctahedron, generateDodecahedron, generateIcosahedron,
    // other regular shapes
    generateCone, generateCylinder, generatePlane, generatePyramid, generateRegularPolygon,
    // utility functions
    generateNormals, normalizeVertices, triangulate, tessellate
} from "./modeling/polyhedra.js";

// ----- rendering and scenes ----- //
export { default as Graphics3D      } from "./rendering/renderer.js";


// ----- shading and gpu programs ----- //
export { default as ShaderMapGenerator  } from "./shading/shader-map-gen.js";
export { default as ShaderProgram   } from "./shading/shader-program.js";
export { default as ShaderValidator } from "./shading/shader-validator.js";
export { default as ShaderManager   } from "./shading/shader-manager.js";
