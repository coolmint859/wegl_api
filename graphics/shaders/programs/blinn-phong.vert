#version 300 es
precision lowp float;
precision mediump int;

// vertex attributes
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

out vec3 vNormal;
out vec3 vViewVector;

// transformation matrices
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

void main()
{
    mat4 modelView = uView * uModel;
    vec4 viewSpacePos = modelView * vec4(aPosition, 1.0);
    gl_Position = uProjection * viewSpacePos;
    
    mat3 normalMatrix = transpose(inverse(mat3(modelView)));
    vNormal = normalize(normalMatrix * aNormal);

    // vector from origin to fragment in view space
    vViewVector = viewSpacePos.xyz;
}