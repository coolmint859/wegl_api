#version 300 es
precision lowp float;
precision mediump int;

// vertex attributes
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;

out vec3 vNormal;
out vec3 vViewDir;
out vec2 vTexCoord;

// transformation matrices
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

void main()
{
    // vertex model to projected position
    mat4 modelView = uView * uModel;
    vec4 eyeSpace_vertex = modelView * vec4(aPosition, 1.0);
    gl_Position = uProjection * eyeSpace_vertex;
    
    // pipeline interpolates the vertex normal
    mat4 modelViewInverseTranspose = transpose(inverse(modelView));
    vNormal = normalize(mat3(modelViewInverseTranspose) * aNormal);

    vViewDir = -eyeSpace_vertex.xyz;
    
    vTexCoord = aTexCoord;
}