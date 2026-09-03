"use client";

import { memo, useEffect, useRef, useState, type RefObject } from "react";
import type { Visuals } from "@/lib/raidState";

/**
 * The boss, raymarched.
 *
 * This is the only object on the page with real volume, and that is the whole
 * argument for spending a shader on it: a health bar is an abstraction, and
 * the thing the bar describes has to be present enough that draining it feels
 * like damage rather than like a progress indicator. A sprite could not do the
 * two things that matter — carry a continuous, non-quantised state, and react
 * on the same frame a hit lands.
 *
 * The model is a core mass with N necks folded into N angular sectors, so the
 * marcher evaluates one neck no matter how many heads the boss has and a boss
 * with nine heads costs the same as one with three. Health is read off the
 * body directly: `uHp * uHeads` is the fractional number of living heads, so
 * the outermost head withers and slumps as the bar drains and the creature is
 * a second, redundant copy of the health bar. That redundancy is deliberate —
 * on a muted autoplaying video the bar may be off-screen, and the silhouette
 * still says how far along the kill is.
 *
 * Colour carries the same signal a third time: the veins run teal at full
 * health and shift to arterial red as it dies.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uHp;     // 1 full, 0 dead
uniform float uHeads;
uniform float uHit;    // 1 on the frame of a hit, decaying
uniform float uDeath;  // 0..1 progress through the death sequence

#define SEG 5

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r){
  vec3 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}

float sdEllipsoid(vec3 p, vec3 r){
  float k0 = length(p/r);
  float k1 = length(p/(r*r));
  return k0*(k0-1.0)/k1;
}

/*
 * Folds every angular sector onto the +x wedge and hands back the sector
 * index, which is what lets one neck stand in for all of them while still
 * animating differently per head.
 */
float polarFold(inout vec3 p, float rep){
  float angle = 6.2831853/rep;
  float a = atan(p.z, p.x) + 3.14159265;
  float sector = floor(a/angle);
  float local = mod(a, angle) - angle*0.5;
  float r = length(p.xz);
  p.x = cos(local)*r;
  p.z = sin(local)*r;
  return sector;
}

/* A point along one neck. t runs 0 (shoulder) to 1 (head). */
vec3 neckPoint(float t, float phase, float life){
  float droop = 1.0 - life;
  float x = 0.50 + 1.45*sin(t*1.20);
  float y = 1.05 + 2.05*t - droop*(2.55*t*t);
  float sway  = sin(uTime*1.25 + phase + t*2.8)*life;
  float sway2 = cos(uTime*0.85 + phase*1.7 + t*2.0)*life;
  x += sway2*0.15*t;
  return vec3(x, y, sway*0.20*t);
}

float mapBody(vec3 p){
  float sink = smoothstep(0.04, 0.46, uDeath) * (1.0 - smoothstep(0.64, 0.99, uDeath));
  vec3 q = p;
  q.y += sink*2.9;

  float core = sdEllipsoid(q - vec3(0.0, 0.95, 0.0), vec3(1.06, 0.88, 1.06));
  core -= 0.028*sin(uTime*1.15);

  vec3 fp = q;
  float idx = polarFold(fp, uHeads);
  float phase = idx*2.3999;
  float life = clamp(uHp*uHeads - idx, 0.0, 1.0);

  float d = 1e9;
  for(int i=0;i<SEG;i++){
    float t0 = float(i)/float(SEG);
    float t1 = float(i+1)/float(SEG);
    float r = mix(0.30, 0.115, t0) * mix(0.60, 1.0, life);
    d = min(d, sdCapsule(fp, neckPoint(t0, phase, life), neckPoint(t1, phase, life), r));
  }

  vec3 tip = neckPoint(1.0, phase, life);
  float sc = mix(0.55, 1.0, life);
  float head  = sdEllipsoid(fp - tip, vec3(0.30, 0.21, 0.23)*sc);
  float snout = sdEllipsoid(fp - tip - vec3(0.26, -0.05, 0.0)*sc, vec3(0.20, 0.11, 0.11)*sc);
  head = smin(head, snout, 0.07);

  float body = smin(core, d, 0.30);
  body = smin(body, head, 0.09);

  // The hit ripple travels through the flesh rather than over it.
  body -= uHit*0.055*sin(length(q)*8.5 - uTime*15.0);
  return body;
}

