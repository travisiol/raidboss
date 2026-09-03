"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DRAGON_FRAG, DRAGON_VERT } from "@/lib/dragonShader";

/**
 * The shader bench.
 *
 * Not part of the site — a tuning surface for the one file on it whose cost
 * cannot be reasoned about, only measured. It renders exactly one frame per
 * click, blocks on `gl.finish()` and prints the wall time, which is the only
 * honest number available in WebGL 1 without timer queries.
 *
 * Rendering a single frame rather than running a loop is the whole point: an
 * animating canvas never lets the page go idle, and a page that never goes
 * idle cannot be screenshotted or profiled. One frame, one still image, one
 * number.
 */

type Uniforms = {
  time: number;
  hp: number;
  tier: number;
  hit: number;
  death: number;
};

const DEFAULTS: Uniforms = { time: 6, hp: 0.58, tier: 0.5, hit: 0, death: 0 };

const SIZES = [
  { label: "160×105", w: 160, h: 105 },
  { label: "320×210", w: 320, h: 210 },
  { label: "480×315", w: 480, h: 315 },
  { label: "640×420", w: 640, h: 420 },
  { label: "960×630", w: 960, h: 630 },
];

export default function Lab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [size, setSize] = useState(2);
  const [uniforms, setUniforms] = useState<Uniforms>(DEFAULTS);

  const say = useCallback((line: string) => {
    setLog((current) => [line, ...current].slice(0, 12));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || glRef.current) return;

    const t0 = performance.now();
    // preserveDrawingBuffer so a single frame survives long enough to be
    // looked at. The live canvas cannot afford this; a bench can.
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      say("no webgl");
      return;
    }

    const make = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        say("COMPILE: " + gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };

    const vert = make(gl.VERTEX_SHADER, DRAGON_VERT);
    const frag = make(gl.FRAGMENT_SHADER, DRAGON_FRAG);
    if (!vert || !frag) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      say("LINK: " + gl.getProgramInfoLog(program));
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

    glRef.current = gl;
    progRef.current = program;
    say(`compile+link ${Math.round(performance.now() - t0)}ms`);

    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) say(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)));
  }, [say]);

  const render = useCallback(() => {
    const gl = glRef.current;
    const program = progRef.current;
    const canvas = canvasRef.current;
    if (!gl || !program || !canvas) return;

    const { w, h } = SIZES[size];
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);

    const set = (name: string, ...values: number[]) => {
      const location = gl.getUniformLocation(program, name);
      if (values.length === 2) gl.uniform2f(location, values[0], values[1]);
      else gl.uniform1f(location, values[0]);
    };
    set("uRes", w, h);
    set("uTime", uniforms.time);
    set("uHp", uniforms.hp);
    set("uTier", uniforms.tier);
    set("uHit", uniforms.hit);
    set("uDeath", uniforms.death);

    /*
     * Warm the pipeline first: the draw after a link pays for the driver's own
     * D3D compilation and says nothing about the shader.
     *
     * Then time a burst, and end it with a one-pixel readback rather than
     * `gl.finish()`. Under ANGLE, finish does not reliably block until the GPU
     * is idle — a timed draw followed by finish reports 0.0ms and infinite
     * frames per second — but `readPixels` has to produce a value, so it
     * cannot return before the queue in front of it has drained.
     */
    const sync = new Uint8Array(4);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sync);

    const BURST = 12;
    const t0 = performance.now();
    for (let i = 0; i < BURST; i += 1) gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sync);
    const ms = (performance.now() - t0) / BURST;

    const px = w * h;
    say(
      `${w}×${h} (${(px / 1000).toFixed(0)}k px) — ${ms.toFixed(1)}ms — ` +
        `${(1000 / ms).toFixed(1)}fps — ${((ms * 1e6) / px).toFixed(0)}ns/px`,
    );
  }, [size, uniforms, say]);

  // One automatic frame on load so a screenshot alone is a complete report.
  useEffect(() => {
    const id = window.setTimeout(render, 200);
    return () => window.clearTimeout(id);
  }, [render]);

  const field = (
    key: keyof Uniforms,
    min: number,
    max: number,
    step: number,
  ) => (
    <label key={key} style={{ display: "block", marginBottom: 6 }}>
      <span style={{ display: "inline-block", width: 52 }}>{key}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={uniforms[key]}
        onChange={(event) =>
          setUniforms((current) => ({
            ...current,
            [key]: Number(event.target.value),
          }))
        }
        style={{ width: 180, verticalAlign: "middle" }}
      />
      <span style={{ marginLeft: 8 }}>{uniforms[key].toFixed(2)}</span>
    </label>
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        padding: 20,
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        color: "#e9eef2",
        background: "#04060a",
        minHeight: "100vh",
        flexWrap: "wrap",
      }}
    >
      <div>
        <canvas
          ref={canvasRef}
          style={{
            width: 640,
            maxWidth: "100%",
            border: "1px solid #253040",
            imageRendering: "auto",
            display: "block",
          }}
        />
      </div>

      <div style={{ minWidth: 300 }}>
        <div style={{ marginBottom: 12 }}>
          {SIZES.map((option, index) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setSize(index)}
              style={{
                marginRight: 6,
                marginBottom: 6,
                padding: "4px 8px",
                background: index === size ? "#aef23f" : "transparent",
                color: index === size ? "#04060a" : "#97a5b2",
                border: "1px solid #253040",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {field("time", 0, 40, 0.5)}
        {field("hp", 0, 1, 0.01)}
        {field("tier", 0, 1, 0.05)}
        {field("hit", 0, 1, 0.05)}
        {field("death", 0, 1, 0.02)}

        <button
          type="button"
          onClick={render}
          style={{
            marginTop: 8,
            padding: "8px 14px",
            background: "#aef23f",
            color: "#04060a",
            border: 0,
            cursor: "pointer",
            font: "inherit",
            fontWeight: 700,
          }}
        >
          RENDER ONE FRAME
        </button>

        <pre
          style={{
            marginTop: 14,
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
            color: "#97a5b2",
          }}
        >
          {log.join("\n")}
        </pre>
      </div>
    </div>
  );
}
