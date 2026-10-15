"use client";

import { useEffect, useState } from "react";
import { subscribeLive } from "./live-stream";

interface LiveCountProps {
  readonly which: "messages" | "notifications";
  /** The count rendered by the server: what shows without JavaScript, and until the stream answers. */
  readonly initial: number;
  /** Read by screen readers after the number, e.g. « non lus ». */
  readonly label: string;
}

const CAP = 99;

/** « (3) » after a navigation label, kept up to date by the live stream; nothing when the count is zero. */
export function LiveCount({ which, initial, label }: LiveCountProps) {
  const [count, setCount] = useState(initial);
  useEffect(() => setCount(initial), [initial]);
  useEffect(
    () =>
      subscribeLive((event) => {
        if (event.type === "counts") setCount(event[which]);
      }),
    [which],
  );
  if (count <= 0) return null;
  return (
    <span className="live-count">
      {" "}
      ({count > CAP ? `${CAP}+` : count}
      <span className="sr-only"> {label}</span>)
    </span>
  );
}
