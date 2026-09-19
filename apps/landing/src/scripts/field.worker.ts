import { createRenderer, type FromWorker, type Renderer, type ToWorker } from "./field-gl";

/*
 * Off-main-thread renderer of the hero field. Context creation, shader compilation and every draw happen here, so the
 * page stays responsive whatever the GPU driver does. Typed structurally: the landing compiles against the DOM lib only.
 */
interface WorkerScope {
  postMessage(message: FromWorker): void;
  addEventListener(type: "message", listener: (event: MessageEvent<ToWorker>) => void): void;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
}
const scope = self as unknown as WorkerScope;

const FRAME_MS = 16;
const nextFrame = (callback: () => void): void => {
  if (typeof scope.requestAnimationFrame === "function") scope.requestAnimationFrame(callback);
  else setTimeout(callback, FRAME_MS);
};

let renderer: Renderer | null = null;
let start = 0;
let running = false;
let scheduled = false;
let announced = false;

const tick = (): void => {
  scheduled = false;
  if (!running || renderer === null) return;
  const drew = renderer.draw((performance.timeOrigin + performance.now() - start) / 1000);
  if (drew && !announced) {
    announced = true;
    scope.postMessage({ type: "ready" });
  }
  schedule();
};

const schedule = (): void => {
  if (scheduled || !running) return;
  scheduled = true;
  nextFrame(tick);
};

const init = (canvas: OffscreenCanvas, startAt: number): void => {
  start = startAt;
  // failIfMajorPerformanceCaveat: no field on software rendering (no GPU, VM, remote desktop, blocklisted driver).
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: true, powerPreference: "low-power", premultipliedAlpha: true, failIfMajorPerformanceCaveat: true });
  renderer = gl === null ? null : createRenderer(gl);
  if (renderer === null) {
    scope.postMessage({ type: "unsupported" });
    return;
  }
  canvas.addEventListener("webglcontextlost", () => {
    running = false;
    renderer = null;
    scope.postMessage({ type: "lost" });
  });
};

// Invariant: messages are handled in FIFO order and init() is synchronous, so resize/colors/run always find the renderer
// ready. They are dropped only when init failed, and then "unsupported" has already been posted and the page tears down.
scope.addEventListener("message", ({ data }) => {
  switch (data.type) {
    case "init":
      init(data.canvas, data.start);
      break;
    case "resize":
      renderer?.resize(data.width, data.height, data.dpr, data.cols, data.rows);
      break;
    case "colors":
      renderer?.colors(data.ink, data.proof);
      break;
    case "run":
      running = data.running && renderer !== null;
      schedule();
      break;
  }
});
