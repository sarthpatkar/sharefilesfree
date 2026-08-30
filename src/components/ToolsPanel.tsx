"use client";

import Link from "next/link";
import { TOOLS, TOOL_GROUPS } from "./tools/registry";

/**
 * A directory of tool cards, each linking to its own indexable /tools/[slug]
 * page — used both inside Home's "Tools" tab (for in-app discovery) and on
 * the standalone /tools hub page (for SEO/search traffic). The tools
 * themselves no longer render inline here; each needs its own real URL to be
 * indexable and individually linkable/bookmarkable — that's the whole point.
 */
export function ToolsPanel() {
  return (
    <div className="flex flex-col gap-6">
      {TOOL_GROUPS.map((group) => {
        const tools = TOOLS.filter((t) => t.group === group);
        if (tools.length === 0) return null;
        return (
          <div key={group}>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{group}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="relative flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition hover:border-accent hover:bg-accent/[.04]"
                >
                  {tool.caveat && (
                    <span className="absolute right-2 top-2 rounded-full bg-border px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {tool.caveat}
                    </span>
                  )}
                  <tool.icon className="h-6 w-6 text-accent" />
                  <span className="font-medium text-foreground">{tool.title}</span>
                  <span className="text-xs text-muted">{tool.cardBlurb}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
