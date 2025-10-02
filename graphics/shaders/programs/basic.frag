#version 300 es
precision lowp float;
precision mediump int;

// used to draw things without shading

out vec4 outColor;

uniform vec3 baseColor;

void main()
{
    // // visualize depth
    // float near = 0.1; float far = 100.0;
    // float depth = near / (far - gl_FragCoord.z * (far - near));
    // outColor = vec4(vec3(1.0-depth), 1.0);

    outColor = vec4(baseColor, 1.0);
}
