#version 300 es
precision lowp float;

// used to draw things without shading

uniform vec3 baseColor;

out vec4 outColor;

float near = 0.1;
float far = 100.0;

float linearizeDepth(float depth) 
{
    float z = depth * 2.0 - 1.0; // back to NDC 
    return (2.0 * near * far) / (far + near - z * (far - near));	
}

void main()
{
    // float depth = linearizeDepth(gl_FragCoord.z) / far;
    // outColor = vec4(vec3(1.0-depth), 1.0);

    outColor = vec4(baseColor, 1.0);
}
