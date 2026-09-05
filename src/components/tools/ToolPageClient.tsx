"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToolBySlug, TOOLS } from "./registry";
import { setHandoffFile } from "@/lib/handoff";
import { IconArrowLeft } from "../icons";
import { AdSlot } from "../ads/AdSlot";

/** Client wrapper so the tool itself (and its "Send this file" handoff) can run interactively, while the route stays a Server Component for metadata and static params. */
export function ToolPageClient({ slug }: { slug: string }) {
  const tool = getToolBySlug(slug);
  const router = useRouter();

  if (!tool) return null;

  function sendToTransfer(file: File) {
    setHandoffFile(file);
    router.push("/#send");
  }

  const related = TOOLS.filter((t) => t.slug !== slug && t.group === tool!.group).slice(0, 5);
  const others = TOOLS.filter((t) => t.slug !== slug && t.group !== tool!.group).slice(0, 6 - related.length);
  const suggestions = [...related, ...others];

  return (
    <>
      <div className="bg-yellow">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-12 sm:px-8 sm:py-16">
          <Link href="/tools" className="sff-nudge inline-flex items-center gap-2 bg-red px-4 py-2 text-[12px] font-bold uppercase tracking-[0.12em] leading-none text-yellow">
            <IconArrowLeft className="h-4 w-4" />
            All tools
          </Link>

          <div className="mt-8 grid gap-x-14 gap-y-10 lg:grid-cols-12">
            <header className="lg:col-span-5">
              <span className="inline-flex h-14 w-14 items-center justify-center bg-lime-4 text-black">
                <tool.icon className="h-8 w-8" />
              </span>
              <h1 className="mt-5 font-display text-[clamp(1.9rem,3.8vw,2.8rem)] leading-[1.06] text-red-bright">
                {tool.title}
              </h1>
              {tool.caveat && (
                <span className="mt-4 inline-block bg-red px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-yellow">
                  {tool.caveat}
                </span>
              )}
              <p className="mt-5 max-w-md text-[16px] font-medium leading-[1.6] text-black">{tool.description}</p>
              <p className="mt-6 max-w-md bg-lime p-5 text-[15px] font-semibold leading-[1.5] text-black">
                This runs on your own device. Your file never goes anywhere — no queue, no size limit, nothing to
                delete afterwards.
              </p>
            </header>

            <div className="lg:col-span-7">
              <tool.Component onSend={sendToTransfer} />
            </div>
          </div>
        </div>
      </div>

      {/* Banner only, and never in the way of the tool. Tool pages carry no ad
          gate of any kind: nothing stands between a visitor and using a tool or
          saving its result. That is a product rule, not an oversight — the
          tools' whole promise is "no queue, no watermark, no daily limit", and
          they are the site's best ad inventory precisely because they're
          frictionless. Ads pay for the tools; they don't tax them. */}
      <div className="bg-yellow px-5 pb-12 sm:px-8">
        <AdSlot slotId="tool-page" format="leaderboard" />
      </div>

      <section className="bg-lime-4">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-14 sm:px-8">
          <p className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
            Related tools
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="sff-nudge flex items-center gap-3 bg-yellow px-5 py-4"
              >
                <t.icon className="h-5 w-5 shrink-0 text-red" />
                <span className="truncate text-[14px] font-bold leading-none text-black">{t.title}</span>
              </Link>
            ))}
          </div>
          <Link href="/tools" className="link mt-6 inline-block text-[16px] text-red">
            See all {TOOLS.length} tools
          </Link>
        </div>
      </section>
    </>
  );
}
