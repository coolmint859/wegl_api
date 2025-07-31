#version 300 es
precision lowp float;

// material
struct Material {
    vec3 diffuseColor;
    vec3 specularColor;
    float shininess;
};

// pointlights
struct PointLight {
    vec3 position;
    vec3 diffuseColor;
    vec3 specularColor;
    float atten_const;
    float atten_linear;
    float atten_quad;
};

uniform Material material;

uniform PointLight pointLights[5];
uniform vec3 ambientColor;
uniform int numLights;
uniform mat4 view; 

in vec3 frag_normal;
in vec3 eyeSpace_vector;

// output color
out vec4 outColor;

float near = 0.1;
float far = 100.0;

float linearizeDepth(float depth) 
{
    float z = depth * 2.0 - 1.0; // back to NDC 
    return (2.0 * near * far) / (far + near - z * (far - near));	
}

vec3 calculatePointLight(PointLight light, float light_dist, vec3 N, vec3 L, vec3 V) 
{
    // attenuation
    float linear = light_dist * light.atten_linear;
    float quad = light_dist * light_dist * light.atten_quad;
    float atten = 1.0 / (light.atten_const + linear + quad);

    // diffuse
    float diffuse_impact = max(dot(N, L), 0.0);
    vec3 diffuse = material.diffuseColor * light.diffuseColor * diffuse_impact;

    // I use blinn-phong for specular instead, I think it looks nicer
    if (material.shininess >= 0.175) {
        vec3 H = normalize(L + V);
        float specular_impact = max(dot(N, H), 0.0);
        vec3 specular = material.specularColor * light.specularColor * pow(specular_impact, material.shininess * 64.0);

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
    for (int i = 0; i < numLights; i++) 
    {
        PointLight light = pointLights[i];
        vec4 lightPos = vec4(light.position, 1.0);

        vec3 light_vector = (view * lightPos).xyz - eyeSpace_vector;
        vec3 L = normalize(light_vector);
        float light_dist = length(light_vector);

        fragColor += calculatePointLight(light, light_dist, N, L, V);
    }
    fragColor += material.diffuseColor * ambientColor;

    // float depth = linearizeDepth(gl_FragCoord.z) / far;
    // outColor = vec4(vec3(1.0-depth), 1.0);
    
    outColor = vec4(fragColor, 1.0);
}
