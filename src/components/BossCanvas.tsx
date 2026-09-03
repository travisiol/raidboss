"use client";

import { memo, useEffect, useRef, useState, type RefObject } from "react";
import type { Visuals } from "@/lib/raidState";
import { DRAGON_FRAG, DRAGON_VERT } from "@/lib/dragonShader";

/**
 * The dragon, raymarched.
 *
 * This is the only object on the page with real volume, and that is the whole
 * argument for spending a shader on it: a health bar is an abstraction, and
 * the thing it describes has to be present enough that draining it feels like
 * damage rather than like a progress indicator. The two things a sprite cannot
 * do are the two that matter — carry a continuous, non-quantised state, and
 * react on the same frame a hit lands.
 *
 * It is a signed-distance field: a charred, armour-plated body with molten
 * rock in the seams, a horned skull with a hinged jaw, and membrane wings
 * built as thin triangles stretched between finger bones. No model file, no
 * 3D library.
 *
 * Health is legible off the body itself, three ways over:
 *
 *   POSTURE  the head sinks, the wings sag and fold as the bar drains
 *   HEAT     the seams run dull ember at full health and white-hot at death
 *   WINGS    the membranes tatter, holes opening as it weakens
 *
 * That redundancy is deliberate. On a muted autoplaying clip the bar may be
 * off-screen, and the silhouette still says how far along the kill is.
 *
 * ---- The budget --------------------------------------------------------
 *
 * A first draft modelled far more of the animal and never rendered a frame:
 * linking succeeded, then the first `drawArrays` never returned. ANGLE
 * compiles this to HLSL and hands it to fxc, and fxc will sit for minutes on
 * a distance function that gets inlined into eight call sites with loops and
 * nested branches inside each. The binding constraint on a shader like this
 * is the *compiler*, not the GPU, and the only reliable lever is total
 * inlined instruction count.
 *
 * So: no loops in the distance function, everything hand-unrolled, the pose
 * trigonometry hoisted into globals and solved once per pixel instead of once
 * per sample, ambient occlusion dropped for a hemisphere term that costs one
 * multiply, and the exact round-cone distance replaced by a corrected
 * approximation (see `sdTaper`). Four bounding spheres keep the runtime cost
 * down on top of that, and the resolution below is tuned from measured frame
 * time, so a weak GPU gets a soft image rather than a stalled one.
 *
 * As built: eighteen tapered capsules, seven ellipsoids, three triangles,
 * four bounding tests, five call sites.
 */


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

/*
 * Pixels marched before the first frame-time measurement comes back.
 *
 * Deliberately small. The cost of one frame here spans two orders of
 * magnitude across the machines this will run on, and the failure mode of
 * guessing high is not a dropped frame — it is a compositor that stops
 * answering for several seconds on the very first paint. Guessing low costs a
 * soft second and a half while the loop below walks it up.
 */
