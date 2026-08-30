"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Reveals its children once they scroll into view. One IntersectionObserver
 * per element, disconnected as soon as it fires — this never re-hides on
 * scroll-up, because content that flickers away when you scroll back is
 * annoying rather than impressive.
 *
 * The animation itself lives in CSS (`[data-reveal]` in globals.css) so it's
 * covered by the prefers-reduced-motion block there rather than needing a
 * separate JS check.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  /** Milliseconds to stagger this element behind its neighbours. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (very old browsers, some test runners): show it
    // immediately rather than leaving the page permanently blank. Deferred so
    // the setState doesn't run synchronously in the effect body.
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-reveal={shown ? "shown" : ""} style={{ "--delay": `${delay}ms` } as React.CSSProperties} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Writes the pointer position into --mx/--my as percentages so a CSS radial
 * gradient can follow the cursor. Pure decoration: with JS disabled the
 * custom properties fall back to their centered defaults and nothing breaks.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Coarse pointers have no hover state to track — skip the listener entirely
    // rather than paying for pointermove events on touch devices.
    if (!window.matchMedia("(hover: hover)").matches) return;

    function onMove(e: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      el!.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
      el!.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
    }

    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return ref;
}
