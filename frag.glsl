#version 300 es

precision highp float;
precision highp int;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iMouse;
uniform sampler2D iChannel0; // Current Buffer A output

out vec4 fragColor;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float num = texture(iChannel0, fragCoord/iResolution.xy).w;
    vec3 orig = texture(iChannel0, fragCoord/iResolution.xy).xyz;
    
    vec3 col = vec3(num,0,-num);
	fragColor = vec4(col, 1.0);
	// fragColor = vec4(orig, 1);
	// fragColor = vec4(orig + col, 1);
} 

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}