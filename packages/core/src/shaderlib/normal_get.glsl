vec3 getNormal(){
    vec3 normal = vec3(0, 0, 1);

    #ifdef O3_HAS_NORMAL
         normal = normalize(v_normal);
    #elif defined(HAS_DERIVATIVES)
        vec3 pos_dx = dFdx(v_pos);
        vec3 pos_dy = dFdy(v_pos);
        normal = normalize( cross(pos_dx, pos_dy) );
    #endif

    normal *= float( gl_FrontFacing ) * 2.0 - 1.0;
    return normal;
}

vec3 getNormal(sampler2D normalTexture, float normalIntensity)
{
    
    #if defined(O3_HAS_NORMAL) && defined(O3_HAS_TANGENT) && defined( O3_NORMAL_TEXTURE )
        mat3 tbn = v_TBN;
    #else
        #ifdef HAS_DERIVATIVES
            vec3 pos_dx = dFdx(v_pos);
            vec3 pos_dy = dFdy(v_pos);
            vec3 tex_dx = dFdx(vec3(v_uv, 0.0));
            vec3 tex_dy = dFdy(vec3(v_uv, 0.0));
            vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);
            #ifdef O3_HAS_NORMAL
                vec3 ng = normalize(v_normal);
            #else
                vec3 ng = normalize( cross(pos_dx, pos_dy) );
            #endif
            t = normalize(t - ng * dot(ng, t));
            vec3 b = normalize(cross(ng, t));
            mat3 tbn = mat3(t, b, ng);
        #else
            #ifdef O3_HAS_NORMAL
                vec3 ng = normalize(v_normal);
            #else
                vec3 ng = vec3(0.0, 0.0, 1.0);
            #endif
            mat3 tbn = mat3(vec3(0.0), vec3(0.0), ng);
        #endif
    #endif

    vec3 normal = texture2D(normalTexture, v_uv ).rgb;
    normal = normalize(tbn * ((2.0 * normal - 1.0) * vec3(normalIntensity, normalIntensity, 1.0)));
    normal *= float( gl_FrontFacing ) * 2.0 - 1.0;

    return normal;
}
