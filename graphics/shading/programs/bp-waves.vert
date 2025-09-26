#version 300 es
precision lowp float;
precision mediump int;

// vertex attributes
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

out vec3 vNormal;
out vec3 vViewDir;

struct Wave {
    vec2 direction;
    float wavelength;
    float angularFreq;
    float amplitude;
    float phase;
};
uniform Wave waves[100];
uniform int numWaves;

// transformation matrices
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

uniform float totalTime;

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

    // vertex model to projected position
    mat4 modelView = uView * uModel;
    vec4 eyeSpace_vertex = modelView * vec4(position, 1.0);
    gl_Position = uProjection * eyeSpace_vertex;
    
    // pipeline interpolates the vertex normal
    mat3 normalMatrix = transpose(inverse(mat3(modelView)));
    vNormal = normalize(normalMatrix * normal);

    vViewDir = -eyeSpace_vertex.xyz;
}