// A worker that never answers: stands in for a PDF whose parsing loops forever.
const spins = new Int32Array(1);
for (;;) {
  spins[0] += 1;
}
