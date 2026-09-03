/**
 * The dragon's shader, kept in its own module so two things can share it: the
 * live boss canvas, and the `/lab` bench that renders a single frame and times
 * it. Tuning a raymarcher by reloading the whole site is how a shader ends up
 * shipped at four frames a second on the hardware most people own.
 */

export const DRAGON_VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const DRAGON_FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uHp;    // 1 full, 0 dead
uniform float uTier;  // 0 for the first boss, 1 for the oldest. Sizes horns.
uniform float uHit;   // 1 on the frame of a hit, decaying
uniform float uDeath; // 0..1 progress through the death sequence

/* ---- Pose ---------------------------------------------------------------
 * Solved once per pixel in main(), read by every distance sample. Hoisting
 * this out is worth more than any other single change here: it takes a dozen
 * sines and four rotations off each of the five call sites.
 */
float gWound, gSink, gBreath, gHorn;
vec3  gN0, gN1, gN2, gN3;   // neck spine, shoulders to skull
vec3  gT1, gT2, gT3;        // tail
mat2  gHead, gJaw, gWingA, gWingB;

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0 - h);
}

float sdEllipsoid(vec3 p, vec3 r){
  float k0 = length(p/r);
  return k0*(k0 - 1.0)/length(p/(r*r));
}

/*
 * Tapered capsule — every bone, horn, claw and tail segment.
 *
 * Lerping the radius along a capsule is not the true distance to a cone: it
 * overestimates by 1/cos(taper), and an overestimated field lets the marcher
 * step straight through a thin horn. Scaling by exactly that cosine makes it
 * conservative again, at a third of the cost of the exact round cone.
 */
float sdTaper(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 pa = p - a, ba = b - a;
  float l2 = dot(ba, ba);
  float h = clamp(dot(pa, ba)/l2, 0.0, 1.0);
  float dr = r1 - r2;
  return (length(pa - ba*h) - mix(r1, r2, h))*inversesqrt(1.0 + dr*dr/l2);
}

float dot2(vec3 v){ return dot(v, v); }

/*
 * Unsigned distance to a triangle. Subtracting a thickness turns it into a
 * thin sheet with rounded edges, which is exactly what a wing membrane is —
 * and unlike a squashed ellipsoid it lets the silhouette be drawn by hand,
 * one vertex at a time.
 */
float udTriangle(vec3 p, vec3 a, vec3 b, vec3 c){
  vec3 ba = b - a, pa = p - a;
  vec3 cb = c - b, pb = p - b;
  vec3 ac = a - c, pc = p - c;
  vec3 nor = cross(ba, ac);
  if(sign(dot(cross(ba, nor), pa)) + sign(dot(cross(cb, nor), pb)) +
     sign(dot(cross(ac, nor), pc)) < 2.0){
    return sqrt(min(min(
      dot2(ba*clamp(dot(ba, pa)/dot2(ba), 0.0, 1.0) - pa),
      dot2(cb*clamp(dot(cb, pb)/dot2(cb), 0.0, 1.0) - pb)),
      dot2(ac*clamp(dot(ac, pc)/dot2(ac), 0.0, 1.0) - pc)));
  }
  return abs(dot(nor, pa))*inversesqrt(dot2(nor));
}

vec2 opU(vec2 a, vec2 b){ return a.x < b.x ? a : b; }

/*
 * How close a ray must get to a group's bounding sphere before the group is
 * evaluated in detail.
 *
 * This margin is not an optimisation, it is a correctness fix. A bounding
 * sphere's distance falls to zero at its own surface, so handing that number
 * back to the marcher makes the invisible bound behave exactly like geometry:
 * the hit test fires, and the screen fills with shaded spheres. Entering the
 * detail branch early keeps every value the marcher ever sees comfortably
 * above the hit epsilon, which at the far end of the hull is about 0.05.
 */
const float BOUND_MARGIN = 0.25;

/* How much bigger the skull is than the space it is modelled in. */
const float HEAD = 1.20;

