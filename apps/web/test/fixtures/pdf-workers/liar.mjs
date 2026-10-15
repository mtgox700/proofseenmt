import { parentPort } from "node:worker_threads";

// A worker that answers with something that is not a reading result.
parentPort?.postMessage({ kind: "ok", text: 42 });
