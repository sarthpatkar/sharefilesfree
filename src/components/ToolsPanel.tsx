"use client";

import Link from "next/link";
import { TOOLS, TOOL_GROUPS } from "./tools/registry";

/**
 * A directory of tool cards, each linking to its own indexable /tools/[slug]
 * page — rendered on the standalone /tools hub page. The tools themselves
 * don't render inline here; each needs its own real URL to be indexable and
 * individually linkable/bookmarkable — that's the whole point.
 */
export function ToolsPanel() {
  return (
    <div className="flex flex-col gap-10">
      {TOOL_GROUPS.map((group) => {
        const tools = TOOLS.filter((t) => t.group === group);
        if (tools.length === 0) return null;
        return (
          <div key={group}>
            <h2 className="mb-4 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.15em] text-muted">
              {group}
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-[11px] tabular-nums text-muted/70">{String(tools.length).padStart(2, "0")}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-400 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_16px_36px_-22px_rgba(20,35,29,0.45)]"
                >
                  {/* Accent wash that grows from the corner on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 scale-0 rounded-full bg-accent/[0.07] transition-transform duration-500 ease-out group-hover:scale-100"
                  />
                  {tool.caveat && (
                    <span className="absolute right-3 top-3 rounded-full bg-border/70 px-2 py-0.5 text-[10px] font-medium text-muted">
                      {tool.caveat}
                    </span>
                  )}
                  <tool.icon className="h-6 w-6 text-accent transition-transform duration-400 group-hover:-rotate-6 group-hover:scale-110" />
                  <span className="mt-1 font-medium text-foreground">{tool.title}</span>
                  <span className="text-sm leading-relaxed text-muted">{tool.cardBlurb}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