/* Entry and exit distance along a ray for a sphere; negative on a miss. */
vec2 sphereSpan(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b*b - dot(oc, oc) + r*r;
  if(h < 0.0) return vec2(-1.0, -2.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

/* ---- The body ----------------------------------------------------------
 * Materials: 1 armour, 2 membrane, 3 horn, 4 emissive.
 */
vec2 mapDragon(vec3 p){
  p.y += gSink*3.2;
  vec3 q = p;
  q.x = abs(q.x);        // bilateral: wings, horns and legs cost one side

  /* Torso and neck. Bounded like everything else — these were the one group
     evaluated on every sample, including for rays nowhere near the animal. */
  float bCore = length(p - vec3(0.0, 2.00, -0.10)) - 2.85;
  vec2 res = vec2(bCore, 1.0);
  if(bCore < BOUND_MARGIN){
    float d = smin(
      sdEllipsoid(p - vec3(0.0, 1.42, -0.60), vec3(1.28 + gBreath, 1.10, 1.62)),
      sdEllipsoid(p - vec3(0.0, 1.40, 0.48), vec3(1.08 + gBreath, 0.98, 0.86)), 0.45);
    d = smin(d, sdEllipsoid(q - vec3(0.92, 2.02, -0.24), vec3(0.52, 0.50, 0.58)), 0.28);

    float neck = sdTaper(p, gN0, gN1, 0.62, 0.53);
    neck = min(neck, sdTaper(p, gN1, gN2, 0.53, 0.44));
    neck = min(neck, sdTaper(p, gN2, gN3, 0.44, 0.37));
    res.x = smin(d, neck, 0.30);
  }

  /* Head */
  /*
   * The head is modelled at unit scale and scaled up as a whole. Multiplying
   * a distance by the same factor the space was divided by is exact for a
   * uniform scale, and it means the skull can be resized by one constant
   * rather than by retuning fifteen radii and staying consistent across them.
   */
  float bHead = length(p - gN3 - vec3(0.0, 0.26, 0.26)) - 1.60*HEAD;
  if(bHead < BOUND_MARGIN){
    vec3 h = (p - gN3)/HEAD;
    h.yz *= gHead;
    vec3 hm = h;
    hm.x = abs(hm.x);

    /*
     * The muzzle is evaluated in a vertically squashed space, which turns the
     * round cone a taper would otherwise give into a wedge — wide across,
     * shallow top to bottom. That one anisotropy is most of the difference
     * between a dragon's head and a horse's. Dividing the result by the
     * largest scale factor keeps the field conservative, so the marcher
     * cannot step through the flattened faces.
     */
    vec3 sn = h;
    sn.y *= 1.38;
    float head = smin(
      sdEllipsoid(h - vec3(0.0, 0.04, 0.0), vec3(0.54, 0.50, 0.60)),
      sdTaper(sn, vec3(0.0, -0.04, 0.36), vec3(0.0, -0.28, 1.38), 0.42, 0.17)/1.38,
      0.18);

    // Lower jaw, hinged. It swings wide on a hit — the dragon roars when the
    // bar moves, which is the cheapest way to tie the model to the mechanic.
    vec3 j = h - vec3(0.0, -0.10, 0.24);
    j.yz *= gJaw;
    head = smin(head,
      sdTaper(j, vec3(0.0, -0.11, 0.08), vec3(0.0, -0.22, 1.06), 0.27, 0.10), 0.05);
    // Brow ridge, and the cheek plate under it. Between them they give the
    // skull the heavy square front that separates a dragon from a horse.
    head = smin(head,
      sdEllipsoid(hm - vec3(0.30, 0.26, 0.30), vec3(0.22, 0.13, 0.34)), 0.09);
    head = smin(head,
      sdEllipsoid(hm - vec3(0.34, -0.10, 0.16), vec3(0.16, 0.20, 0.30)), 0.12);
    // Socket the eye. A light on a smooth cheek is a headlamp; the same light
    // at the bottom of a hollow with a brow over it is a look.
    head = max(head, -(length(hm - vec3(0.29, 0.13, 0.47)) - 0.145));
    res = opU(res, vec2(head*HEAD, 1.0));

    /*
     * Fangs, by domain repetition: one cone, folded along the muzzle, then
     * trimmed to a ball around it so the repetition does not run to infinity.
     * Cost is a modulo and a sphere, and it is the single cheapest feature
     * here that makes the silhouette read as a predator rather than as
     * livestock.
     */
    vec3 tp = hm;
    tp.z = mod(tp.z - 0.44, 0.150) - 0.075;
    float fang = sdTaper(tp, vec3(0.170, -0.17, 0.0),
                             vec3(0.155, -0.37, 0.0), 0.042, 0.006);
    fang = max(fang, length(hm - vec3(0.16, -0.22, 0.88)) - 0.60);
    res = opU(res, vec2(fang*HEAD, 3.0));

    // Three horn pairs, sized by tier. An older boss carries a heavier crown,
    // so its rank is legible from the skull alone in any crop.
    // Swept back and out, not up. Horns that rise off the skull read as a
    // mane or a crown; horns that lie back along the neck read as a predator.
    /*
     * Two segments per horn rather than one. A straight cone off a skull is a
     * spike and reads as a party hat; the bend is what makes it grow out of
     * the animal. Swept back and out, never up.
     */
    vec3 c1 = vec3(0.26, 0.34, -0.10);
    vec3 c2 = vec3(0.32, 0.14, -0.20);
    vec3 c3 = vec3(0.34, -0.10, -0.26);
    vec3 m1 = c1 + vec3(0.20, 0.26, -0.58)*gHorn;
    vec3 m2 = c2 + vec3(0.26, 0.06, -0.50)*gHorn;
    vec3 m3 = c3 + vec3(0.22, -0.04, -0.40)*gHorn;
    res = opU(res, vec2(HEAD*min(
      sdTaper(hm, c1, m1, 0.135, 0.078),
      sdTaper(hm, m1, m1 + vec3(0.26, -0.02, -0.72)*gHorn, 0.078, 0.014)), 3.0));
    res = opU(res, vec2(HEAD*min(
      sdTaper(hm, c2, m2, 0.092, 0.055),
      sdTaper(hm, m2, m2 + vec3(0.24, -0.14, -0.60)*gHorn, 0.055, 0.012)), 3.0));
    res = opU(res, vec2(HEAD*sdTaper(hm, c3,
      m3 + vec3(0.18, -0.16, -0.44)*gHorn, 0.062, 0.010), 3.0));

    // Eye, and the furnace behind the teeth. Both pure emission.
    res = opU(res, vec2(HEAD*sdEllipsoid(hm - vec3(0.295, 0.135, 0.465),
      vec3(0.105, 0.058, 0.092)), 4.0));
    res = opU(res, vec2(HEAD*sdEllipsoid(h - vec3(0.0, -0.16, 0.70),
      vec3(0.24, 0.15, 0.52)), 4.0));
  } else {
    res.x = min(res.x, bHead);
  }

  /* Wings */
  vec3 w = q - vec3(0.80, 2.12, -0.28);
  w.xy *= gWingA;
  w.yz *= gWingB;
  float bWing = length(w - vec3(1.85, 0.65, -1.45)) - 3.15;
  if(bWing < BOUND_MARGIN){
    vec3 E  = vec3(1.55, 1.25, -0.75);
    vec3 W  = vec3(2.35, 2.28, -1.52);
    // Fingers fanned much wider than the first pass, where they sat within
    // half a unit of each other and the membrane came out a flat kite.
    vec3 f1 = vec3(3.72, 2.20, -2.05);
    vec3 f2 = vec3(3.45, 0.50, -2.40);
    vec3 f3 = vec3(2.35, -1.05, -2.00);

    float bone = sdTaper(w, vec3(0.0), E, 0.21, 0.15);
    bone = min(bone, sdTaper(w, E, W, 0.15, 0.10));
    bone = min(bone, sdTaper(w, W, f1, 0.10, 0.032));
    bone = min(bone, sdTaper(w, W, f2, 0.10, 0.030));
    bone = min(bone, sdTaper(w, W, f3, 0.09, 0.030));
    res = opU(res, vec2(bone, 1.0));

    float mem = min(udTriangle(w, W, f1, f2), udTriangle(w, vec3(0.0), W, f3));
    mem = min(mem, udTriangle(w, W, f2, f3)) - 0.028;

    /*
     * Scallop the trailing edge. A bat wing is not a polygon: the skin sags
     * between the fingers and is cut back between them, and without that the
     * three triangles read as one flat kite no matter how they are posed.
     * Two spheres parked just outside the edge take the bites.
     */
    mem = max(mem, -(length(w - vec3(3.62, 1.10, -2.42)) - 0.68));
    mem = max(mem, -(length(w - vec3(2.92, -0.60, -2.30)) - 0.62));

    // Tattering. Two holes that widen as the bar drains, so a wing that is
    // still whole is a boss that has barely been touched.
    float tear = gWound*0.62;
    mem = max(mem, -(length(w - vec3(2.75, 0.95, -1.95)) - tear));
    mem = max(mem, -(length(w - vec3(1.70, 0.35, -1.45)) - tear*0.75));
    res = opU(res, vec2(mem, 2.0));
  } else {
    res.x = min(res.x, bWing);
  }

  /* Tail */
  float bTail = length(p - vec3(-0.85, 2.15, -3.45)) - 2.65;
  if(bTail < BOUND_MARGIN){
    float tail = sdTaper(p, vec3(0.0, 1.42 - gSink*0.5, -2.0), gT1, 0.40, 0.26);
    tail = min(tail, sdTaper(p, gT1, gT2, 0.26, 0.14));
    tail = min(tail, sdTaper(p, gT2, gT3, 0.14, 0.04));
    res.x = smin(res.x, tail, 0.24);
  } else {
    res.x = min(res.x, bTail);
  }

  /* Legs */
  float bLeg = length(q - vec3(0.95, 0.60, 0.18)) - 1.35;
  if(bLeg < BOUND_MARGIN){
    float leg = sdTaper(q, vec3(0.74, 1.05, -0.34), vec3(1.16, 0.58, 0.26), 0.42, 0.26);
    leg = min(leg, sdTaper(q, vec3(1.16, 0.58, 0.26), vec3(0.94, 0.12, 0.52), 0.26, 0.16));
    res.x = smin(res.x, leg, 0.14);
    res = opU(res, vec2(sdTaper(q, vec3(0.92, 0.07, 0.50),
      vec3(0.86, 0.03, 0.94), 0.12, 0.035), 3.0));
  } else {
    res.x = min(res.x, bLeg);
  }

  return res;
}

float mapD(vec3 p){ return mapDragon(p).x; }

/* Tetrahedron normal: four samples rather than the six a central difference
   needs, for a difference nobody can see on a charred surface. */
vec3 normalAt(vec3 p){
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.0026;
  return normalize(
    k.xyy*mapD(p + k.xyy*e) + k.yyx*mapD(p + k.yyx*e) +
    k.yxy*mapD(p + k.yxy*e) + k.xxx*mapD(p + k.xxx*e));
}

/*
 * Molten seams. Two crossed sine lattices go to zero along thin surfaces; the
 * band around that zero is the crack. Cheap, has no repeating tile a viewer
 * can pick out, and drifts so the rock reads as still moving.
 */
float seams(vec3 p){
  float t = uTime*0.11;
  /*
   * Warp the lattice before sampling it.
   *
   * The zero set of a product of three axis-aligned sines is three families
   * of parallel planes, and on a curved body that is not a crack pattern, it
   * is a net — the eye finds the grid immediately and the dragon turns into a
   * beach ball. Displacing the input by a slower field first bends those
   * planes into something that wanders, which is what a cooling crust does.
   */
  vec3 w = p + vec3(sin(p.z*1.7 + t), sin(p.x*2.1), sin(p.y*1.6 - t))*0.62;
  float n = sin(w.x*2.6 + sin(w.y*1.9)*2.2)
          * sin(w.y*2.2 + sin(w.z*2.4)*1.9)
          * sin(w.z*2.4 + sin(w.x*1.7)*2.1);
  /*
   * The band has to be narrow. A product of three sines is near zero over
   * broad sheets — wherever any two of them cross at once — so a generous
   * threshold does not draw cracks in the rock, it floods whole panels and
   * the armour turns cream. These widths are chosen so the lit fraction of
   * the body stays small even at death, which is what keeps a black dragon
   * black and makes the glow read as coming from inside it.
   */
  float band = smoothstep(0.0042 + 0.010*gWound + 0.024*uHit, 0.0, abs(n));
  /*
   * Broken up by a much slower lattice. An even net of seams over the whole
   * animal does not read as cracked rock, it reads as a wireframe — the
   * regularity is the tell. Masking most of it away leaves glowing runs with
   * cold armour between them, which is how lava actually sits in stone.
   */
  float patch = smoothstep(0.46, 0.93,
    0.5 + 0.5*sin(p.x*1.15 + 1.7)*sin(p.y*0.85)*sin(p.z*1.05 - 0.6));
  return band*mix(0.02, 1.0, patch);
}

/* Embers drifting up off the ground. */
float embers(vec2 uv, float scale, float speed){
  vec2 g = uv*scale;
  g.y -= uTime*speed;
  vec2 f = fract(g) - 0.5;
  float h = fract(sin(dot(floor(g), vec2(127.1, 311.7)))*43758.5);
  if(h < 0.88) return 0.0;
  f -= (vec2(fract(h*31.7), fract(h*17.3)) - 0.5)*0.6;
  return smoothstep(0.09, 0.0, length(f))*(0.5 + 0.5*sin(uTime*3.0 + h*40.0));
}

void main(){
  gWound  = clamp(1.0 - uHp, 0.0, 1.0);
  gSink   = smoothstep(0.05, 0.48, uDeath)*(1.0 - smoothstep(0.66, 0.99, uDeath));
  gBreath = sin(uTime*0.9)*0.022;
  gHorn   = 0.72 + 0.55*clamp(uTier, 0.0, 1.0);

  float sag = gWound*0.55 + gSink*0.60;
  float bob = sin(uTime*0.75)*0.055;
  float swy = sin(uTime*0.42);
  // Short and arched. A long smooth neck is a horse; the arc has to lift
  // fast off the shoulders and then push the skull forward.
  gN0 = vec3(0.0,       1.98,                         0.35);
  gN1 = vec3(swy*0.018, 2.82 - sag*0.14 + bob*0.33,   0.72);
  gN2 = vec3(swy*0.048, 3.52 - sag*0.62 + bob*0.67,   1.20);
  gN3 = vec3(swy*0.085, 3.74 - sag*1.75 + bob,        1.80);

  float tsw = sin(uTime*0.5);
  gT1 = vec3(-0.35 + tsw*0.14, 2.00 - gSink*0.5, -2.95);
  gT2 = vec3(-0.95 + tsw*0.30, 2.52 - gSink*0.5, -3.80);
  gT3 = vec3(-1.80 + tsw*0.48, 2.30 - gSink*0.5, -4.55);

  gHead = rot(-0.04 - gWound*0.62);
  gJaw  = rot(0.11 + uHit*0.42 + gWound*0.10);
  float flap = 0.52 + sin(uTime*0.6)*0.09 - gWound*0.66 - gSink*0.85;
  gWingA = rot(-flap*0.85);
  gWingB = rot(flap*0.35);

  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float aspect = uRes.x/max(uRes.y, 1.0);

  /*
   * The lens is solved rather than fixed. The wingspan is nine units across
   * and four tall, so a focal length that frames it on a widescreen arena
   * cuts both wings off on a phone. This fits whichever axis is binding.
   */
  /*
   * Framed for the arena, not for a square. The canvas runs the full height of
   * the section, but the top of it is under the boss frame and the bottom is
   * under the stats and the strike panel, so the animal has to sit inside a
   * band roughly half the canvas tall. Hence the extra distance: it is not
   * about fitting the wingspan, it is about leaving room to be covered.
   */
  float dist = 16.0;
  float lens = 0.5*dist/max(7.10/max(aspect, 0.35), 4.55);

  // Held off-axis. Straight on, the snout points down the lens and the skull
  // reads as a knob; three quarters is where a dragon looks like one.
  float ang = 0.50 + sin(uTime*0.085)*0.26;
  vec3 ro = vec3(sin(ang)*dist, 3.15 + sin(uTime*0.13)*0.22, cos(ang)*dist);
  vec3 ww = normalize(vec3(0.0, 2.35, 0.0) - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 rd = normalize(uv.x*uu + uv.y*cross(uu, ww) + lens*ww);

  /* Heat runs from dull ember at full health to white-hot at death. */
  vec3 heat = mix(vec3(1.00, 0.26, 0.05), vec3(1.00, 0.80, 0.42),
                  clamp(gWound*0.85 + uHit*0.4, 0.0, 1.0));
  vec3 keyDir = normalize(vec3(0.42, 0.34, 0.80));
  vec3 keyCol = vec3(1.00, 0.46, 0.17);

  /* Sky */
  vec3 col = mix(vec3(0.030, 0.018, 0.015), vec3(0.008, 0.010, 0.016),
                 smoothstep(-0.30, 0.62, uv.y));
  col += vec3(0.42, 0.16, 0.05)*0.14*exp(-max(uv.y + 0.06, 0.0)*5.2);
  col += heat*0.018*exp(-length(uv - vec2(0.0, 0.12))*2.6);
  col += vec3(1.0, 0.52, 0.18)*(embers(uv, 9.0, 0.055)*0.55 + embers(uv, 17.0, 0.10)*0.28);

  /* March, bounded by the hull sphere at both ends. */
  vec2 span = sphereSpan(ro, rd, vec3(0.0, 2.05 - gSink*3.2, -1.55), 6.8);
  float t = 1e9, mat = 0.0, glow = 0.0;
  if(span.y > 0.0){
    t = max(span.x, 0.6);
    for(int i = 0; i < 34; i++){
      if(t > span.y) break;
      vec2 h = mapDragon(ro + rd*t);
      glow += exp(-abs(h.x)*3.4)*0.014;
      if(h.x < 0.0045*t){ mat = h.y; break; }
      t += h.x*0.92;
    }
  }

  /* Ground */
  float tp = rd.y < -0.0001 ? (-0.02 - ro.y)/rd.y : -1.0;
  if(tp > 0.0 && (mat < 0.5 || tp < t)){
    vec3 pw = ro + rd*tp;
    float r = length(pw.xz);
    float crust = 0.55 + 0.45*sin(pw.x*1.7 + sin(pw.z*1.3)*2.0);
    vec3 g = vec3(0.016, 0.013, 0.012)*crust*exp(-r*0.10);
    g += heat*smoothstep(0.045, 0.0,
      abs(sin(pw.x*1.1 + sin(pw.z*0.9)*2.2)*sin(pw.z*1.3)))*0.24*exp(-r*0.20);
    g += heat*0.055*exp(-r*0.38);

    // The hit throws a ring across the floor. This is the shot that reads in
    // a clip even when the dragon is out of frame.
    g += heat*uHit*1.1*exp(-abs(r - (1.0 - uHit)*13.0)*1.6);

    /*
     * Contact shadow, faked. A real shadow ray is another dozen distance
     * samples per ground pixel, and this is a dark floor under a body that
     * never leaves the middle of it — an ellipse costs nothing and lands in
     * the same place.
     */
    vec2 rel = (pw.xz - vec2(0.0, -0.9))*vec2(0.62, 0.42);
    g *= 1.0 - 0.70*exp(-dot(rel, rel)*0.55);
    col = mix(col, g, exp(-r*0.045));
  }

  /* The dragon */
  if(mat > 0.5){
    vec3 p = ro + rd*t;
    vec3 n = normalAt(p);
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.6);
    float kd = clamp(dot(n, keyDir), 0.0, 1.0);
    float sky = clamp(0.5 + 0.5*n.y, 0.0, 1.0);
    // Hemisphere occlusion. A real AO term is three more distance samples for
    // a shape whose underside is dark in every shot anyway.
    float occ = 0.42 + 0.58*sky;
    float spe = clamp(dot(n, normalize(keyDir - rd)), 0.0, 1.0);

    vec3 c;
    if(mat < 1.5){
      // Armour: near-black plate, wet specular, molten rock in the seams.
      /*
       * Relief in the shading normal rather than in the distance field. The
       * marcher would pay for a displaced surface on every one of its forty
       * samples; perturbing the normal at the single point it actually hits
       * costs three sines and reads the same at this distance.
       */
      /*
       * Banded, not speckled. Isotropic noise on the normal reads as grain on
       * a balloon; the same amplitude pushed mostly along one axis reads as
       * overlapping plate, which is what an armoured animal is made of. The
       * fine term underneath keeps it from looking like corrugation.
       */
      float band = sin(p.y*25.0 + sin(p.x*11.0)*1.6 + sin(p.z*9.0)*1.2);
      n = normalize(n + vec3(0.18, 1.0, 0.18)*band*0.085
                      + vec3(sin(p.x*47.0), 0.0, sin(p.z*43.0))*0.022);
      kd = clamp(dot(n, keyDir), 0.0, 1.0);
      float pl = 0.5 + 0.5*sin(p.y*15.0 + sin(p.x*9.0)*1.9 + sin(p.z*8.0)*1.3);
      vec3 albedo = mix(vec3(0.024, 0.021, 0.021), vec3(0.060, 0.050, 0.046), pl);
      /*
       * Charred rock, and it has to actually be charred. Each of these terms
       * carried nearly twice this weight in the first pass and the sum came
       * out the colour of milk chocolate — which is what happens when a
       * near-black albedo is lit by three sources that each get to be
       * generous. The animal is lit by one fire from one side; everything
       * else is the shape of a hole.
       */
      c  = albedo*keyCol*kd*1.05*occ;
      c += albedo*vec3(0.16, 0.20, 0.30)*sky*0.24;
      c += keyCol*pow(spe, 42.0)*0.45*occ;
      /*
       * A hard warm rim, and it is doing the heavy lifting.
       *
       * A near-black animal on a dark ground has no silhouette — it melts
       * into the page, which is the single thing this image cannot afford
       * when the whole product is "watch the shape of the thing that is
       * dying". Lighting the grazing angle from behind draws the outline in
       * fire and lets the body stay as dark as it should be.
       */
      float rim = pow(clamp(dot(n, normalize(vec3(-0.62, 0.26, -0.74))), 0.0, 1.0), 2.2);
      c += vec3(1.0, 0.44, 0.14)*rim*fres*1.5;
      c += vec3(1.0, 0.50, 0.20)*fres*0.16;
      c += heat*seams(p)*(0.30 + 1.1*gWound + 6.0*uHit);
    } else if(mat < 2.5){
      // Membrane: thin, so it takes light on whichever side it is on, and
      // glows where the fire below shines through it.
      float veins = smoothstep(0.55, 0.0, abs(sin(p.x*7.0 + p.y*4.0)*sin(p.y*5.0)));
      c  = vec3(0.20, 0.030, 0.030)*abs(dot(n, keyDir))*1.5;
      c += vec3(0.70, 0.14, 0.07)*pow(clamp(dot(rd, keyDir), 0.0, 1.0), 2.6)*0.75;
      c += vec3(0.40, 0.08, 0.05)*fres*0.55;
      c *= mix(0.55, 1.0, veins);
      c += heat*seams(p)*0.35*gWound;
    } else if(mat < 3.5){
      // Horn and claw: harder, paler, sharper highlight.
      // Old bone, not moulded plastic. The blue in the sky term was doing
      // all the damage: a cold fill on a light albedo reads as injection
      // moulding no matter how sharp the highlight on top of it is.
      c  = vec3(0.046, 0.039, 0.034)*(0.24 + kd*1.5)*occ;
      c += vec3(0.16, 0.17, 0.20)*sky*0.13;
      c += keyCol*pow(spe, 60.0)*0.55;
      c += vec3(0.85, 0.40, 0.20)*fres*0.22;
    } else {
      // Eyes and the open maw. Pure emission, and the only part of the model
      // allowed to clip white.
      c = heat*(2.4 + 4.0*uHit) + vec3(1.0, 0.85, 0.6)*0.5;
    }
    col = c;
  }

  col += heat*glow*(0.055 + 0.26*gWound + uHit*1.3);

  // The kill: one white frame, decaying as the corpse goes down.
  col += vec3(1.0, 0.92, 0.78)*exp(-uDeath*7.0)*step(0.0001, uDeath)*1.5;

  col = col/(1.0 + col);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));
  // Toe. Reinhard plus a gamma of 2.2 lifts near-black to a flat grey, and a
  // charred dragon that renders mid-grey is just a grey dragon.
  col = col*col*(3.0 - 2.0*col);
  col *= 1.0 - 0.44*pow(length(uv*vec2(0.60, 0.92)), 2.4);
  gl_FragColor = vec4(col, 1.0);
}
`;
