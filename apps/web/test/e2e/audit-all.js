/* Lance audit-page.js sur chaque page livrée et condense le résultat. Généré depuis audit-page.js. */
async (page) => {
  const audit = async (page) => {
  const url = page.url();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  const vitals = async () => page.evaluate(() => new Promise((resolve) => {
    let lcp = 0; let cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    setTimeout(() => resolve({ lcpMs: Math.round(lcp), cls: Number(cls.toFixed(4)) }), 2500);
  }));

  // 1. Desktop 1280: vitals
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(url, { waitUntil: "load" });
  const desktop = await vitals();

  // 2. Contrast of every visible text node against its composited background, in the FINAL state: every entrance has
  //    been triggered (scroll through) and has finished before anything is measured.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) { await page.mouse.wheel(0, 500); await page.waitForTimeout(80); }
  await page.waitForTimeout(5000);
  const contrast = await page.evaluate(() => {
    const parse = (c) => {
      let m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
      m = c.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
      if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
      return null;
    };
    const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
    const bgOf = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      }
      let base = [7, 11, 20, 1];
      for (let i = layers.length - 1; i >= 0; i -= 1) base = over(layers[i], base);
      return base;
    };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const seen = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let checked = 0; const failures = [];
    while (walker.nextNode()) {
      const node = walker.currentNode; if (!node.textContent.trim()) continue;
      const el = node.parentElement; const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || el.closest(".sr-only,[aria-hidden='true']")) continue;
      const rect = el.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) continue;
      const disabled = el.closest(":disabled,[aria-disabled='true']");
      const fg0 = parse(cs.color); if (!fg0) continue;
      // Ancestor opacity fades the text towards its background: a dimmed block must still pass.
      let fade = 1; for (let n = el; n; n = n.parentElement) fade *= parseFloat(getComputedStyle(n).opacity);
      const fg = [fg0[0], fg0[1], fg0[2], fg0[3] * fade];
      const bg = bgOf(el); const r = ratio(over(fg, bg), bg);
      const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      checked += 1;
      const key = `${cs.color}|${bg.map(Math.round).join(",")}`;
      if (!seen.has(key)) seen.set(key, { color: cs.color, bg: `rgb(${bg.slice(0, 3).map(Math.round).join(",")})`, ratio: Number(r.toFixed(2)) });
      if (r < need && !disabled) failures.push({ text: node.textContent.trim().slice(0, 40), ratio: Number(r.toFixed(2)), need });
    }
    const pairs = [...seen.values()].sort((a, b) => a.ratio - b.ratio);
    return { textNodesChecked: checked, distinctPairs: pairs.length, lowestPairs: pairs.slice(0, 5), failures: failures.slice(0, 10), failureCount: failures.length };
  });

  // 3. Keyboard: tab through everything, every stop must show a focus indicator
  const keyboard = { stops: 0, withoutVisibleFocus: [] };
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 80; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1.5) || cs.boxShadow !== "none";
      return { tag: el.tagName, text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30), visible, id: el.outerHTML.slice(0, 60) };
    });
    if (info === null) break;
    if (keyboard.first === info.id && i > 0) break;
    keyboard.first ??= info.id;
    keyboard.stops += 1;
    if (!info.visible) keyboard.withoutVisibleFocus.push(`${info.tag} ${info.text}`);
  }
  delete keyboard.first;

  // 4. Mobile 375: horizontal overflow
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(url, { waitUntil: "load" });
  const mobile = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1).map((el) => `${el.tagName}.${el.className}`).slice(0, 5);
    const header = document.querySelector(".site-header"); return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, overflow: doc.scrollWidth > doc.clientWidth, offenders: wide, headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null };
  });
  const mobileVitals = await vitals();

  // 5. Reduced motion: nothing runs
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const reduced = await page.evaluate(() => ({
    runningAnimations: document.getAnimations().filter((a) => a.playState === "running").length,
    simPlaying: document.querySelector(".sim")?.hasAttribute("data-playing") ?? null,
    replayButton: document.querySelector(".sim-replay") !== null,
    hiddenRevealNodes: [...document.querySelectorAll("[data-reveal]")].filter((n) => getComputedStyle(n).opacity !== "1").length,
  }));
  await page.emulateMedia({ reducedMotion: "no-preference" });

  return { url, desktop, mobile: { ...mobile, ...mobileVitals }, contrast, keyboard, reduced, consoleErrors: errors };
};
  const urls = ["/fr", "/en", "/fr/missions", "/fr/freelances", "/en/freelances", "/fr/metiers", "/fr/commande", "/en/commande", "/fr/inscription", "/fr/connexion", "/fr/app"];
  const out = {};
  for (const path of urls) {
    await page.goto(`http://localhost:3100${path}`);
    const r = await audit(page);
    out[path] = {
      lcpDesktopMs: r.desktop.lcpMs, clsDesktop: r.desktop.cls, lcpMobileMs: r.mobile.lcpMs, clsMobile: r.mobile.cls,
      overflow375: r.mobile.overflow, header375: r.mobile.headerHeight, scrollWidth: r.mobile.scrollWidth, clientWidth: r.mobile.clientWidth, offenders: r.mobile.offenders,
      textNodes: r.contrast.textNodesChecked, contrastFailures: r.contrast.failureCount, failures: r.contrast.failures, lowestPair: r.contrast.lowestPairs[0],
      tabStops: r.keyboard.stops, focusInvisible: r.keyboard.withoutVisibleFocus,
      reducedRunningAnimations: r.reduced.runningAnimations, reducedHidden: r.reduced.hiddenRevealNodes,
      consoleErrors: r.consoleErrors,
    };
  }
  return out;
}
