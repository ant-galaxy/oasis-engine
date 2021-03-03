uniform vec4 u_emissiveColor;
uniform vec4 u_diffuseColor;
uniform vec4 u_specularColor;
uniform float u_shininess;
uniform vec4 u_alphaCutoff;


#ifdef O3_EMISSIVE_TEXTURE

uniform sampler2D u_emissiveTexture;

#endif

#ifdef O3_DIFFUSE_TEXTURE

uniform sampler2D u_diffuseTexture;

#endif

#ifdef O3_SPECULAR_TEXTURE

uniform sampler2D u_specularTexture;

#endif
