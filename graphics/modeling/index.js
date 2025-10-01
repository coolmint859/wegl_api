export { 
    tessellate, 
    triangulate, 
    createRegularPolyhedron, 
    generateNormals, 
    normalizeVertices
} from './geometry/geometry-utils.js';

export {
    generateTetrahedron,
    generateCube,
    generateOctahedron,
    generateDodecahedron,
    generateIcosahedron
} from './geometry/procedural/platonic-solids.js';

export {
    generateCone,
    generateCylinder,
    generateSphere
} from './geometry/procedural/radial-geometry.js';

export {
    generateRegularPolygon,
    generatePlane
} from './geometry/procedural/planar-geometry.js';

export {
    generatePyramid
} from './geometry/procedural/misc-geometry.js';

export { default as Geometry } from './geometry/geometry.js';
export { default as GeometryLoader } from './geometry/geometry-loader.js';
export { default as GeometryHandler } from './geometry/geometry-handler.js';

export { default as Material } from './materials/material.js';
export {
    BasicMaterial, BlinnPhongMaterial
} from './materials/default-materials.js';

export { default as Mesh } from './mesh.js';
export { default as Transform } from './transform.js';
