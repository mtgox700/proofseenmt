import type { FromWorker, Rgb, ToWorker } from "./field-gl";
import { buildGrid, gridSizeFor, parseHex, project, reveal, shouldAnimate, targetNode, toPixels } from "./field-math";

/*
 * Hero "field of answers". The WebGL2 field is drawn by a Worker on an OffscreenCanvas (field.worker.ts): creating a
 * WebGL2 context blocked the main thread for 90-440 ms when done here (measured 2026-09-19). This thread only moves the
 * DOM bracket (one composited transform per frame). Starts after idle, pauses off-screen and in hidden tabs, never runs
 * with reduced motion / Save-Data / weak or touch devices. The static poster stays underneath: nothing blocks the LCP.
 */

const INK_FALLBACK: Rgb = [0.06, 0.1, 0.18];
const PROOF_FALLBACK: Rgb = [0.04, 0.43, 0.33];
const MAX_DPR = 1.5;

const cssColor = (name: string, fallback: Rgb): Rgb => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const rgb = raw.trim().split(/\s+/).map(Number);
  if (rgb.length === 3 && rgb.every((n) => Number.isFinite(n))) return [rgb[0]! / 255, rgb[1]! / 255, rgb[2]! / 255];
  return parseHex(raw) ?? fallback;
};

const mount = (root: HTMLElement): void => {
  const canvas = root.querySelector("canvas");
  const bracket = root.querySelector<HTMLElement>(".bracket");
  if (canvas === null || bracket === null) return;
  if (typeof canvas.transferControlToOffscreen !== "function") {
    root.dataset.field = "unsupported"; // no OffscreenCanvas: the static poster and CSS signal stay
    return;
  }

  const worker = new Worker(new URL("./field.worker.ts", import.meta.url), { type: "module" });
  const post = (message: ToWorker, transfer: Transferable[] = []): void => worker.postMessage(message, transfer);
  const offscreen = canvas.transferControlToOffscreen();
  const startLocal = performance.now();
  post({ type: "init", canvas: offscreen, start: performance.timeOrigin + startLocal }, [offscreen]);

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  let width = 0;
  let height = 0;
  let target = { x: 0, y: 0 };
  const resize = (): void => {
    width = root.clientWidth;
    height = root.clientHeight;
    const { cols, rows } = gridSizeFor(width);
    target = targetNode(buildGrid(cols, rows));
    post({ type: "resize", width, height, dpr, cols, rows });
  };
  const colors = (): void => post({ type: "colors", ink: cssColor("--field-dot", INK_FALLBACK), proof: cssColor("--proof", PROOF_FALLBACK) });

  let visible = true;
  let live = false;
  let stopped = false;
  let frame = 0;
  const moveBracket = (now: number): void => {
    const t = (now - startLocal) / 1000;
    const px = toPixels(project(target.x, target.y, t, Math.max(1, width) / Math.max(1, height)), width, height);
    bracket.style.transform = `translate3d(${px.x.toFixed(1)}px, ${px.y.toFixed(1)}px, 0)`;
    bracket.style.opacity = String(reveal(t));
    frame = requestAnimationFrame(moveBracket);
  };
  const sync = (): void => {
    const running = visible && !stopped && !document.hidden;
    post({ type: "run", running });
    if (running && live && frame === 0) frame = requestAnimationFrame(moveBracket);
    if (!running && frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  });
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  // Teardown: no observer, listener, frame or worker may outlive a failure. The CSS signal takes over.
  const stop = (reason: "unsupported" | "lost"): void => {
    stopped = true;
    sync();
    resizeObserver.disconnect();
    intersection.disconnect();
    document.removeEventListener("visibilitychange", sync);
    scheme.removeEventListener("change", colors);
    worker.terminate();
    canvas.remove();
    bracket.style.opacity = "0";
    root.dataset.field = reason;
  };

  worker.addEventListener("message", ({ data }: MessageEvent<FromWorker>) => {
    if (data.type === "ready") {
      live = true;
      canvas.classList.add("is-live");
      sync();
    } else stop(data.type);
  });
  worker.addEventListener("error", () => stop("unsupported"));
  resizeObserver.observe(root);
  intersection.observe(root);
  document.addEventListener("visibilitychange", sync);
  scheme.addEventListener("change", colors);
  resize();
  colors();
  sync();
};

const boot = (): void => {
  const root = document.querySelector<HTMLElement>("[data-field]");
  if (root === null) return;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  const ok = shouldAnimate({
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: nav.connection?.saveData === true,
    // No probe context: creating a WebGL context is expensive. The worker reports "unsupported" if the real one fails.
    webgl2: typeof WebGL2RenderingContext !== "undefined",
    cores: navigator.hardwareConcurrency ?? 4,
    width: window.innerWidth,
    finePointer: matchMedia("(pointer: fine)").matches,
  });
  if (ok) mount(root);
};

const whenIdle = (fn: () => void): void => {
  if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: 2500 });
  else setTimeout(fn, 1200);
};

if (document.readyState === "complete") whenIdle(boot);
else window.addEventListener("load", () => whenIdle(boot), { once: true });
