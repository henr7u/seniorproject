#version 300 es

precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iMousePrev;
uniform sampler2D iChannel0; // Previous Buffer A frame
uniform sampler2D iChannel1; // source material
uniform int u_downscale;

// #define PREVIEW
// #define WHITE

out vec4 fragColor;
#define PI 3.14156
#define ln10 2.30258509

const float contrastThreshold = .1;
    
const int runSeed = 1;

const float threshSigma = .05;
const float idealPosThresh = .2;
const float idealNegThresh = .2;

const bool doLeaking = true;
const float noiseRateCovDecades = .1;

// --- consts ---
const int EventCountScale = 100;
const float dtSecs = .01; // explicitly "secs" because tau is as well
const float tauOn = .005;
const float tauOff = .010;

//_imperfections_
const float leakRateHz = .01;
const float leakJitterFraction = .1;
const bool addPhotoAndShotNoise = true;
const float photoNoiseTargetBa = .1;
const float photoNoiseCutoffHz = 10.;

float sdSegment( in vec2 p, in vec2 a, in vec2 b, in float r ) {
    vec2 ba = b-a;
    vec2 pa = p-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length(pa-h*ba)-r;
}

float normalDelta(vec4 a, vec4 b) {
    float valid = step(0.5, a.a) * step(0.5, b.a);
    return valid * max(0.0, 1.0 - dot(a.rgb, b.rgb));
}

vec2 getDeltas(sampler2D buf, vec2 uv, float radius) {
    vec2 pixel = radius / iResolution.xy;
    vec3 pole = vec3(-1, 0, +1);
    float dpos = 0.0;
    float dnor = 0.0;

    vec4 s0 = texture(buf, uv + pixel.xy * pole.xx); // x1, y1
    vec4 s1 = texture(buf, uv + pixel.xy * pole.yx); // x2, y1
    vec4 s2 = texture(buf, uv + pixel.xy * pole.zx); // x3, y1
    vec4 s3 = texture(buf, uv + pixel.xy * pole.xy); // x1, y2
    vec4 s4 = texture(buf, uv + pixel.xy * pole.yy); // x2, y2
    vec4 s5 = texture(buf, uv + pixel.xy * pole.zy); // x3, y2
    vec4 s6 = texture(buf, uv + pixel.xy * pole.xz); // x1, y3
    vec4 s7 = texture(buf, uv + pixel.xy * pole.yz); // x2, y3
    vec4 s8 = texture(buf, uv + pixel.xy * pole.zz); // x3, y3

    dpos = (
        abs(s1.a - s7.a) +
        abs(s5.a - s3.a) +
        abs(s0.a - s8.a) +
        abs(s2.a - s6.a)
    ) * 0.5;
    dpos +=
        normalDelta(s1, s7) +
        normalDelta(s5, s3) +
        normalDelta(s0, s8) +
        normalDelta(s2, s6);

    // dpos = pow(max(dpos - 0.5, 0.0), 5.0);
    dpos = step(.5, dpos);

    return vec2(dpos, dnor);
}

void image( out vec4 fragColor, in vec2 fragCoord,
    in vec3 iResolution) {
    vec3 bg = vec3(0);
    // mouse cursor
    vec3 col = sdSegment(fragCoord * float(u_downscale), iMouse.xy* float(u_downscale), iMousePrev.xy* float(u_downscale), 30.) < 0.
     ? vec3(step(1., iMouse.z) + 1.) : bg;

    
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 deltas = getDeltas(iChannel1, uv, .5);

    // col = vec3(1);
    col += deltas.x - deltas.y;
    
    fragColor = vec4(col, 1);
    // fragColor = vec4(deltas.y);
    // fragColor = vec4(abs(texture(iChannel1, uv)));
    // fragColor = vec4(texture(iChannel1, uv).xyz, 1);
}

// DVSIM START

// https://www.pcg-random.org/
uvec4 pcg4d(inout uvec4 v) {
	v = v * 1664525u + 1013904223u;
	v.x += v.y * v.w;
	v.y += v.z * v.x;
	v.z += v.x * v.y;
	v.w += v.y * v.z;

	v ^= v >> 16;

	v.x += v.y * v.w;
	v.y += v.z * v.x;
	v.z += v.x * v.y;
	v.w += v.y * v.z;

	return v;
}

float rand(inout uvec4 s) { return float(pcg4d(s).x) / float(0xffffffffu); }

uvec4 coord2seed(uvec3 id) {
	return uvec4(
		id.x,
		id.y,
		id.x ^ id.y,
		id.x * 1664525u + id.y * 1013904223u);
}

uvec4 seededcoord2seed(uvec3 id, int seed) {
	uint useed = uint(seed);
	return uvec4(
		id.x ^ (useed * 0x9E3779B9u),
		id.y ^ (useed * 0xBB67AE85u),
		(id.x ^ id.y) ^ (useed * 0x3C6EF372u),
		id.x * 1664525u + id.y * 1013904223u + useed * 0xA54FF53Au
	);
}

