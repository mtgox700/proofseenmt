/* The confidence interval: two stops (the range) and a proof-green point (the measurement). MARQUE.md §5. */
export function Logo() {
  return (
    <svg viewBox="0 0 40 20" aria-hidden="true" focusable="false">
      <path d="M4 3v14M36 3v14M4 10h32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="22" cy="10" r="4.6" fill="var(--proof)" />
    </svg>
  );
}
