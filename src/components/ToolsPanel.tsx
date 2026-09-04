"use client";

import Link from "next/link";
import { TOOLS, TOOL_GROUPS } from "./tools/registry";

/* Each group takes a different field, so the palette organises the index.
   Flat fields, no shadow — the colour change is the only boundary a tile
   needs, and the hard offset was making a 19-item grid read as clutter. */
const GROUP_FIELDS: Record<string, string> = {
  "PDF pages": "bg-field-1",
  "Convert to PDF": "bg-field-2",
  "Convert from PDF": "bg-field-3",
  Images: "bg-field-4",
  Utilities: "bg-field-5",
};

/**
 * The tools index. Every tool links to its own page, and the colour of the
 * block tells you which family it belongs to — no rules, no dividers.
 */
export function ToolsPanel() {
  return (
    <div className="flex flex-col gap-14">
      {TOOL_GROUPS.map((group) => {
        const tools = TOOLS.filter((t) => t.group === group);
        if (tools.length === 0) return null;
        const field = GROUP_FIELDS[group] ?? "bg-yellow";
        return (
          <section key={group}>
            <div className="flex items-baseline gap-3">
              <h2 className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
                {group}
              </h2>
              <span className="text-[13px] font-bold tabular-nums text-black opacity-40">{String(tools.length).padStart(2, "0")}</span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className={`sff-nudge relative flex flex-col gap-2 p-6 ${field}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <tool.icon className="h-7 w-7 shrink-0 text-red" />
                    {tool.caveat && (
                      <span className="bg-red px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-yellow">
                        {tool.caveat}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 text-[17px] font-bold leading-[1.2] tracking-[-0.01em] text-black">{tool.title}</span>
                  <span className="text-[14px] font-semibold leading-[1.45] text-black">{tool.cardBlurb}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