// src: A Note on the Generation of Random Normal Deviates.
// https://doi.org/10.1214/aoms/1177706645
float boxMullerRandomNormal(inout uvec4 s) {
	float u1 = max(rand(s), 1e-7);
	float u2 = rand(s);

	return sqrt(-2.0f * log(u1)) * cos(2.0f * PI * u2);
}

vec4 VariableThreshAndLeak(uvec3 id) {
	uvec4 seed = seededcoord2seed(id, runSeed);
	
	// variate thresholds by normal distribution
	float pos = idealPosThresh + threshSigma * boxMullerRandomNormal(seed);
	float neg = idealNegThresh + threshSigma * boxMullerRandomNormal(seed);
	
	pos = max(pos, .01);
	neg = max(neg, .01);

	// calculate noise rate
	float noiseRate = doLeaking ? exp(ln10 * noiseRateCovDecades * boxMullerRandomNormal(seed)) : 0.;
	
	return vec4(pos, neg, noiseRate, 0); // extra float for something idk
}

float luma(vec3 col) {
	return dot(vec3(.2126, .7152, .0722), max(vec3(0.), col)); // no performance difference from og
}

float leakCurrent(inout uvec4 seed, vec4 threshNoiseRate) {
	float rand = boxMullerRandomNormal(seed);
	float curLeakRate = leakRateHz * threshNoiseRate.z * (1. - leakJitterFraction * rand);
	float deltaLeak = dtSecs * curLeakRate * threshNoiseRate.x;
	
	return deltaLeak;
}

float ApproximateVoltage(float fps, float targetBA) {
    float lba = log(targetBA) / log(10.);
    float lfps = log(fps) / log(10.);

    return 
        0.04725155f
        + 0.00274859f * lba
        + 0.00788103f * lfps
        + 0.00955851f * lba * lfps
    ;
}

float photoreceptorNoise(inout uvec4 seed, float curPhotoNoise) {
	if (!addPhotoAndShotNoise)
		return 0.;
        
    float voltage = ApproximateVoltage(60., photoNoiseTargetBa);
	
	float noise = voltage * boxMullerRandomNormal(seed);
	float tau = 1. / (2. * PI * photoNoiseCutoffHz);
	float eps = 1. - exp(-dtSecs / tau); // max=1, no clamp needed
	
	return mix(curPhotoNoise, noise, eps);
}

vec4 state(vec4 col, vec4 state, 
    vec2 coord, int iterSeed, bool firstFrame) {
    
    uvec3 id = uvec3(coord, 0);
    uvec4 seed = seededcoord2seed(id, iterSeed);

    float I = luma(col.rgb); // current luma
    float L = log(max(I, 1e-4)); // linlog was designed for 8 bit color, HDR float color can use pure log

    if (firstFrame)
        return vec4(L, L, 0, 0);

    // get references
    float ref = state.x; // ref == base_log_frame
    float Lf = state.y; // Lf == low pass filtered L
    float curPhotoNoise = state.z; // cpn = current state of low passed photoreceptor noise 

    // low pass filter pixel "motion blur" simulation
    float tau = (L > Lf) ? tauOn : tauOff;
    float alpha = 1. - exp(-dtSecs / tau); // α = 1 - e^(-Δt / τ)

    Lf += alpha * (L - Lf); // Lf(t+Δt) = Lf(t) + α(L(t) - Lf(t))

    // leak 
    vec4 threshNoiseRate = VariableThreshAndLeak(id);
    float leak = leakCurrent(seed, threshNoiseRate);
    ref -= leak;

    // photo noise 
    float photoNoise = photoreceptorNoise(seed, curPhotoNoise);
    Lf += photoNoise;

    // comparator
    float diff = Lf - ref; // most important step

    bool on = diff > 0.;
    float polarity = on ? 1. : -1.;

    // compute the rest
    float ContrastThreshold = on ? threshNoiseRate.x : threshNoiseRate.y;

    float numEvents = floor(float(polarity) * diff / ContrastThreshold);

    // pack polarity, events, diff into one float
    float packout = sign(numEvents) * polarity * (numEvents * float(EventCountScale) + abs(diff));

    // update state
    // Lf and photoNoise are low passed
    ref += polarity * numEvents * ContrastThreshold; 
    return vec4(ref, Lf, photoNoise, packout);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec4 col;
    image(col, fragCoord, iResolution);
    
    vec4 cur = texture(iChannel0, fragCoord / iResolution.xy);
    
    fragColor = state(col, cur, fragCoord, iFrame, iFrame == 0);
    
#ifdef PREVIEW
    fragColor = col;
#endif

#ifdef WHITE
    fragColor = vec4(1.);
#endif
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}