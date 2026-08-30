"use client";

import Link from "next/link";
import { TOOLS, TOOL_GROUPS } from "./tools/registry";

/**
 * A directory of tools, each linking to its own indexable /tools/[slug] page.
 * Built as ruled cells sharing hairlines with their neighbours rather than a
 * grid of bordered cards — the card grid is exactly the look we avoid, and a
 * shared-rule matrix reads as a considered index instead.
 */
export function ToolsPanel() {
  return (
    <div className="flex flex-col gap-16">
      {TOOL_GROUPS.map((group) => {
        const tools = TOOLS.filter((t) => t.group === group);
        if (tools.length === 0) return null;
        return (
          <section key={group}>
            <div className="flex items-center gap-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">{group}</h2>
              <span className="h-px flex-1 bg-rule" />
              <span className="font-mono text-[11px] tabular-nums text-accent">
                {String(tools.length).padStart(2, "0")}
              </span>
            </div>

            <div className="mt-5 grid border-t border-ink sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="sff-cell group relative flex flex-col gap-2 border-b border-rule px-0 py-6 hover:bg-ink sm:px-6 sm:[&:nth-child(2n+1)]:border-r lg:[&:nth-child(2n+1)]:border-r-0 lg:[&:not(:nth-child(3n))]:border-r"
                >
                  <div className="flex items-start justify-between gap-3">
                    <tool.icon className="h-5 w-5 shrink-0 text-accent" />
                    {tool.caveat && (
                      <span className="border border-rule px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft transition-colors group-hover:border-paper/30 group-hover:text-paper/70">
                        {tool.caveat}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 font-display text-lg font-medium tracking-[-0.01em] text-ink transition-colors group-hover:text-paper">
                    {tool.title}
                  </span>
                  <span className="text-sm leading-relaxed text-ink-soft transition-colors group-hover:text-paper/70">
                    {tool.cardBlurb}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
