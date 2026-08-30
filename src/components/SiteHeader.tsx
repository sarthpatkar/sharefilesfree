"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconSend } from "./icons";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/tools", label: "Tools" },
  { href: "/#why", label: "Why it's free" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Scroll state drives two things: the header's hairline/backdrop, and the
  // reading-progress rule pinned to the very top of the viewport.
  useEffect(() => {
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > 8);
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Close the menu on navigation — without this, tapping a link that only
  // changes the hash leaves the overlay covering the thing you jumped to.
  useEffect(() => {
    const timer = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // While the overlay is open: lock the page behind it, close on Escape, and
  // keep Tab inside the panel so focus can't wander into the hidden page.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      {/* Reading progress — a single hairline, scaled. Costs one transform. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-accent"
        style={{ transform: `scaleX(${progress})`, transition: "transform 90ms linear" }}
      />

      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled ? "border-b border-rule bg-paper/95 backdrop-blur-md" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex w-full max-w-[1400px] items-stretch justify-between px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-3 py-4" aria-label="ShareFilesFree home">
            <span className="flex h-8 w-8 items-center justify-center bg-accent text-on-accent transition-transform duration-500 group-hover:rotate-[-10deg]">
              <IconSend className="h-4 w-4" />
            </span>
            <span className="font-display text-[19px] font-medium leading-none tracking-[-0.02em] text-ink">
              ShareFilesFree
            </span>
          </Link>

          <nav className="hidden items-center gap-9 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-active={pathname === item.href}
                className="sff-underline py-4 text-[14px] text-ink-soft transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/receive"
              className="sff-underline hidden py-4 text-[14px] text-ink-soft transition-colors hover:text-ink sm:block"
            >
              Receive
            </Link>
            <Link
              href="/#send"
              className="sff-press my-2.5 hidden bg-ink px-5 text-[14px] font-medium leading-none text-paper hover:bg-accent sm:flex sm:items-center"
            >
              Send a file
            </Link>

            {/* Hamburger: two hairlines that cross into an X. 48px square, so
                it clears the 44px minimum touch target on every phone. */}
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="relative -mr-3 flex h-12 w-12 items-center justify-center md:hidden"
            >
              <span
                className={`absolute h-[1.5px] w-6 bg-ink transition-transform duration-400 ease-[cubic-bezier(0.19,1,0.22,1)] ${
                  menuOpen ? "rotate-45" : "-translate-y-[5px]"
                }`}
              />
              <span
                className={`absolute h-[1.5px] w-6 bg-ink transition-transform duration-400 ease-[cubic-bezier(0.19,1,0.22,1)] ${
                  menuOpen ? "-rotate-45" : "translate-y-[5px]"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen mobile menu. Solid paper, ruled rows, oversized type —
          the same editorial language as the page, not a floating panel. */}
      <div
        id="mobile-menu"
        ref={panelRef}
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 bg-paper md:hidden ${
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          clipPath: menuOpen ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
          transition: "clip-path 0.55s cubic-bezier(0.19, 1, 0.22, 1)",
        }}
      >
        <div className="flex h-full flex-col px-5 pb-10 pt-24">
          <nav className="flex flex-col border-t border-rule" aria-label="Mobile">
            {[...NAV, { href: "/receive", label: "Receive" }].map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                tabIndex={menuOpen ? 0 : -1}
                className="group flex items-baseline justify-between border-b border-rule py-5 transition-colors active:bg-ink active:text-paper"
                style={{
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? "translateY(0)" : "translateY(14px)",
                  transition: `opacity 0.5s cubic-bezier(0.19,1,0.22,1) ${120 + i * 60}ms, transform 0.5s cubic-bezier(0.19,1,0.22,1) ${120 + i * 60}ms`,
                }}
              >
                <span className="font-display text-[30px] font-medium leading-none tracking-[-0.02em]">
                  {item.label}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </Link>
            ))}
          </nav>

          <Link
            href="/#send"
            onClick={() => setMenuOpen(false)}
            tabIndex={menuOpen ? 0 : -1}
            className="sff-press sff-offset mt-10 flex items-center justify-center bg-accent py-4 text-[15px] font-medium text-on-accent"
            style={{
              opacity: menuOpen ? 1 : 0,
              transition: "opacity 0.5s cubic-bezier(0.19,1,0.22,1) 440ms",
            }}
          >
            Send a file
          </Link>

          <p
            className="mt-auto pt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft"
            style={{ opacity: menuOpen ? 1 : 0, transition: "opacity 0.5s ease 500ms" }}
          >
            No account · No install · Free
          </p>
        </div>
      </div>
    </>
  );
}
