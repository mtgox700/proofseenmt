const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Every user-provided string goes through this before reaching HTML. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** JSON safe to embed in a <script type="application/ld+json"> block (no "</script>" break-out). */
export const safeJsonLd = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

/** Inline, tokenised CSS (MARQUE.md "laboratoire éditorial"), system fonts only: zero network request, zero JS. */
export const STYLES = `
:root{--bg:#FAFAF7;--surface:#FFFFFF;--text:#0F1B2D;--muted:#4A5568;--border:#D9D7D0;--accent:#0B6E54;--focus:#1D4ED8}
@media (prefers-color-scheme:dark){:root{--bg:#0B1220;--surface:#121B2E;--text:#E8ECF2;--muted:#A3AEC2;--border:#2A3752;--accent:#3FCF9C;--focus:#8AB0FF}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:1rem/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:46rem;margin:0 auto;padding:2rem 1rem 4rem}
h1{font:600 2rem/1.2 Georgia,"Times New Roman",serif;margin:0 0 .25rem}
h2{font:600 1.25rem/1.3 Georgia,"Times New Roman",serif;margin:2.5rem 0 .75rem;border-bottom:1px solid var(--border);padding-bottom:.25rem}
p{margin:.5rem 0}.muted{color:var(--muted)}
a{color:var(--accent)}a:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
ul.tags{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:.5rem}
ul.tags li{border:1px solid var(--border);border-radius:9999px;padding:.1rem .7rem;background:var(--surface)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem;margin:.75rem 0}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.4rem;border-bottom:1px solid var(--border);vertical-align:top}
.status{font-weight:600;color:var(--accent)}
`;
