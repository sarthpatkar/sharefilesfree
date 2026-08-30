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
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={shown ? "shown" : ""}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
      className={className}
    >
      {children}
    </Tag>
  );
}

/**
 * Section eyebrow: a mono, wide-tracked label above a hairline that draws
 * itself in. Used instead of a coloured pill, which would be a capsule.
 */
export function SectionLabel({ children, index }: { children: ReactNode; index?: string }) {
  return (
    <div className="flex items-center gap-4">
      {index && <span className="font-mono text-xs tabular-nums text-accent">{index}</span>}
      <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-soft">{children}</span>
      <span className="sff-rule-grow h-px flex-1 bg-rule" />
    </div>
  );
}
