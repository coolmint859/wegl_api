#version 300 es
precision lowp float;
precision mediump int;

out vec3 rayDir;

layout(location = 0) in vec3 aPosition;

uniform mat4 uView;
uniform mat4 uProjection;

void main() 
{
    // projection matrix has 1.0/tan(fov/2.0) stored at m[1,1], which is the value we need for the depth
    float viewFOV = -uProjection[1][1];
    vec3 dirClip = vec3(aPosition.xy, viewFOV);

    // adjust x by aspect ratio to prevent squishing along x-axis
    dirClip.x *= uProjection[1][1] / uProjection[0][0];

    rayDir = inverse(mat3(uView)) * dirClip;

    // force quad to be located at the far clip plane,
    // allows other geometry in frustum to always render in front
    gl_Position = vec4(aPosition.xy, 1.0, 1.0);
}