// A worker that allocates without end: stands in for a PDF built to exhaust memory.
const kept = [];
for (;;) {
  kept.push(new Array(100_000).fill(kept.length));
}
