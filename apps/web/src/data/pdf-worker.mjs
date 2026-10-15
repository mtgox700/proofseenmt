import { parentPort, workerData } from "node:worker_threads";
import { extractText, getDocumentProxy } from "unpdf";

/*
 * The PDF.js reading of an uploaded CV, run in a worker thread started by pdf-text.ts with its own heap cap and a hard
 * deadline: a hostile PDF can only exhaust this thread, never the web process.
 *
 * Plain JavaScript on purpose. Node loads this file at run time from its place in the source tree (apps/web/src/data),
 * the Next.js bundler never sees it, and `unpdf` resolves from apps/web/node_modules like any server dependency. The
 * PDF.js build shipped by unpdf compiles no code from font data; it runs here without system fonts, font loading or XFA
 * forms, and a document longer than a CV is not read at all.
 */

const read = async ({ bytes, maxPages, maxChars }) => {
  const pdf = await getDocumentProxy(bytes, { useSystemFonts: false, disableFontFace: true, stopAtErrors: true, enableXfa: false });
  try {
    if (pdf.numPages > maxPages) return { kind: "too_long" };
    const { text } = await extractText(pdf, { mergePages: true });
    return { kind: "ok", text: text.replace(/[ \t]+/g, " ").trim().slice(0, maxChars) };
  } finally {
    await pdf.loadingTask.destroy();
  }
};

read(workerData).then(
  (result) => parentPort?.postMessage(result),
  () => parentPort?.postMessage({ kind: "unreadable" }),
);
