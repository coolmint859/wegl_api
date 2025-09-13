#version 300 es
precision lowp float;
precision mediump int;

// used to draw things without shading

out vec4 outColor;

struct Material {
    vec3 diffuseColor;
};
uniform Material material;

float linearizeDepth(float depth) 
{
    float near = 0.1; float far = 100.0;
    float z = depth * 2.0 - 1.0; // back to NDC 
    return (2.0 * near * far) / (far + near - z * (far - near));	
}

void main()
{
    // float depth = linearizeDepth(gl_FragCoord.z) / far;
    // outColor = vec4(vec3(1.0-depth), 1.0);

    outColor = vec4(material.diffuseColor, 1.0);
}
