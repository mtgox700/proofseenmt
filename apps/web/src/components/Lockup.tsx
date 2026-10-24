import { LOCKUP } from "@proofseen/brand";

/*
 * The poincon and the word, as drawn by the brand (packages/brand): paper and green on the night, the one theme, at a
 * fixed size so nothing moves while it loads. The same markup as the header of the HTML hub (packages/hub, market-shell.ts).
 */
export function Lockup() {
  // A plain <img>: an SVG at a fixed size, next/image would add nothing but a wrapper. The <picture> around it, now
  // without a second source, keeps React from hoisting an image preload into the head: the display font stays the
  // one thing preloaded (LCP), and the markup stays the hub's, element for element.
  return (
    <picture>
      <img src={LOCKUP.dark} width={LOCKUP.width} height={LOCKUP.height} alt="Proofseen" />
    </picture>
  );
}
