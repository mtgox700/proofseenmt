import type { FromWorker, Rgb, ToWorker } from "./field-gl";
import { gridSizeFor, parseHex, shouldAnimate } from "./field-math";

/*
 * Hero "field of answers", the ambient backdrop of the measuring room. Drawn entirely by a Worker on an OffscreenCanvas
 * (field.worker.ts): creating a WebGL2 context blocked the main thread for 90-440 ms when done here (measured 2026-09-19).
 * This thread does no per-frame work at all. Starts after idle, pauses off-screen and in hidden tabs, never runs with
 * reduced motion / Save-Data / weak or touch devices. The static poster stays underneath: nothing blocks the LCP.
 */

const INK_FALLBACK: Rgb = [0.06, 0.1, 0.18];
const PROOF_FALLBACK: Rgb = [0.04, 0.43, 0.33];
const MAX_DPR = 1.5;

/** Read on the field itself, so a section-level palette override would still be honoured. */
const cssColor = (el: Element, name: string, fallback: Rgb): Rgb => {
  const raw = getComputedStyle(el).getPropertyValue(name);
  const rgb = raw.trim().split(/\s+/).map(Number);
  if (rgb.length === 3 && rgb.every((n) => Number.isFinite(n))) return [rgb[0]! / 255, rgb[1]! / 255, rgb[2]! / 255];
  return parseHex(raw) ?? fallback;
};

const mount = (root: HTMLElement): void => {
  const canvas = root.querySelector("canvas");
  if (canvas === null) return;
  if (typeof canvas.transferControlToOffscreen !== "function") {
    root.dataset.field = "unsupported"; // no OffscreenCanvas: the static poster stays
    return;
  }

  const worker = new Worker(new URL("./field.worker.ts", import.meta.url), { type: "module" });
  const post = (message: ToWorker, transfer: Transferable[] = []): void => worker.postMessage(message, transfer);
  const offscreen = canvas.transferControlToOffscreen();
  post({ type: "init", canvas: offscreen, start: performance.timeOrigin + performance.now() }, [offscreen]);

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const resize = (): void => {
    const width = root.clientWidth;
    const { cols, rows } = gridSizeFor(width);
    post({ type: "resize", width, height: root.clientHeight, dpr, cols, rows });
  };
  // The site has a single dark palette: colours are read once.
  const colors = (): void => post({ type: "colors", ink: cssColor(root, "--field-dot", INK_FALLBACK), proof: cssColor(root, "--proof", PROOF_FALLBACK) });

  let visible = true;
  let stopped = false;
  const sync = (): void => post({ type: "run", running: visible && !stopped && !document.hidden });

  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  });
  // Teardown: no observer, listener or worker may outlive a failure. The static poster stays.
  const stop = (reason: "unsupported" | "lost"): void => {
    stopped = true;
    sync();
    resizeObserver.disconnect();
    intersection.disconnect();
    document.removeEventListener("visibilitychange", sync);
    worker.terminate();
    canvas.remove();
    root.dataset.field = reason;
  };

  worker.addEventListener("message", ({ data }: MessageEvent<FromWorker>) => {
    if (data.type === "ready") canvas.classList.add("is-live");
    else stop(data.type);
  });
  worker.addEventListener("error", () => stop("unsupported"));
  resizeObserver.observe(root);
  intersection.observe(root);
  document.addEventListener("visibilitychange", sync);
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
