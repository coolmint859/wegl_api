#version 300 es
precision lowp float;
precision mediump int;

in vec3 frag_normal;
in vec3 view_dir;

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
    vec3 diffuse = light.emissiveColor * material.diffuseColor * diffuse_impact;

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
    vec3 V = normalize(view_dir);

    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < numPointLights; i++) 
    {
        vec4 light_pos = vec4(pointLights[i].position, 1.0);
        vec3 light_dir = vec3((uView * light_pos).xyz + view_dir.xyz);
        vec3 L = normalize(light_dir);
        float light_dist = length(light_dir);

        fragColor += calculatePointLight(pointLights[i], light_dist, N, L, V);
    }
    fragColor += material.diffuseColor * ambientColor;


    // // visualize depth
    // float near = 0.1; float far = 100.0;
    // float depth = near / (far - gl_FragCoord.z * (far - near));
    // outColor = vec4(vec3(1.0-depth), 1.0);
    
    // outColor = vec4(pointLights[0].emissiveColor, 1.0);
    outColor = vec4(fragColor, 1.0);
}
