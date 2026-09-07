// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeDocumentHtml } from "./sanitizeHtml";

describe("sanitizeDocumentHtml", () => {
  it("keeps ordinary document formatting intact", () => {
    const html = "<p>Hello <strong>world</strong> and <em>others</em></p><ul><li>one</li></ul>";
    expect(sanitizeDocumentHtml(html)).toBe(html);
  });

  it("keeps tables, which real documents depend on", () => {
    const html = '<table><tbody><tr><td colspan="2">cell</td></tr></tbody></table>';
    expect(sanitizeDocumentHtml(html)).toContain("<td colspan=\"2\">cell</td>");
  });

  // The one that actually matters: innerHTML does not run <script>, but it
  // absolutely does run an inline handler, and this site's CSP allows inline
  // script.
  it("strips inline event handlers", () => {
    const out = sanitizeDocumentHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
  });

  it("strips event handlers regardless of case or spacing", () => {
    const out = sanitizeDocumentHtml('<p OnMouseOver="alert(1)">hi</p><div ONCLICK="x()">z</div>');
    expect(out.toLowerCase()).not.toContain("onmouseover");
    expect(out.toLowerCase()).not.toContain("onclick");
  });

  it("removes script, iframe, object and embed entirely", () => {
    const out = sanitizeDocumentHtml(
      '<p>keep</p><script>alert(1)</script><iframe src="https://evil.example"></iframe><object data="x"></object><embed src="y">',
    );
    expect(out).toContain("keep");
    for (const bad of ["script", "iframe", "object", "embed", "alert(1)"]) {
      expect(out).not.toContain(bad);
    }
  });

  it("rejects javascript: URLs", () => {
    const out = sanitizeDocumentHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("click");
  });

  it("rejects javascript: URLs hidden with control characters or spacing", () => {
    const out = sanitizeDocumentHtml('<a href="java\tscript:alert(1)">x</a><a href=" JaVaScRiPt:alert(1)">y</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("allows embedded raster images, which is how a docx carries pictures", () => {
    const out = sanitizeDocumentHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="pic">');
    expect(out).toContain("data:image/png");
    expect(out).toContain('alt="pic"');
  });

  // An SVG is an image by MIME type and a script host in practice. <img> does
  // not execute it today, and this does not rely on that staying true.
  it("refuses data:image/svg+xml", () => {
    const out = sanitizeDocumentHtml('<img src="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==">');
    expect(out).not.toContain("svg");
  });

  it("keeps http(s) and mailto links", () => {
    const out = sanitizeDocumentHtml('<a href="https://example.com">a</a><a href="mailto:x@y.z">b</a>');
    expect(out).toContain("https://example.com");
    expect(out).toContain("mailto:x@y.z");
  });

  it("strips CSS that can fetch or execute, keeping plain formatting", () => {
    expect(sanitizeDocumentHtml('<p style="color: red">x</p>')).toContain('style="color: red"');
    expect(sanitizeDocumentHtml('<p style="background:url(https://evil.example/t.png)">x</p>')).not.toContain("url(");
    expect(sanitizeDocumentHtml('<p style="width:expression(alert(1))">x</p>')).not.toContain("expression");
  });

  it("unwraps an unexpected tag but keeps the text inside it", () => {
    const out = sanitizeDocumentHtml("<article><p>kept</p></article>");
    expect(out).toContain("kept");
    expect(out).not.toContain("article");
  });

  it("survives empty and malformed input", () => {
    expect(sanitizeDocumentHtml("")).toBe("");
    expect(() => sanitizeDocumentHtml("<p>unclosed")).not.toThrow();
  });
});
