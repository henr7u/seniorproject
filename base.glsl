#version 300 es

precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iMousePrev;
uniform float u_downscale;
uniform float u_perspective;
uniform float u_objectData[10 * 5]; // object type + pos + rot + size/shape * object count
out vec4 fragColor;

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
float sdIcosahedron(vec3 position, float radius) {
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

// inverse rotation
vec3 iRot(vec3 p, vec3 angles) {
    vec3 c = cos(angles);
    vec3 s = sin(angles);
    p.xy = mat2(c.z, -s.z, s.z, c.z) * p.xy; // Inverse Z
    p.xz = mat2(c.y, s.y, -s.y, c.y) * p.xz; // Inverse Y
    p.yz = mat2(c.x, -s.x, s.x, c.x) * p.yz; // Inverse X
    return p;
}

// read object data
float rod(int i, int off) {
    return u_objectData[i * 10 + off];
}

float map(vec3 p) {
    float d = 10000.;
    for (int i = 0; i < u_objectData.length() / 10; i++) {
        vec3 dp = iRot(p - vec3(rod(i, 1), rod(i, 2), rod(i, 3)), 
                    vec3(rod(i, 4), rod(i, 5), rod(i, 6)))  ;

        switch (int(rod(i, 0))) {
            case 0: d = min(d, sdBox(dp, vec3(rod(i, 7), rod(i, 8), rod(i, 9)))); break;
            case 1: d = min(d, sdTorus(dp, vec2(rod(i, 7), rod(i, 8)))); break;
            case 2: d = min(d, sdCappedCylinder(dp, rod(i, 7), rod(i, 8))); break;
            case 3: d = min(d, sdOctahedron(dp, rod(i, 7))); break;
            case 4: d = min(d, sdIcosahedron(dp, rod(i, 7))); break;
        }
    }
    d = min(d, sdBox(iRot(p - vec3(2, 0, 6), vec3(iTime, iTime / 2., 0)), vec3(.65)));
    d = min(d, sdIcosahedron(p - vec3(-2, 0, 6), 1.));
    d = min(d, sdOctahedron(p - vec3(0, 2, 6), 1.));
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

vec2 squareFrame(vec2 screenSize, vec2 coord) {
  vec2 position = 2.0 * (coord.xy / screenSize.xy) - 1.0;
  position.x *= screenSize.x / screenSize.y;
  return position;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy)
            / min(iResolution.x, iResolution.y);

    vec3 ro = vec3(0, 0, 0);
    vec3 rd = normalize(vec3(uv, u_perspective));

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

    if (!hit) t = -1.;

    vec3 nor = calcNormal(ro + rd * t, .002);

    fragColor = vec4(nor, t);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}