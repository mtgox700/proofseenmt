import { buildGrid, reveal, targetNode, type Grid } from "./field-math";

/*
 * The WebGL2 renderer of the hero field. It runs inside a Worker on an OffscreenCanvas (see field.worker.ts): measured on
 * 2026-09-19, creating a WebGL2 context is a synchronous native call that blocked the main thread for 90-440 ms.
 */

const VERTEX = `#version 300 es
in vec2 a_grid;
uniform float u_time, u_aspect, u_dpr, u_reveal;
uniform vec2 u_target;
out float v_depth;
out float v_target;
float waveZ(vec2 p, float t) { return sin(p.x * 3.1 + t * 0.55) * 0.07 + cos(p.y * 4.3 + t * 0.4) * 0.05; }
void main() {
  float z = waveZ(a_grid, u_time);
  float depth = 1.0 + (a_grid.y + 1.0) * 0.22;
  float spread = u_aspect >= 1.0 ? 1.08 : 1.25 / u_aspect;
  gl_Position = vec4((a_grid.x * spread) / depth, a_grid.y * 0.62 + z * 0.9 - 0.08, 0.0, 1.0);
  v_target = step(distance(a_grid, u_target), 0.0001);
  v_depth = clamp(0.5 + z * 5.0, 0.0, 1.0);
  gl_PointSize = u_dpr * (mix(1.4, 2.6, v_depth) / depth + v_target * u_reveal * 7.0);
}`;

// highp: a uniform shared by both stages (u_reveal) must have the same precision, or the program fails to link.
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 u_ink, u_proof;
uniform float u_reveal;
in float v_depth;
in float v_target;
out vec4 color;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float edge = smoothstep(0.5, 0.35, d);
  vec3 rgb = mix(u_ink, u_proof, v_target * u_reveal);
  float alpha = mix(0.10 + v_depth * 0.22, 0.95, v_target * u_reveal) * edge;
  color = vec4(rgb * alpha, alpha);
}`;

export type Rgb = readonly [number, number, number];

export interface Renderer {
  readonly resize: (width: number, height: number, dpr: number, cols: number, rows: number) => void;
  readonly colors: (ink: Rgb, proof: Rgb) => void;
  /** Returns false until a size is known (nothing drawn). */
  readonly draw: (t: number) => boolean;
}

/** Main thread → worker. `start` is an absolute time (timeOrigin + now) so both threads share one clock. */
export type ToWorker =
  | { readonly type: "init"; readonly canvas: OffscreenCanvas; readonly start: number }
  | { readonly type: "resize"; readonly width: number; readonly height: number; readonly dpr: number; readonly cols: number; readonly rows: number }
  | { readonly type: "colors"; readonly ink: Rgb; readonly proof: Rgb }
  | { readonly type: "run"; readonly running: boolean };

/** Worker → main thread. */
export type FromWorker = { readonly type: "ready" } | { readonly type: "unsupported" } | { readonly type: "lost" };

const link = (gl: WebGL2RenderingContext): WebGLProgram | null => {
  const p = gl.createProgram();
  const shaders = [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ].map(([type, source]) => {
    const s = gl.createShader(type as number);
    if (s !== null) {
      gl.shaderSource(s, source as string);
      gl.compileShader(s);
      gl.attachShader(p, s);
    }
    return s;
  });
  gl.linkProgram(p);
  shaders.forEach((s) => gl.deleteShader(s)); // flagged; freed with the program
  if (gl.getProgramParameter(p, gl.LINK_STATUS) === true) return p;
  gl.deleteProgram(p);
  return null;
};

/** Returns null when the program cannot be linked: the caller keeps the static poster. */
export const createRenderer = (gl: WebGL2RenderingContext): Renderer | null => {
  const prog = link(gl);
  if (prog === null) return null;
  gl.useProgram(prog);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const loc = gl.getAttribLocation(prog, "a_grid");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const u = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(prog, name);
  const uTime = u("u_time"), uAspect = u("u_aspect"), uDpr = u("u_dpr"), uReveal = u("u_reveal");
  const uTarget = u("u_target"), uInk = u("u_ink"), uProof = u("u_proof");

  let grid: Grid | null = null;
  let aspect = 1;
  return {
    resize: (width, height, dpr, cols, rows) => {
      const canvas = gl.canvas;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uDpr, dpr);
      aspect = Math.max(1, width) / Math.max(1, height);
      if (grid?.cols !== cols || grid.rows !== rows) {
        grid = buildGrid(cols, rows);
        gl.bufferData(gl.ARRAY_BUFFER, grid.positions, gl.STATIC_DRAW);
        const target = targetNode(grid);
        gl.uniform2f(uTarget, target.x, target.y);
      }
    },
    colors: (ink, proof) => {
      gl.uniform3fv(uInk, ink);
      gl.uniform3fv(uProof, proof);
    },
    draw: (t) => {
      if (grid === null) return false;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uAspect, aspect);
      gl.uniform1f(uReveal, reveal(t));
      gl.drawArrays(gl.POINTS, 0, grid.cols * grid.rows);
      return true;
    },
  };
};
