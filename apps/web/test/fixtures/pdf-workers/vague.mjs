import { parentPort } from "node:worker_threads";

// A worker that answers a text but says nothing of active content: never taken for a clean document.
parentPort?.postMessage({ kind: "ok", text: "Bonjour" });
