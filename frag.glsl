precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_previousFrame;
uniform vec2 u_mouse;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    vec3 previous = texture2D(u_previousFrame, uv).rgb;

    float wave = sin(
        uv.x * 20.0 +
        uv.y * 20.0 +
        u_time * 2.0
    );

    vec3 current = vec3(
        wave * 0.5 + 0.5,
        uv.x,
        uv.y
    );

    vec2 mouse = u_mouse / u_resolution.xy;

    float distanceToMouse = distance(uv, mouse);

    float glow = exp(-distanceToMouse * 20.0);


    // Blend current frame with previous frame
    vec3 color = mix(current, previous, 0.95);
    color += glow;

    gl_FragColor = vec4(color, 1.0);
}