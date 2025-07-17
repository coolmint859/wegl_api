#version 300 es
precision mediump float;

// vertex attributes
in vec3 aPosition;
in vec3 vertex_normal;
in vec2 aTexCoord;

// transformation matrices
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

out vec3 frag_normal;
out vec3 eyeSpace_vector;
out vec2 vTexCoord;

void main()
{
    // vertex model to projected position
    mat4 modelView = view * model;
    vec4 eyeSpace_vertex = modelView * vec4(aPosition, 1.0);
    gl_Position = projection * eyeSpace_vertex;
    
    // pipeline interpolates the vertex normal
    mat4 modelViewInverseTranspose = transpose(inverse(modelView));
    frag_normal = normalize(mat3(modelViewInverseTranspose) * vertex_normal);

    eyeSpace_vector = eyeSpace_vertex.xyz;
    
    vTexCoord = aTexCoord;
}