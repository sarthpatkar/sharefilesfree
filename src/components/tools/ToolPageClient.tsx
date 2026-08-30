"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToolBySlug, TOOLS } from "./registry";
import { setHandoffFile } from "@/lib/handoff";
import { IconArrowLeft } from "../icons";

/** Client wrapper so the actual tool component (and its onSend→handoff wiring) can run interactively, while the route itself stays a Server Component for metadata/generateStaticParams. */
export function ToolPageClient({ slug }: { slug: string }) {
  const tool = getToolBySlug(slug);
  const router = useRouter();

  if (!tool) return null;

  function sendToTransfer(file: File) {
    setHandoffFile(file);
    router.push("/");
  }

  const otherTools = TOOLS.filter((t) => t.slug !== slug).slice(0, 6);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-14 sm:py-20">
      <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm text-accent hover:text-accent-hover hover:underline">
        <IconArrowLeft className="h-4 w-4" /> ShareFilesFree
      </Link>

      <header className="flex flex-col items-center gap-3 text-center">
        <tool.icon className="h-8 w-8 text-accent" />
        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">{tool.title}</h1>
        <p className="max-w-md text-balance text-muted">{tool.description}</p>
        <p className="text-xs text-muted">Runs entirely in your browser — nothing is uploaded anywhere.</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(20,35,29,0.04)] sm:p-10">
        <tool.Component onSend={sendToTransfer} />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Other tools</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {otherTools.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:border-accent hover:bg-accent/[.04]"
            >
              {t.title}
            </Link>
          ))}
        </div>
        <Link href="/tools" className="mt-3 inline-block text-sm text-accent hover:text-accent-hover hover:underline">
          See all tools →
        </Link>
      </section>

      <footer className="mt-auto flex flex-col items-center gap-2 pt-8 text-center text-xs text-muted">
        <p>Want to send this file to another device instead? Use the button above, or go to ShareFilesFree directly.</p>
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
