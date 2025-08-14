#version 300 es
precision lowp float;

// used to draw things without shading

layout(location = 0) in vec3 aPosition;

// transformation matrices
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main() 
{
    gl_Position = projection * view * model * vec4(aPosition, 1.0);
}
