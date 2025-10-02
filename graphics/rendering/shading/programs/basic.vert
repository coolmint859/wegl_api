#version 300 es
precision lowp float;
precision mediump int;

// used to draw things without shading

layout(location = 0) in vec3 aPosition;

// transformation matrices
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

void main() 
{
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}
