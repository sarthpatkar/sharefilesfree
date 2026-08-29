"use client";

import { useState } from "react";
import Link from "next/link";
import { SendPanel } from "./SendPanel";
import { ReceivePanel } from "./ReceivePanel";

export function Home({ initialTab = "send", initialCode }: { initialTab?: "send" | "receive"; initialCode?: string }) {
  const [tab, setTab] = useState<"send" | "receive">(initialTab);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:py-20">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">ShareFilesFree</h1>
        <p className="max-w-md text-black/60 dark:text-white/60">
          Send files straight from your browser to any device. No account, no app, no size-limit tricks —
          just a code.
        </p>
      </header>

      <div className="mx-auto flex rounded-full border border-black/10 p-1 dark:border-white/10">
        {(["send", "receive"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-6 py-2 text-sm font-medium transition ${
              tab === t ? "bg-emerald-600 text-white" : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            }`}
          >
            {t === "send" ? "Send" : "Receive"}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-black/10 p-6 sm:p-10 dark:border-white/10">
        {tab === "send" ? <SendPanel /> : <ReceivePanel initialCode={initialCode} />}
      </section>

      <footer className="mt-auto flex flex-col items-center gap-2 pt-8 text-center text-xs text-black/40 dark:text-white/40">
        <p>Files transfer directly between browsers — we never store or see them.</p>
        <p>Free, forever, no login required.</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
        </nav>
      </footer>
    </main>
  );
}
