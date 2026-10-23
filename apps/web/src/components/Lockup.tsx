import { LOCKUP } from "@proofseen/brand";

/*
 * The poincon and the word, as drawn by the brand (packages/brand): paper and green on the night, the one theme, at a
 * fixed size so nothing moves while it loads. The same markup as the header of the HTML hub (packages/hub, market-shell.ts).
 */
export function Lockup() {
  return (
    // A plain <img>: an SVG at a fixed size, next/image would add nothing but a wrapper.
    <img src={LOCKUP.dark} width={LOCKUP.width} height={LOCKUP.height} alt="Proofseen" />
  );
}
