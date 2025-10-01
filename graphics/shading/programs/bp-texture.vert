#version 300 es
precision highp float;
precision mediump int;

// vertex attributes
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;

out vec3 vNormal;
out vec3 vViewVector;
out vec2 vTexCoord;

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

    vViewVector = viewSpacePos.xyz;
    vTexCoord = aTexCoord;
}