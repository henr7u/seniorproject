#version 300 es

precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iMousePrev;
uniform float perspective;
uniform float objectData[10 * 4]; // object type + pos + rot + size * object count
out vec4 fragColor;

float sdBox( vec3 p, vec3 b ) {
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) +
         length(max(d,0.0));
}

vec2 mirror(vec2 p, float v) {
  float hv = v * 0.5;
  vec2  fl = mod(floor(p / v + 0.5), 2.0) * 2.0 - 1.0;
  vec2  mp = mod(p + hv, v) - hv;
    
  return fl * mp;
}

vec2 rotate2D(vec2 p, float a) {
  return p * mat2(cos(a), -sin(a), sin(a),  cos(a));
}

float map(vec3 p) {
  float r = iMouse.z > 0.0 ? iMouse.x / 100.0 : iTime * 0.9;
  p.xz = mirror(p.xz, 4.);
  p.xz = rotate2D(p.xz, r);
  float d = sdBox(p, vec3(1));
  d = min(d, sdBox(p, vec3(0.1, 0.1, 3)));
  d = min(d, sdBox(p, vec3(3, 0.1, 0.1)));
  return d;
}

mat3 calcLookAtMatrix(vec3 origin, vec3 target, float roll) {
  vec3 rr = vec3(sin(roll), cos(roll), 0.0);
  vec3 ww = normalize(target - origin);
  vec3 uu = normalize(cross(ww, rr));
  vec3 vv = normalize(cross(uu, ww));

  return mat3(uu, vv, ww);
}

vec3 getRay(vec3 origin, vec3 target, vec2 screenPos, float lensLength) {
  mat3 camMat = calcLookAtMatrix(origin, target, 0.0);
  return normalize(camMat * vec3(screenPos, lensLength));
}

float calcRayIntersection(vec3 rayOrigin, vec3 rayDir, float maxd, float precis) {
  float latest = precis * 2.0;
  float dist   = +0.0;
  float type   = -1.0;
  float res    = -1.0;

  for (int i = 0; i < 30; i++) {
    if (latest < precis || dist > maxd) break;

    float result = map(rayOrigin + rayDir * dist);

    latest = result;
    dist  += latest;
  }

  if (dist < maxd) {
    res = dist;
  }

  return res;
}

vec2 squareFrame(vec2 screenSize, vec2 coord) {
  vec2 position = 2.0 * (coord.xy / screenSize.xy) - 1.0;
  position.x *= screenSize.x / screenSize.y;
  return position;
}

vec3 calcNormal(vec3 pos, float eps) {
  const vec3 v1 = vec3( 1.0,-1.0,-1.0);
  const vec3 v2 = vec3(-1.0,-1.0, 1.0);
  const vec3 v3 = vec3(-1.0, 1.0,-1.0);
  const vec3 v4 = vec3( 1.0, 1.0, 1.0);

  return normalize( v1 * map( pos + v1*eps ) +
                    v2 * map( pos + v2*eps ) +
                    v3 * map( pos + v3*eps ) +
                    v4 * map( pos + v4*eps ) );
}

vec3 calcNormal(vec3 pos) {
  return calcNormal(pos, 0.002);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = squareFrame(iResolution.xy, fragCoord.xy);
  vec3 ro = vec3(sin(iTime * 0.2), 1.5, cos(iTime * 0.2)) * 5.;
  vec3 ta = vec3(0, 0, 0);
  vec3 rd = getRay(ro, ta, uv, 2.0);
    
  float t = calcRayIntersection(ro, rd, 20.0, 0.001);
  vec3 pos = ro + rd * t;
  vec3 nor = calcNormal(pos);
    
  fragColor = vec4(rd, t);
}

/*
// obj 0 
float sdBox( vec3 p, vec3 b ) {
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) +
         length(max(d,0.0));
}

// obj 1 
float sdTorus( vec3 p, vec2 t )
{
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

// obj 2
float sdCappedCylinder( vec3 p, float r, float h )
{
  vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(r,h);
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

// obj 3
float sdOctahedron( vec3 p, float s )
{
  p = abs(p);
  float m = p.x+p.y+p.z-s;
  vec3 q;
       if( 3.0*p.x < m ) q = p.xyz;
  else if( 3.0*p.y < m ) q = p.yzx;
  else if( 3.0*p.z < m ) q = p.zxy;
  else return m*0.57735027;
    
  float k = clamp(0.5*(q.z-q.y+s),0.0,s); 
  return length(vec3(q.x,q.y-s+k,q.z-k)); 
}

// obj 4 
float icosahedron(vec3 position, float radius) {
    position = abs(position);
    float phi = (1.0 + sqrt(5.0)) * 0.5;
    float s = radius / sqrt(phi + 2.0);
    vec3 f = vec3(phi * position.y + position.z / phi, position.x / phi + phi * position.z, phi * position.x + position.y / phi);
    if (f.y > f.x) {
        position = f.y > f.z ? position.yzx : position.zxy;
    } else if (f.z > f.x) {
        position = position.zxy;
    }
    vec3 n = vec3(phi, -1.0, 1.0 / phi);
    position -= 0.5 * max(dot(position, n), 0.0) * n;
    float h = phi * position.y + position.z / phi - phi * phi * s;
    vec2 q = vec2(sqrt(3.0) * position.x, phi * position.z - position.y / phi);
    q -= 0.5 * vec2(1.0, sqrt(3.0)) * max(q.x + sqrt(3.0) * q.y, 0.0);
    q.x = abs(q.x);
    q = max(vec2(q.x - sqrt(3.0) * s, -q.y - s), 0.0);
    float d = length(vec3(q, h)) / sqrt(3.0);
    return h < 0.0 ? -d : d;
}

float map(vec3 p) {
    float d = 10000.;
    d = min(d, sdBox(p - vec3(0, 0, -6), vec3(.65)));
    return sdBox(p - vec3(0, 0, 6), vec3(.65));
    return d;
}

// https://www.shadertoy.com/view/4dVGRW
vec3 calcNormal(vec3 pos, float eps) {
  const vec3 v1 = vec3( 1,-1,-1);
  const vec3 v2 = vec3(-1,-1, 1);
  const vec3 v3 = vec3(-1, 1,-1);
  const vec3 v4 = vec3( 1, 1, 1);

  return normalize( v1 * map( pos + v1*eps ) +
                    v2 * map( pos + v2*eps ) +
                    v3 * map( pos + v3*eps ) +
                    v4 * map( pos + v4*eps ) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy)
            / min(iResolution.x, iResolution.y);

    vec3 ro = vec3(0, 0, 0);
    vec3 rd = normalize(vec3(uv, perspective));

    // basic shit 
    float t = 0.0;
    bool hit = false;

    vec3 pt = ro;
    for (int i = 0; i < 100; i++) {
        pt = ro + rd * t;

        float d = map(pt);

        if (d < 0.0007) {
            hit = true;
            break;
        }

        t += max(d, 0.0005);
    }

    fragColor = vec4(rd, 1);
}
*/

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}