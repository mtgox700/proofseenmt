import { parentPort, workerData } from "node:worker_threads";
import { extractText, getDocumentProxy } from "unpdf";
import { objectStreamsActive } from "./pdf-scan.mjs";

/*
 * The PDF.js reading of an uploaded PDF (CV or message attachment), run in a worker thread started by pdf-text.ts with
 * its own heap cap and a hard deadline: a hostile PDF can only exhaust this thread, never the web process.
 *
 * Plain JavaScript on purpose. Node loads this file at run time from its place in the source tree (apps/web/src/data),
 * the Next.js bundler never sees it, and `unpdf` resolves from apps/web/node_modules like any server dependency. The
 * PDF.js build shipped by unpdf compiles no code from font data; it runs here without system fonts, font loading or XFA
 * forms, and a document longer than `maxPages` is not read at all.
 *
 * The answer (wave-3 review, M1/M2): the text, whether the document carries active content, and its links.
 *  - Active content is judged from what PDF.js itself parsed, object streams included: document and page scripts
 *    (`getJSActions`), an action run at opening (`getOpenAction`), embedded files (`getAttachments`), interactive forms
 *    (AcroForm fields, widget annotations, XFA), rich media, file attachment, sound, movie and 3D annotations,
 *    annotations with actions, links that launch something other than a web page, a mailbox or a phone. pdf-scan.mjs
 *    adds the action dictionaries PDF.js does not expose (a launch at opening or on a page event, a form submission or
 *    import), read in the decompressed object streams.
 *  - An encrypted PDF is reported as such, even one that opens without a password: its content cannot be vouched for.
 *  - The links come back so that the caller checks them for contact details like the text.
 * Text extraction tolerates the small errors of real-world PDFs (`stopAtErrors: false`).
 */

/** Annotations that play, embed or run something, and form fields (a CV or a quote needs none). */
const ACTIVE_SUBTYPES = new Set(["FileAttachment", "Sound", "Movie", "Screen", "RichMedia", "3D", "Widget"]);
/** Where a link may lead without being active content; anything else (a program, a local file) is refused. */
const PLAIN_LINK = /^(?:https?|mailto|tel):/i;
const MAX_LINKS = 200;
const MAX_LINK_LENGTH = 2048;

const hasEntries = (value) => value !== null && value !== undefined && Object.keys(value).length > 0;

/** What the annotations of one page add: whether one is active, and the links they point to. */
const pageFindings = async (page, links) => {
  let active = hasEntries(await page.getJSActions());
  for (const annotation of await page.getAnnotations()) {
    if (ACTIVE_SUBTYPES.has(annotation.subtype) || hasEntries(annotation.actions) || annotation.attachment !== undefined) active = true;
    const target = annotation.unsafeUrl ?? annotation.url;
    if (annotation.subtype !== "Link" || typeof target !== "string") continue;
    if (!PLAIN_LINK.test(target.trim())) active = true;
    if (links.length < MAX_LINKS) links.push(target.slice(0, MAX_LINK_LENGTH));
  }
  return active;
};

/** Whether the parsed document carries active content; fills `links` with the targets of its links. */
const activeStructure = async (pdf, info, links) => {
  const opening = await pdf.getOpenAction();
  let active =
    info?.IsXFAPresent === true ||
    info?.IsAcroFormPresent === true ||
    hasEntries(opening?.action) ||
    hasEntries(await pdf.getJSActions()) ||
    hasEntries(await pdf.getAttachments());
  for (let number = 1; number <= pdf.numPages; number += 1) {
    if (await pageFindings(await pdf.getPage(number), links)) active = true;
  }
  return active;
};

const open = async (bytes) => {
  try {
    return await getDocumentProxy(bytes, { useSystemFonts: false, disableFontFace: true, stopAtErrors: false, enableXfa: false, isEvalSupported: false });
  } catch (error) {
    if (error?.name === "PasswordException") return "encrypted";
    throw error;
  }
};

const read = async ({ bytes, maxPages, maxChars }) => {
  // Before PDF.js takes the bytes: it may move them to its own buffers.
  const packedActive = objectStreamsActive(bytes);
  const pdf = await open(bytes);
  if (pdf === "encrypted") return { kind: "encrypted" };
  try {
    const { info } = await pdf.getMetadata();
    if (typeof info?.EncryptFilterName === "string") return { kind: "encrypted" };
    if (pdf.numPages > maxPages) return { kind: "too_long" };
    const links = [];
    const structureActive = await activeStructure(pdf, info, links);
    const { text } = await extractText(pdf, { mergePages: true });
    return { kind: "ok", text: text.replace(/[ \t]+/g, " ").trim().slice(0, maxChars), active: packedActive || structureActive, links };
  } finally {
    await pdf.loadingTask.destroy();
  }
};

read(workerData).then(
  (result) => parentPort?.postMessage(result),
  () => parentPort?.postMessage({ kind: "unreadable" }),
);