vec3 normalAt(vec3 p){
  vec2 e = vec2(0.0016, 0.0);
  return normalize(vec3(
    mapBody(p+e.xyy) - mapBody(p-e.xyy),
    mapBody(p+e.yxy) - mapBody(p-e.yxy),
    mapBody(p+e.yyx) - mapBody(p-e.yyx)
  ));
}

float ao(vec3 p, vec3 n){
  float occ = 0.0, sca = 1.0;
  for(int i=0;i<5;i++){
    float h = 0.02 + 0.13*float(i);
    occ += (h - mapBody(p + n*h))*sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 1.5*occ, 0.0, 1.0);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;

  float ang = uTime*0.055;
  vec3 ro = vec3(sin(ang)*7.4, 2.75, cos(ang)*7.4);
  vec3 ta = vec3(0.0, 1.62, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0,1.0,0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x*uu + uv.y*vv + 1.65*ww);

  // Health drives hue everywhere: teal while it is strong, arterial as it goes.
  float wound = 1.0 - uHp;
  vec3 vital = mix(vec3(0.16, 0.92, 0.62), vec3(1.0, 0.20, 0.34), wound);

  /* Background: a lit haze above the stage, black everywhere else. */
  vec3 col = mix(vec3(0.012,0.020,0.030), vec3(0.045,0.070,0.098),
                 smoothstep(-0.45, 0.75, uv.y));
  col += vital*0.055*exp(-length(uv - vec2(0.0, 0.16))*2.6);

  /* Ground, intersected analytically — cheaper and flatter than marching it. */
  float tp = rd.y < -0.0001 ? (-0.02 - ro.y)/rd.y : -1.0;

  /* Body. */
  float t = 0.6, hit = 0.0, glow = 0.0;
  for(int i=0;i<108;i++){
    vec3 p = ro + rd*t;
    float h = mapBody(p);
    glow += exp(-abs(h)*3.2)*0.011;
    if(h < 0.0018*t){ hit = 1.0; break; }
    t += h*0.78;
    if(t > 22.0) break;
  }

  if(tp > 0.0 && (hit < 0.5 || tp < t)){
    vec3 pw = ro + rd*tp;
    float r = length(pw.xz);
    // Pooled light under the beast, plus the arena's concentric scoring.
    float pool = exp(-r*0.42)*0.5;
    float rings = smoothstep(0.86, 1.0, abs(sin(r*2.1)))*0.045*exp(-r*0.22);
    // A hit throws a ring out across the floor. This is the shot that reads
    // in a clip even when the creature is off-frame.
    float wave = uHit*exp(-abs(r - (1.0 - uHit)*11.0)*1.7);
    vec3 g = vec3(0.02,0.030,0.042)*exp(-r*0.16);
    g += vital*(pool*0.55 + wave*0.85) + vec3(0.30,0.45,0.55)*rings;
    col = mix(col, g, exp(-r*0.055));
  }

  if(hit > 0.5){
    vec3 p = ro + rd*t;
    vec3 n = normalAt(p);
    float occ = ao(p, n);

    vec3 key = normalize(vec3(0.35, 0.92, 0.30));
    float kd = clamp(dot(n, key), 0.0, 1.0);
    float back = clamp(dot(n, normalize(vec3(-0.5, 0.25, -0.8))), 0.0, 1.0);
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.2);

    // Hide the sector seams in the scale pattern rather than pretending the
    // folded field is continuous.
    float scales = 0.5 + 0.5*sin(p.y*26.0 + sin(p.x*17.0)*1.6 + sin(p.z*15.0)*1.2);
    vec3 skin = mix(vec3(0.018,0.042,0.038), vec3(0.055,0.105,0.095), scales);

    vec3 c = skin*(0.16 + 0.95*kd)*occ;
    c += vec3(0.10,0.20,0.26)*back*0.5*occ;
    c += mix(vec3(0.35,0.80,0.70), vital, 0.55)*fres*0.85;

    // Veins. Tight bands of light between the plates, brighter as it weakens.
    float vein = pow(abs(sin(p.y*3.6 + p.x*1.8 + uTime*0.55)), 20.0);
    c += vital*vein*(0.35 + 1.5*wound)*occ;
    c += vital*uHit*(0.55 + fres*2.2);

    col = mix(col, c, 1.0);
  }

  col += vital*glow*(0.5 + 0.9*wound + uHit*2.2);

  // Death: a white burst on the frame it dies, decaying as the corpse sinks.
  col += vec3(1.0, 0.92, 0.80)*exp(-uDeath*7.0)*step(0.0001, uDeath)*1.6;

  col = col/(1.0 + col);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));
  // Vignette, so the stage falls off into the page rather than ending at it.
  col *= 1.0 - 0.42*pow(length(uv*vec2(0.62, 0.92)), 2.4);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const BossCanvas = memo(function BossCanvas({
  visuals,
}: {
  visuals: RefObject<Visuals>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      setFailed(true);
      return;
    }

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) {
      setFailed(true);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      setFailed(true);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uHp = gl.getUniformLocation(program, "uHp");
    const uHeads = gl.getUniformLocation(program, "uHeads");
    const uHit = gl.getUniformLocation(program, "uHit");
    const uDeath = gl.getUniformLocation(program, "uDeath");

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    /*
     * Quality is chosen from measured frame time rather than from a device
     * string. The shader is the only expensive thing on the page, so if it
     * cannot hold 60fps the honest move is to march fewer pixels — the model
     * is unchanged, it is just softer.
     */
    let scale = reduced ? 0.7 : 1.0;
    let frames = 0;
    let sampleStart = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uRes, width, height);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Smoothed copies of the shared state. The provider writes step changes;
    // these ease them so the creature never snaps between two poses.
    let hp = visuals.current.hp;
    let heads = visuals.current.heads;
    let pulse = 0;
    let lastHitSeq = visuals.current.hitSeq;
    let deathStart = -1;
    let lastDeathSeq = visuals.current.deathSeq;

    let raf = 0;
    let last = performance.now();
    const start = last;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const box = visuals.current;
      if (box.hitSeq !== lastHitSeq) {
        lastHitSeq = box.hitSeq;
        pulse = 1;
      }
      if (box.deathSeq !== lastDeathSeq) {
        lastDeathSeq = box.deathSeq;
        deathStart = now;
      }

      pulse = Math.max(0, pulse - dt * 2.6);
      hp += (box.hp - hp) * Math.min(1, dt * 7);
      heads += (box.heads - heads) * Math.min(1, dt * 3);

      let death = 0;
      if (deathStart >= 0) {
        death = (now - deathStart) / 3200;
        if (death >= 1) {
          death = 0;
          deathStart = -1;
        }
      }

      gl.uniform1f(uTime, reduced ? 12 : (now - start) / 1000);
      gl.uniform1f(uHp, hp);
      gl.uniform1f(uHeads, Math.max(3, heads));
      gl.uniform1f(uHit, pulse * pulse);
      gl.uniform1f(uDeath, death);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Sample once a second and step the resolution down if we are missing.
      frames += 1;
      if (sampleStart === 0) sampleStart = now;
      if (now - sampleStart > 1000) {
        const fps = (frames * 1000) / (now - sampleStart);
        if (fps < 34 && scale > 0.5) {
          scale = Math.max(0.5, scale - 0.2);
          resize();
        }
        frames = 0;
        sampleStart = now;
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
    };
  }, [visuals]);

  if (failed) {
    // No WebGL. The page still has a boss, a bar and a pot; it just loses the
    // volume. Better than an empty stage or a spinner that never resolves.
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          aria-hidden
          className="h-64 w-64 rounded-full opacity-70 blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(53,224,176,0.55), rgba(255,58,94,0.18) 55%, transparent 72%)",
          }}
        />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
    />
  );
});
