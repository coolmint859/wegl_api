#version 300 es
precision lowp float;
precision mediump int;

// vertex attributes
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

// pointlights
struct PointLight {
    vec3 position;
    vec3 emissiveColor;
    float attenConst;
    float attenLinear;
    float attenQuad;
};
uniform PointLight pointLights[5];
uniform mediump int numLights;

// transformation matrices
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

out vec3 frag_normal;
out vec3 view_dir;
out vec3 light_vectors[5];

void main()
{
    // vertex model to projected position
    mat4 modelView = view * model;
    vec4 eyeSpace_vertex = modelView * vec4(aPosition, 1.0);
    gl_Position = projection * eyeSpace_vertex;
    
    // pipeline interpolates the vertex normal
    mat4 modelViewInverseTranspose = transpose(inverse(modelView));
    frag_normal = normalize(mat3(modelViewInverseTranspose) * aNormal);

    for (int i = 0; i < numLights; i++) {
        vec4 light_pos = vec4(pointLights[i].position, 1.0);
        light_vectors[i] = vec3((view * light_pos).xyz - eyeSpace_vertex.xyz);
    }

    view_dir = -eyeSpace_vertex.xyz;
}