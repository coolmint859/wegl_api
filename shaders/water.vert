#version 300 es
precision lowp float;
precision mediump int;

// vertex attributes
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

struct Wave {
    vec2 direction;
    float wavelength;
    float angularFreq;
    float amplitude;
    float phase;
};

uniform int numWaves;
uniform Wave waves[100];

// transformation matrices
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform float totalTime;

out vec3 frag_normal;
out vec3 eyeSpace_vector;

float expoSine(float angle, float amplitude) {
    const float e = 2.71828;
    return pow(e, amplitude * sin(angle));
}

float expoSineDeriv(float angle, float amplitude) {
    return -amplitude * cos(angle) * expoSine(angle, amplitude);
}

void main()
{
    vec2 p = vec2(aPosition.x, aPosition.z);

    vec3 position = aPosition; 
    vec3 normal = vec3(0.0, 0.0, 0.0);
    for (int i = 0; i < numWaves && i < waves.length(); i++) {
        Wave wave = waves[i];

        // 'push' vertex position by derivative of previous position
        // gives illusion that waves are pushing other waves
        p.x += normal.x;
        p.y += normal.z;

        float angle = dot(wave.direction, p) * 1.0/wave.wavelength - wave.angularFreq*totalTime + wave.phase;
        position.y += aPosition.y + expoSine(angle, wave.amplitude) - 1.0;
        
        float d = expoSineDeriv(angle, wave.amplitude);
        normal += vec3(d * wave.direction.x, 1.0, d * wave.direction.y);
    }

    if (numWaves == 0) {
        normal = aNormal;
    }

    mat4 modelView = view * model;
    gl_Position = projection * modelView * vec4(position, 1.0);

    mat4 modelViewInverseTranspose = transpose(inverse(modelView));
    frag_normal = normalize(mat3(modelViewInverseTranspose) * normal);

    vec4 eyeSpace_vertex = modelView * vec4(aPosition, 1.0);
    eyeSpace_vector = eyeSpace_vertex.xyz;
}