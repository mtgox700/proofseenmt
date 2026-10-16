import { Buffer } from "node:buffer";
import { constants, inflateSync } from "node:zlib";

/*
 * The object streams of a PDF, opened and searched for active content (wave-3 review, M1). Since PDF 1.5, most
 * objects of a file (catalog, actions, annotations) can live inside compressed "object streams": a search through the
 * raw bytes, like the first filter of file-sniff.ts, never sees them. Every object of a PDF is either written in the
 * file or packed in one of these streams, so the raw filter plus this scan cover the action dictionaries.
 *
 * Runs only inside the PDF worker thread (pdf-worker.mjs), never in the web process; inflating is capped per stream
 * and in total. A stream is taken for an object stream when the text since the previous stream names /ObjStm (or, as
 * PDF readers do not insist on /Type, carries a /First key and decodes to the "number offset" header of one). What
 * cannot be opened with certainty (an object stream with an unusual filter or a predictor, a corrupt or oversized
 * one, too many of them) counts as active: such a file is refused rather than trusted.
 *
 * The names below are the ones of ACTIVE_PDF in file-sniff.ts; keep both lists together.
 */

const ACTIVE_NAMES = /\/(?:JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA|SubmitForm|ImportData|GoToE)(?![A-Za-z])/;
const OBJECT_STREAM = /\/Type\s*\/ObjStm(?![A-Za-z])/;
const FIRST_KEY = /\/First(?![A-Za-z])/;
const STREAM_KEYWORD = /(?<![A-Za-z])stream(?:\r\n|\n|\r)/g;
/** Filters that only ever carry pictures: a stream using one of them is an image, never packed objects. */
const IMAGE_FILTERS = new Set(["/DCTDecode", "/DCT", "/JPXDecode", "/JBIG2Decode", "/CCITTFaxDecode", "/CCF"]);
const OBJECT_STREAM_HEADER = /^\s*\d+\s+\d+\s/;
const PREFIX_BYTES = 256;
const MAX_STREAM_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_OBJECT_STREAMS = 5_000;

/** Names written with #xx escapes, decoded: `/J#61vaScript` is `/JavaScript` to every PDF reader. */
export const unescapeNames = (text) => text.replace(/#([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

/**
 * The PDF syntax without its strings and comments: a title that mentions "TypeScript/JavaScript" is not a script. A
 * comment runs to the end of its line (so a "(" in it opens nothing), a literal string to its balancing ")", a hex
 * string to its ">".
 */
export const withoutStrings = (text) => {
  const kept = [];
  let from = 0;
  let i = 0;
  const skipTo = (next) => {
    kept.push(text.slice(from, i), " ");
    i = next;
    from = next;
  };
  while (i < text.length) {
    const c = text[i];
    if (c === "%") {
      const eol = /[\r\n]/g;
      eol.lastIndex = i;
      skipTo(eol.exec(text)?.index ?? text.length);
    } else if (c === "(") {
      let depth = 1;
      let j = i + 1;
      while (j < text.length && depth > 0) {
        const s = text[j];
        if (s === "\\") j += 1;
        else if (s === "(") depth += 1;
        else if (s === ")") depth -= 1;
        j += 1;
      }
      skipTo(j);
    } else if (c === "<" && text[i + 1] === "<") {
      i += 2;
    } else if (c === "<") {
      const end = text.indexOf(">", i + 1);
      skipTo(end === -1 ? text.length : end + 1);
    } else {
      i += 1;
    }
  }
  kept.push(text.slice(from));
  return kept.join("");
};

/** True when a piece of PDF syntax names a script, a launch, an embedded file, rich media, XFA or a form submission. */
export const namesActiveContent = (syntax) => ACTIVE_NAMES.test(unescapeNames(withoutStrings(syntax)));

/** The last value of `key` in `dict` (the one nearest the stream keyword), as written. */
const lastValue = (dict, pattern) => {
  let found = null;
  for (const match of dict.matchAll(pattern)) found = match[1];
  return found;
};

/** The bytes of a stream that starts at `start`: its direct /Length when it has one, else up to "endstream". */
const streamBytes = (bytes, raw, dict, start) => {
  const length = lastValue(dict, /\/Length\s+(\d+)(?![\d.])(?!\s+\d+\s+R)/g);
  if (length !== null) return bytes.subarray(start, Math.min(bytes.length, start + Number(length)));
  const end = raw.indexOf("endstream", start);
  return bytes.subarray(start, end === -1 ? bytes.length : end);
};

const latin1 = (data) => Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("latin1");

/** Inflates like PDF readers do: a stream cut short still gives what it holds. `null` when it is not Flate data. */
const inflate = (data, maxOutputLength) => {
  try {
    return latin1(inflateSync(data, { maxOutputLength, finishFlush: constants.Z_SYNC_FLUSH }));
  } catch {
    return null;
  }
};

/**
 * What one candidate stream holds: its decoded text, `"skip"` when it is not an object stream after all, `"refuse"`
 * when an object stream cannot be opened with certainty.
 */
const candidate = (data, dict, certain, budget) => {
  const filter = (lastValue(dict, /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/g) ?? "").replace(/[[\]\s]/g, "");
  const flate = filter === "/FlateDecode" || filter === "/Fl";
  if (!certain && (IMAGE_FILTERS.has(filter) || /\/DecodeParms/.test(dict))) return "skip";
  if ((filter !== "" && !flate) || /\/DecodeParms/.test(dict)) return "refuse";
  if (!certain) {
    // The first compressed kilobytes are enough to see the header; Flate cannot expand them past a few megabytes.
    const prefix = filter === "" ? latin1(data.subarray(0, PREFIX_BYTES)) : inflate(data.subarray(0, 4096), MAX_STREAM_BYTES);
    if (prefix === null || !OBJECT_STREAM_HEADER.test(prefix.slice(0, PREFIX_BYTES))) return "skip";
  }
  if (filter === "") return latin1(data);
  return inflate(data, Math.min(MAX_STREAM_BYTES, budget)) ?? "refuse";
};

/**
 * Whether the object streams of `bytes` hold active content. `true` as well when one of them cannot be opened, or when
 * the file has more of them, or more packed content, than any document exchanged here.
 */
export const objectStreamsActive = (bytes) => {
  const raw = latin1(bytes);
  let windowStart = 0;
  let streams = 0;
  let budget = MAX_TOTAL_BYTES;
  for (const match of raw.matchAll(STREAM_KEYWORD)) {
    // Everything since the previous stream keyword: this stream's dictionary is in there, whatever a string in it says.
    const dict = unescapeNames(raw.slice(windowStart, match.index));
    windowStart = match.index + match[0].length;
    const certain = OBJECT_STREAM.test(dict);
    if (!certain && !FIRST_KEY.test(dict)) continue;
    const content = candidate(streamBytes(bytes, raw, dict, windowStart), dict, certain, budget);
    if (content === "skip") continue;
    streams += 1;
    if (content === "refuse" || streams > MAX_OBJECT_STREAMS) return true;
    budget -= content.length;
    if (budget <= 0 || namesActiveContent(content)) return true;
  }
  return false;
};
