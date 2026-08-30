"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconSend } from "./icons";

/**
 * Sticky site header. Starts transparent over the hero and condenses into a
 * blurred bar once the page scrolls — the cheapest way to make a page feel
 * "built" rather than a stack of sections, and it keeps the primary action
 * reachable the whole way down.
 */
export function SiteHeader({ variant = "landing" }: { variant?: "landing" | "solid" }) {
  const [scrolled, setScrolled] = useState(variant === "solid");

  useEffect(() => {
    if (variant === "solid") return;
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-105">
            <IconSend className="h-4 w-4" />
          </span>
          <span className="font-display text-[17px] font-medium tracking-tight text-foreground">
            ShareFilesFree
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <Link href="/#how" className="relative transition-colors hover:text-foreground">
            How it works
          </Link>
          <Link href="/tools" className="relative transition-colors hover:text-foreground">
            Tools
          </Link>
          <Link href="/#why" className="relative transition-colors hover:text-foreground">
            Why it&apos;s free
          </Link>
          <Link href="/#faq" className="relative transition-colors hover:text-foreground">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/receive"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Receive
          </Link>
          <Link
            href="/#send"
            className="sff-sweep relative overflow-hidden rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-[0_1px_2px_rgba(11,110,79,0.25)] transition-all duration-300 hover:bg-accent-hover hover:shadow-[0_4px_18px_var(--glow)] active:scale-[0.97]"
          >
            Send a file
          </Link>
        </div>
      </div>
    </header>
  );
}
