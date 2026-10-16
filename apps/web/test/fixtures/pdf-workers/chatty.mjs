import { parentPort } from "node:worker_threads";

// A worker that answers with far more text than any CV holds.
parentPort?.postMessage({ kind: "ok", text: "a".repeat(1_000_000), active: false, links: [] });
