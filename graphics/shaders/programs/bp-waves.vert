#version 300 es
precision lowp float;
precision mediump int;

#define E 2.71828

// vertex attributes
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

out vec3 vNormal;
out vec3 vViewVector;

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

float expoSine(float angle, float amplitude) 
{
    return pow(E, amplitude * sin(angle));
}

float expoSineDeriv(float angle, float amplitude) 
{
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

    mat4 modelView = uView * uModel;
    vec4 viewSpacePos = modelView * vec4(position, 1.0);
    gl_Position = uProjection * viewSpacePos;
    
    mat3 normalMatrix = transpose(inverse(mat3(modelView)));
    vNormal = normalize(normalMatrix * normal);

    vViewVector = viewSpacePos.xyz;
}