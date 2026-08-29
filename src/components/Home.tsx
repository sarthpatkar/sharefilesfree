"use client";

import { useState } from "react";
import Link from "next/link";
import { SendPanel } from "./SendPanel";
import { ReceivePanel } from "./ReceivePanel";

export function Home({ initialTab = "send", initialCode }: { initialTab?: "send" | "receive"; initialCode?: string }) {
  const [tab, setTab] = useState<"send" | "receive">(initialTab);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-12 px-4 py-14 sm:py-24">
      <header className="flex flex-col items-center gap-4 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">Free. Forever. No account.</p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          Send files, not sign-ups.
        </h1>
        <p className="max-w-sm text-balance text-muted">
          Straight from your browser to any device — a code for right now, or a link for later.
        </p>
      </header>

      <div>
        <div className="mx-auto flex w-fit gap-8 border-b border-border">
          {(["send", "receive"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                tab === t ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t === "send" ? "Send" : "Receive"}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(20,35,29,0.04)] sm:p-10">
          {tab === "send" ? <SendPanel /> : <ReceivePanel initialCode={initialCode} />}
        </section>
      </div>

      <footer className="mt-auto flex flex-col items-center gap-3 pt-8 text-center text-xs text-muted">
        <p>Files transfer directly between browsers — we never store or see them.</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline">
            Terms
          </Link>
        </nav>
      </footer>
    </main>
  );
}
