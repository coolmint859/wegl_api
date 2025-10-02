#version 300 es
precision highp float;
precision mediump int;

in vec3 rayDir;

out vec4 outColor;

struct Background {
    vec3 skyTopColor;
    vec3 skyHorizonColor;
    vec3 groundHorizonColor;
    vec3 groundBottomColor;
    float horizonSize;
    float horizonLine;
};
uniform Background bg;

struct DirectLight {
    vec3 direction;
    vec3 emissiveColor;
    float intensity;
};
uniform DirectLight sun;

vec3 calculateBackground(vec3 fragRay) 
{
    float groundBlendFactor = smoothstep(-1.0, bg.horizonLine, fragRay.y);
    vec3 groundColor = mix(bg.groundBottomColor, bg.groundHorizonColor, groundBlendFactor);

    float skyBlendFactor = smoothstep(bg.horizonLine, 1.0, fragRay.y);
    vec3 skyColor = mix(bg.skyHorizonColor, bg.skyTopColor, skyBlendFactor);

    float horizonLowerBound = bg.horizonLine - bg.horizonSize;
    float horizonHigherBound = bg.horizonLine + bg.horizonSize;

    float horizonBlendFactor = smoothstep(horizonLowerBound, horizonHigherBound, fragRay.y);
    vec3 bgColor = mix(groundColor, skyColor, horizonBlendFactor);

    return bgColor;
}

float calculateSunBlendFactor(vec3 fragRay, vec3 sunDir) {
    float sunRayAlignment = dot(fragRay, sunDir);

    float sunSize = 0.9995;
    float sunDisk = smoothstep(sunSize, 1.0, sunRayAlignment);
    float sunGlow = pow(max(0.0, sunRayAlignment), 10.0 * sun.intensity);

    return sunDisk + sunGlow;
}

void main()
{
    vec3 fragRay = normalize(rayDir);
    vec3 sunDir = normalize(sun.direction);

    vec3 bgColor = calculateBackground(fragRay);
    float sunBlendFactor = calculateSunBlendFactor(fragRay, sunDir);

    vec3 fragColor = mix(bgColor, sun.emissiveColor, sunBlendFactor);

    outColor = vec4(fragColor, 1.0);
}