import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A <p> inside a <p> is invalid HTML. The browser silently closes the outer one
 * while React renders it nested, so the server and client markup disagree and
 * hydration fails on that page — with an error that names a stack of routers
 * rather than the file that caused it.
 *
 * It is easy to introduce: the legal pages take a `body` prop, and it is
 * natural to hand one a paragraph and then later add a second paragraph inside
 * the first rather than beside it. That is exactly how it happened.
 *
 * A grep is a blunt instrument, but this bug is a purely syntactic one and the
 * blunt instrument catches it in CI instead of in a browser console.
 */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("markup that would break hydration", () => {
  it("never nests a <p> inside another <p>", () => {
    const offenders: string[] = [];

    for (const file of tsxFiles("src")) {
      let depth = 0;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          const opens = line.match(/<p[ >]/g)?.length ?? 0;
          const closes = line.match(/<\/p>/g)?.length ?? 0;
          if (depth > 0 && opens > 0) offenders.push(`${file}:${index + 1}`);
          depth = Math.max(0, depth + opens - closes);
        });
    }

    expect(offenders).toEqual([]);
  });
});
