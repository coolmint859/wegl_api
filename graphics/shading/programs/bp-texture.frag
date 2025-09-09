#version 300 es
precision lowp float;
precision mediump int;
precision highp sampler2D;

// material
struct Material {
    sampler2D diffuseMap;
    sampler2D specularMap;
    float shininess;
};

// pointlights
struct PointLight {
    vec3 position;
    vec3 emmissiveColor;
    float attenConst;
    float attenLinear;
    float attenQuad;
};

uniform Material material;

uniform PointLight pointLights[5];
uniform vec3 ambientColor;
uniform int numLights;
uniform mat4 view; 

in vec2 vTexCoord;
in vec3 frag_normal;
in vec3 eyeSpace_vector;

out vec4 outColor;

float near = 0.1;
float far = 100.0;

float linearizeDepth(float depth) 
{
    float z = depth * 2.0 - 1.0; // back to NDC 
    return (2.0 * near * far) / (far + near - z * (far - near));	
}

vec3 calculatePointLight(vec3 diffMapColor, vec3 specMapColor, PointLight light, float light_dist, vec3 N, vec3 L, vec3 V) 
{
    // attenuation
    float linear = light_dist * light.attenLinear;
    float quad = light_dist * light_dist * light.attenQuad;
    float atten = 1.0 / (light.attenConst + linear + quad);

    // diffuse
    float diffuse_impact = max(dot(N, L), 0.0);
    vec3 diffuse = diffMapColor * light.emmissiveColor * diffuse_impact;

    // I use blinn-phong for specular instead, I think it looks nicer
    if (material.shininess >= 0.175) {
        vec3 H = normalize(L + V);
        float specular_impact = max(dot(N, H), 0.0);
        vec3 specular = specMapColor * pow(specular_impact, material.shininess * 64.0);
        return (diffuse + specular) * atten;
    } else {
        return diffuse * atten;
    }
}

void main()
{
    float gamma = 2.2; // typical for most displays
    vec4 sRGB_diff = texture(material.diffuseMap, vTexCoord);
    vec4 sRGB_spec = texture(material.specularMap, vTexCoord);
    vec3 diffMapColor = pow(sRGB_diff.rgb, vec3(gamma));
    vec3 specMapColor = pow(sRGB_spec.rgb, vec3(gamma));

    // outColor = vec4(material.shininess, material.shininess, material.shininess, 1.0);

    vec3 N = normalize(frag_normal);
    vec3 V = normalize(-eyeSpace_vector);
    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < numLights; i++) 
    {
        PointLight light = pointLights[i];
        vec4 lightPos = vec4(light.position, 1.0);

        vec3 light_vector = (view * lightPos).xyz - eyeSpace_vector;
        vec3 L = normalize(light_vector);
        float light_dist = length(light_vector);

        fragColor += calculatePointLight(diffMapColor, specMapColor, light, light_dist, N, L, V);
    }
    fragColor += diffMapColor * ambientColor;

    // float depth = linearizeDepth(gl_FragCoord.z) / far;
    // outColor = vec4(vec3(1.0-depth), 1.0);

    outColor = vec4(pow(fragColor, vec3(1.0/gamma)), 1.0);

    // outColor = vec4(N, 1.0);
}