const FIRST_FRAME_PIXELS = 260_000;
const MIN_PIXELS = 18_000;
const MAX_PIXELS = 1_100_000;

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

    const vert = compile(gl, gl.VERTEX_SHADER, DRAGON_VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, DRAGON_FRAG);
    if (!vert || !frag) {
      setFailed(true);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    /*
     * Do not ask whether the link succeeded yet.
     *
     * ANGLE translates this to HLSL and hands it to fxc, which takes about two
     * seconds on it — and `getProgramParameter(LINK_STATUS)` blocks until that
     * finishes, on the main thread, while the rest of the page is trying to be
     * interactive. `KHR_parallel_shader_compile` exists precisely so the
     * question can be asked without blocking: poll COMPLETION_STATUS_KHR, and
     * only read LINK_STATUS once the driver says it is done.
     *
     * Where the extension is missing this falls back to the blocking read, so
     * the behaviour is no worse than not trying.
     */
    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    let cancelled = false;
    let poll = 0;

    const whenLinked = (then: () => void) => {
      if (cancelled) return;
      if (
        parallel &&
        !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)
      ) {
        poll = window.setTimeout(() => whenLinked(then), 24);
        return;
      }
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        setFailed(true);
        return;
      }
      then();
    };

    const start = (): (() => void) => {
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
    const uTier = gl.getUniformLocation(program, "uTier");
    const uHit = gl.getUniformLocation(program, "uHit");
    const uDeath = gl.getUniformLocation(program, "uDeath");

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    /*
     * Resolution is measured, not guessed. The first frame is deliberately
     * small — a laptop that cannot afford this shader must not discover that
     * by locking its own compositor — and from there the loop walks the pixel
     * count toward whatever holds sixty, in both directions.
     */
    let budget = FIRST_FRAME_PIXELS;
    /* Frame intervals, in ms, for the resolution controller below. */
    const deltas: number[] = [];

    const resize = () => {
      const cssW = Math.max(1, canvas.clientWidth);
      const cssH = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const scale = Math.sqrt(Math.min(1, budget / (cssW * cssH * dpr * dpr)));
      const width = Math.max(1, Math.round(cssW * dpr * scale));
      const height = Math.max(1, Math.round(cssH * dpr * scale));
      // Only reallocate when the size actually moved — assigning width or
      // height reallocates and clears the drawing buffer even if the value is
      // unchanged. The viewport and the uniform, though, are set every time:
      // uniforms belong to the program, not the context, so a remount that
      // reuses a same-sized canvas would otherwise leave the new program's
      // uRes at (0, 0) and every pixel would divide by zero.
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uRes, width, height);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Smoothed copies of the shared state. The provider writes step changes;
    // these ease them so the dragon never snaps between two poses.
    let hp = visuals.current.hp;
    let tier = visuals.current.tier;
    let pulse = 0;
    let lastHitSeq = visuals.current.hitSeq;
    let deathStart = -1;
    let lastDeathSeq = visuals.current.deathSeq;

    let raf = 0;
    let last = performance.now();
    let previous = last;
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

      pulse = Math.max(0, pulse - dt * 2.4);
      hp += (box.hp - hp) * Math.min(1, dt * 7);
      tier += (box.tier - tier) * Math.min(1, dt * 2);

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
      gl.uniform1f(uTier, tier);
      gl.uniform1f(uHit, pulse * pulse);
      gl.uniform1f(uDeath, death);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      /*
       * ---- Resolution ---------------------------------------------------
       *
       * Cost is measured as the *median interval between frames*, not as a
       * count of frames over a window, and intervals longer than a fifth of a
       * second are thrown away before the median is taken.
       *
       * That distinction is the whole controller. Counting frames over wall
       * time cannot tell a slow GPU from a throttled one: a backgrounded tab
       * or an occluded window keeps the clock running while rAF stops, the
       * window reads as two frames per second, and the render collapses to a
       * hundred and sixty pixels wide and stays there until the page is
       * reloaded. Intervals do tell them apart — a slow GPU produces long but
       * *regular* gaps, throttling produces a handful of enormous ones — and
       * a median ignores the one-off hitch that a mean would chase.
       */
      const gap = now - previous;
      previous = now;
      if (gap > 4 && gap < 200) deltas.push(gap);

      if (deltas.length >= 14) {
        deltas.sort((a, b) => a - b);
        const fps = 1000 / deltas[deltas.length >> 1];
        deltas.length = 0;
        const before = budget;
        /*
         * The target is thirty, not sixty. This is a boss standing in place
         * breathing; nothing in the model moves fast enough for the extra
         * frames to read, and dropping the target buys four times the pixels,
         * which is the difference between a sharp dragon and a blurry one.
         *
         * Corrections scale toward the target rather than stepping by a fixed
         * factor, so a machine running at four frames a second comes down an
         * order of magnitude at once instead of over several seconds.
         */
        if (fps < 26) {
          budget = Math.max(MIN_PIXELS, budget * Math.max(0.2, fps / 30));
        } else if (fps > 40) {
          budget = Math.min(MAX_PIXELS, budget * 1.5);
        }
        if (budget !== before) resize();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Coming back from a hidden tab throws away whatever partial sample was
    // collected on the way out, and re-bases the clock so the first frame
    // back is not treated as one enormous interval.
    const onVisible = () => {
      deltas.length = 0;
      last = performance.now();
      previous = last;
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      gl.deleteBuffer(buffer);
    };
    };

    let teardown = () => {};
    whenLinked(() => {
      teardown = start();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(poll);
      teardown();
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [visuals]);

  if (failed) {
    // No WebGL. The page still has a boss, a bar and a pot; it just loses the
    // volume. Better than an empty stage or a spinner that never resolves.
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          aria-hidden
          className="h-72 w-72 rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,120,40,0.55), rgba(255,58,94,0.20) 55%, transparent 72%)",
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
