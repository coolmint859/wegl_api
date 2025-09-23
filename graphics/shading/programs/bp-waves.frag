#version 300 es
precision lowp float;
precision mediump int;

in vec3 frag_normal;
in vec3 eyeSpace_vector;

// output color
out vec4 outColor;

// material
struct Material {
    vec3 diffuseColor;
    vec3 specularColor;
    float shininess;
};
uniform Material material;

// pointlights
struct PointLight {
    vec3 position;
    vec3 emissiveColor;
    float attenConst;
    float attenLinear;
    float attenQuad;
};
uniform PointLight pointLights[5];
uniform int numPointLights;

uniform vec3 ambientColor;
uniform mat4 uView; 

vec3 calculatePointLight(PointLight light, float light_dist, vec3 N, vec3 L, vec3 V) 
{
    // attenuation
    float linear = light_dist * light.attenLinear;
    float quad = light_dist * light_dist * light.attenQuad;
    float atten = 1.0 / (light.attenConst + linear + quad);

    // diffuse
    float diffuse_impact = max(dot(N, L), 0.0);
    vec3 diffuse = material.diffuseColor * light.emissiveColor * diffuse_impact;

    // I use blinn-phong for specular instead, I think it looks nicer
    if (material.shininess >= 0.175) {
        vec3 H = normalize(L + V);
        float specular_impact = max(dot(N, H), 0.0);
        vec3 specular = material.specularColor * pow(specular_impact, material.shininess * 64.0);

        return (diffuse + specular) * atten;
    } else {
        return diffuse * atten;
    }
}

void main()
{
    vec3 N = normalize(frag_normal);
    vec3 V = normalize(-eyeSpace_vector);

    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < numPointLights; i++) 
    {
        PointLight light = pointLights[i];
        vec4 lightPos = vec4(light.position, 1.0);

        vec3 light_vector = (uView * lightPos).xyz - eyeSpace_vector;
        vec3 L = normalize(light_vector);
        float light_dist = length(light_vector);

        fragColor += calculatePointLight(light, light_dist, N, L, V);
    }
    fragColor += material.diffuseColor * ambientColor;

    // // visualize depth
    // float near = 0.1; float far = 100.0;
    // float depth = near / (far - gl_FragCoord.z * (far - near));
    // outColor = vec4(vec3(1.0-depth), 1.0);
    
    outColor = vec4(fragColor, 1.0);
    
    // outColor = vec4(N, 1.0);
}
