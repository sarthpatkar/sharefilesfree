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
  { href: "/about", label: "About" },
];

/**
 * A solid red band across the top. No hairline, no blur-on-scroll, and no
 * colour shift under the cursor — the band is simply always there, and hover
 * feedback is a nudge rather than a recolour.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close on navigation — otherwise a hash link leaves the overlay covering
  // the very thing it jumped to.
  useEffect(() => {
    const timer = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // While open: lock the page behind it, close on Escape, keep Tab inside.
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
      <header className="sticky top-0 z-50 bg-red">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="sff-nudge flex items-center gap-3" aria-label="ShareFilesFree home">
            <span className="flex h-9 w-9 items-center justify-center bg-y-max text-black">
              <IconSend className="h-5 w-5" />
            </span>
            <span className="font-display text-[19px] leading-none text-yellow">ShareFilesFree</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="sff-nudge text-[15px] font-semibold text-yellow">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/receive" className="sff-nudge hidden text-[15px] font-semibold text-yellow sm:block">
              Receive
            </Link>
            <Link
              href="/#send"
              className="sff-nudge hidden bg-lime px-5 py-2.5 text-[13px] font-bold leading-none text-black sm:block"
            >
              Send a file
            </Link>

            {/* 48px square — clears the 44px minimum on every phone. */}
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="relative -mr-2 flex h-12 w-12 items-center justify-center md:hidden"
            >
              <span
                className={`absolute h-[3px] w-7 bg-yellow transition-transform duration-300 ${
                  menuOpen ? "rotate-45" : "-translate-y-[6px]"
                }`}
              />
              <span
                className={`absolute h-[3px] w-7 bg-yellow transition-transform duration-300 ${
                  menuOpen ? "-rotate-45" : "translate-y-[6px]"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen red field, wiped open from the button corner. */}
      <div
        id="mobile-menu"
        ref={panelRef}
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 bg-red md:hidden ${menuOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{
          clipPath: menuOpen ? "circle(150% at 90% 5%)" : "circle(0% at 90% 5%)",
          transition: "clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="flex h-full flex-col px-5 pb-10 pt-24">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {[...NAV, { href: "/receive", label: "Receive" }].map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                tabIndex={menuOpen ? 0 : -1}
                className="flex items-baseline gap-4 py-2.5"
                style={{
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? "translateY(0)" : "translateY(16px)",
                  transition: `opacity .4s ease ${140 + i * 55}ms, transform .4s cubic-bezier(.2,1,.3,1) ${140 + i * 55}ms`,
                }}
              >
                <span className="text-[12px] font-bold tabular-nums leading-none text-lime-max">0{i + 1}</span>
                <span className="font-display text-[34px] leading-none text-yellow">{item.label}</span>
              </Link>
            ))}
          </nav>

          <Link
            href="/#send"
            onClick={() => setMenuOpen(false)}
            tabIndex={menuOpen ? 0 : -1}
            className="mt-10 block bg-lime px-6 py-4 text-center text-[16px] font-bold leading-none text-black"
            style={{ opacity: menuOpen ? 1 : 0, transition: "opacity .4s ease 420ms" }}
          >
            Send a file
          </Link>

          <p
            className="mt-auto pt-10 text-[12px] font-bold uppercase tracking-[0.18em] text-lime-max"
            style={{ opacity: menuOpen ? 1 : 0, transition: "opacity .4s ease 480ms" }}
          >
            No account · No app · Free
          </p>
        </div>
      </div>
    </>
  );
}
