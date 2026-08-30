"use client";

import { useEffect, useState } from "react";

/**
 * The headline's moving part. One word swaps on a timer — out downward, in
 * from above, with a slight rock — so the promise restates itself while you
 * read it. On a timer rather than on scroll, and it holds the widest word's
 * width so the line never reflows underneath it.
 *
 * Honours prefers-reduced-motion by simply holding the first word.
 */
export function CyclingWord({ words, intervalMs = 2100 }: { words: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let swapTimer: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => {
      setPhase("out");
      swapTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setPhase("in");
      }, 280); // matches the out animation
    }, intervalMs);

    return () => {
      clearInterval(tick);
      clearTimeout(swapTimer);
    };
  }, [words.length, intervalMs]);

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");

  return (
    // The invisible longest word reserves the width, so swapping never shoves
    // the rest of the line sideways.
    <span className="relative inline-grid align-bottom">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {longest}
      </span>
      <span
        key={index}
        className={`col-start-1 row-start-1 text-left ${phase === "in" ? "sff-swap-in" : "sff-swap-out"}`}
      >
        {words[index]}
      </span>
      {/* Screen readers get the full list once, rather than a word that
          appears to change out from under them. */}
      <span className="sr-only">{words.join(", ")}</span>
    </span>
  );
}
