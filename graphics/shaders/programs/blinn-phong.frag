#version 300 es
precision lowp float;
precision mediump int;

in vec3 vNormal;
in vec3 vViewVector;

out vec4 outColor;

struct Material {
    vec3 diffuseColor;
    vec3 specularColor;
    float shininess;
};
uniform Material material;

struct PointLight {
    vec3 position;
    vec3 emissiveColor;
    float attenConst;
    float attenLinear;
    float attenQuad;
};
uniform PointLight pointLights[5];
uniform int numPointLights;

struct DirectLight {
    vec3 direction;
    vec3 emissiveColor;
    float intensity;
};
uniform DirectLight sun;

uniform vec3 ambientColor;
uniform mat4 uView;

float calculateAttenuation(float attenConst, float attenLinear, float attenQuad, float lightDist) {
    float linear = lightDist * attenLinear;
    float quad = lightDist * lightDist * attenQuad;

    return 1.0 / (attenConst + linear + quad);
} 

vec3 calculateLight(vec3 lightColor, vec3 N, vec3 L, vec3 V, float atten) {
    float diffuse_impact = max(dot(N, L), 0.0);
    vec3 diffuse = lightColor * material.diffuseColor * diffuse_impact;

    if (material.shininess >= 0.175) {
        vec3 H = normalize(L + V);
        float specular_impact = max(dot(N, H), 0.0);
        vec3 specular = material.specularColor * pow(specular_impact, material.shininess * 64.0);

        return (diffuse + specular) * atten;
    }
    return diffuse * atten;
}

vec3 calculatePointLight(PointLight light, vec3 N, vec3 V)
{
    vec3 lightPos = (uView * vec4(light.position, 1.0)).xyz;
    vec3 lightVector = lightPos - vViewVector;

    vec3 L = normalize(lightVector);
    float lightDist = length(lightVector);
    float atten = calculateAttenuation(light.attenConst, light.attenLinear, light.attenQuad, lightDist);

    return calculateLight(light.emissiveColor, N, L, V, atten);
}

vec3 calculateDirectLight(DirectLight light, vec3 N, vec3 V) 
{
    if (light.direction == vec3(0.0)) return vec3(0.0);
    
    vec3 lightDir = (uView * vec4(light.direction, 0.0)).xyz;
    vec3 L = normalize(lightDir);

    return calculateLight(light.emissiveColor, N, L, V, 1.0);
}

void main()
{
    vec3 N = normalize(vNormal);        // N is fragment normal in view space
    vec3 V = normalize(-vViewVector);   // V is direction from fragment to camera in view space

    vec3 fragColor = vec3(0.0);

    // direction lights
    fragColor += calculateDirectLight(sun, N, V);

    // point lights
    for (int i = 0; i < numPointLights; i++) 
    {
        fragColor += calculatePointLight(pointLights[i], N, V);
    }

    fragColor += material.diffuseColor * ambientColor;

    // // visualize depth
    // float near = 0.1; float far = 100.0;
    // float depth = near / (far - gl_FragCoord.z * (far - near));
    // outColor = vec4(vec3(1.0-depth), 1.0);
    
    outColor = vec4(fragColor, 1.0);
}
