import { POOL, RUNS, hitsUpTo, pct, shortlist, wilson } from "./sim-math";

/*
 * Replays the hero simulator: the recruiter's request types itself, then answer after answer the top 5 changes, a dot is
 * added to the tally and the confidence interval tightens. A handful of text/class updates per second, transforms only
 * for motion. Never runs with reduced motion or Save-Data (the server render already shows the final state), pauses
 * off-screen and in hidden tabs.
 */

const TYPE_MS = 26;
const ANSWER_MS = 900;
const SWAP_MS = 180;
const HOLD_MS = 5200;
const START_MS = 700;

const start = (root: HTMLElement): void => {
  const q = <T extends Element>(sel: string): T | null => root.querySelector<T>(sel);
  const typed = q<HTMLElement>("[data-sim-typed]");
  const rest = q<HTMLElement>("[data-sim-rest]");
  const runEl = q<HTMLElement>("[data-sim-run]");
  const list = q<HTMLOListElement>("[data-sim-list]");
  const cells = [...root.querySelectorAll<HTMLLIElement>("[data-sim-tally] li")];
  const pEl = q<HTMLElement>("[data-sim-p]");
  const ciEl = q<HTMLElement>("[data-sim-ci]");
  const track = q<HTMLElement>("[data-sim-track]");
  const rows = list === null ? [] : [...list.querySelectorAll<HTMLLIElement>("li")];
  if (typed === null || rest === null || runEl === null || list === null || pEl === null || ciEl === null || track === null) return;
  if (rows.length !== 5 || cells.length !== RUNS.length) return;
  const you = root.dataset.you ?? "";
  const unit = root.dataset.unit ?? "%";
  const prompt = typed.textContent ?? "";

  let visible = false;
  let parked: (() => void)[] = [];
  const running = (): boolean => visible && !document.hidden;
  /** Resolves after `ms`, but only once the simulator is on screen again. */
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(() => (running() ? resolve() : parked.push(resolve)), ms);
    });
  const wake = (): void => {
    if (!running()) return;
    const ready = parked;
    parked = [];
    ready.forEach((resolve) => resolve());
  };
  if (typeof IntersectionObserver === "undefined") visible = true; // never freeze the replay on old engines
  else
    new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      wake();
    }).observe(root);
  document.addEventListener("visibilitychange", wake);

  const estimate = (count: number): void => {
    if (count === 0) {
      pEl.textContent = "–";
      ciEl.textContent = "";
      track.style.setProperty("--p", "0");
      track.style.setProperty("--lo", "0");
      track.style.setProperty("--hi", "1");
      return;
    }
    const ci = wilson(hitsUpTo(count), count);
    pEl.textContent = `${pct(ci.p)}${unit}`;
    ciEl.textContent = `[${pct(ci.lo)}–${pct(ci.hi)}${unit}]`;
    track.style.setProperty("--p", ci.p.toFixed(3));
    track.style.setProperty("--lo", ci.lo.toFixed(3));
    track.style.setProperty("--hi", ci.hi.toFixed(3));
  };

  const show = async (run: number): Promise<void> => {
    list.classList.add("is-swapping");
    await wait(SWAP_MS);
    shortlist(run).forEach((idx, i) => {
      const row = rows[i]!;
      row.classList.toggle("is-you", idx === -1);
      row.lastElementChild!.textContent = idx === -1 ? you : (POOL[idx] ?? "");
    });
    root.toggleAttribute("data-outside", RUNS[run] === null);
    list.classList.remove("is-swapping");
    cells[run]!.className = RUNS[run] === null ? "miss" : "hit";
    runEl.textContent = String(run + 1);
    estimate(run + 1);
  };

  const reset = (): void => {
    cells.forEach((cell) => (cell.className = ""));
    runEl.textContent = "0";
    root.removeAttribute("data-outside");
    estimate(0);
  };

  const type = async (): Promise<void> => {
    for (let i = 0; i <= prompt.length; i += 2) {
      typed.textContent = prompt.slice(0, i);
      rest.textContent = prompt.slice(i); // untyped text keeps its place (transparent): no layout shift
      await wait(TYPE_MS);
    }
    typed.textContent = prompt;
    rest.textContent = "";
  };

  const loop = async (): Promise<void> => {
    await wait(START_MS); // parks until the simulator is on screen: below the fold on phones, so zero cost at load
    root.classList.add("is-live");
    reset();
    await type();
    for (;;) {
      await wait(START_MS);
      for (let run = 0; run < RUNS.length; run += 1) {
        await show(run);
        await wait(ANSWER_MS);
      }
      await wait(HOLD_MS);
      reset();
    }
  };
  void loop();
};

const boot = (): void => {
  const root = document.querySelector<HTMLElement>("[data-sim]");
  if (root === null) return;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || nav.connection?.saveData === true) return;
  start(root);
};

const whenIdle = (fn: () => void): void => {
  if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 800);
};

if (document.readyState === "complete") whenIdle(boot);
else window.addEventListener("load", () => whenIdle(boot), { once: true });
