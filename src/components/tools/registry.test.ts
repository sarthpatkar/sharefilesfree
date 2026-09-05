import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOLS } from "./registry";

/**
 * The site advertises how many tools it has, in metadata that can't import the
 * registry without pulling every tool component into the root layout's bundle.
 * So the number is written out by hand there — and it drifted: the copy said 19
 * while the registry held 21, in six different places at once.
 *
 * This is the guard. Any sentence anywhere in the app that counts tools has to
 * agree with the registry, or the suite fails and says which file lied.
 */
const FILES_THAT_COUNT_TOOLS = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/components/landing/faqData.ts",
];

describe("the advertised number of tools", () => {
  it("matches the registry everywhere it is written out by hand", () => {
    const wrong: string[] = [];

    for (const file of FILES_THAT_COUNT_TOOLS) {
      const source = readFileSync(file, "utf8");
      // "21 free tools", "21 tools", "any of the 21 tools" — but not "2026".
      for (const match of source.matchAll(/(\d+)\s+(?:free\s+)?tools\b/g)) {
        if (Number(match[1]) !== TOOLS.length) {
          wrong.push(`${file}: says "${match[0]}", registry has ${TOOLS.length}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it("has a tool for every slug, with no duplicates", () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
