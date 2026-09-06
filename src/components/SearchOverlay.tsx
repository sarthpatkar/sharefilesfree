"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconClose, IconSearch } from "./icons";
import { GROUP_FIELDS } from "./ToolsPanel";
import { TOOLS, type ToolDef } from "./tools/registry";

/**
 * The one search box that reaches every tool from every page — the header
 * icon here is the only thing that has to be everywhere; the overlay it
 * opens is a single component reused site-wide instead of a per-page search.
 * Same wipe-open device as the mobile nav menu, so it reads as one family of
 * motion rather than a bolted-on widget.
 */
export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored: { tool: ToolDef; score: number }[] = [];
    for (const tool of TOOLS) {
      const title = tool.title.toLowerCase();
      const haystack = `${title} ${tool.cardBlurb} ${tool.description} ${tool.group} ${tool.slug}`.toLowerCase();
      if (!haystack.includes(q)) continue;
      const score = title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2;
      scored.push({ tool, score });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.tool);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  function close() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  // Autofocus on open, and lock the page behind the wipe — same treatment
  // as the mobile menu overlay.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Cmd/Ctrl+K opens it from anywhere, on any page, without touching the
  // mouse — this listener is always mounted since SearchOverlay lives in
  // the site-wide header. Escape and arrow keys only apply once it's open.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isShortcut) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        const tool = results[activeIndex];
        if (tool) {
          router.push(`/tools/${tool.slug}`);
          close();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, results, activeIndex, router]);

  return (
    <>
      {/* 44px+ touch target, visible on every breakpoint — this is the
          universal entry point, so it can't hide behind "hidden sm:block". */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search tools"
        aria-keyshortcuts="Meta+K"
        className="sff-nudge flex h-11 w-11 shrink-0 items-center justify-center text-yellow"
      >
        <IconSearch className="h-5 w-5" />
      </button>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
        aria-hidden={!open}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className={`fixed inset-0 z-[60] bg-red ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{
          clipPath: open ? "circle(150% at 90% 5%)" : "circle(0% at 90% 5%)",
          transition: "clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-[860px] flex-col px-5 pt-20 pb-8 sm:px-8 sm:pt-24">
          <div className="flex items-center gap-3">
            <IconSearch className="h-6 w-6 shrink-0 text-yellow" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              tabIndex={open ? 0 : -1}
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder="Search every tool — “compress”, “word”, “qr”…"
              className="w-full bg-transparent font-display text-[22px] leading-none text-yellow placeholder:text-yellow/50 focus:outline-none sm:text-[32px]"
            />
            <button
              type="button"
              onClick={close}
              tabIndex={open ? 0 : -1}
              aria-label="Close search"
              className="sff-nudge flex h-11 w-11 shrink-0 items-center justify-center text-yellow"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>

          <div className="sff-track mt-8 flex-1 overflow-y-auto">
            {query.trim() === "" ? (
              <p className="text-[14px] font-semibold text-lime-max">
                Start typing to search all {TOOLS.length} tools — merge, compress, convert, sign, and more.
              </p>
            ) : results.length === 0 ? (
              <p className="text-[14px] font-semibold text-lime-max">No tool matches &ldquo;{query}&rdquo;.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {results.map((tool, i) => (
                  <li key={tool.slug}>
                    <Link
                      href={`/tools/${tool.slug}`}
                      onClick={close}
                      tabIndex={open ? 0 : -1}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`sff-nudge flex items-center gap-4 p-4 ${GROUP_FIELDS[tool.group] ?? "bg-yellow"}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 ${i === activeIndex ? "bg-red" : "bg-transparent"}`} />
                      <tool.icon className="h-6 w-6 shrink-0 text-red" />
                      <span className="flex flex-col">
                        <span className="text-[16px] font-bold leading-tight text-black">{tool.title}</span>
                        <span className="text-[13px] font-semibold leading-tight text-black">{tool.cardBlurb}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-6 hidden text-[11px] font-bold uppercase tracking-[0.18em] text-lime-max sm:block">
            ↑↓ to navigate · Enter to open · Esc to close
          </p>
        </div>
      </div>
    </>
  );
}
