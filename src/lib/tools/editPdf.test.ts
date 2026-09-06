// Edit PDF's pure logic, exercised against real PDFs.
//
// pdf-lib runs happily outside a browser, so every test here writes a document
// and then loads the result back and reads its content stream. That is worth
// doing rather than mocking: the things most likely to be wrong in an
// annotation tool — a mark on the wrong page, text turned on its side on a
// rotated scan, an image embedded once per placement — are all invisible until
// you look at what actually landed in the file.
import { describe, expect, it } from "vitest";
import { unzlibSync } from "fflate";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, degrees } from "pdf-lib";
import { editPdf, screenFrame, unwritableCharacters, type Annotation, type ImageSource } from "./editPdf";

async function pdfFile(build: (doc: PDFDocument) => void, name = "test.pdf"): Promise<File> {
  const doc = await PDFDocument.create();
  build(doc);
  const bytes = await doc.save();
  return new File([bytes as BlobPart], name, { type: "application/pdf" });
}

/**
 * The drawing operators pdf-lib wrote onto one page, as text.
 *
 * Content streams come back Flate-compressed, so they are inflated first —
 * fflate is already a dependency for the zip outputs elsewhere.
 */
async function contentOf(file: File, pageIndex = 0): Promise<string> {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  const page = doc.getPage(pageIndex);
  const contents = page.node.Contents();
  if (!contents) return "";
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  const parts: string[] = [];
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const bytes = stream.getContents();
    const filter = stream.dict.get(PDFName.of("Filter"));
    parts.push(new TextDecoder().decode(filter ? unzlibSync(bytes) : bytes));
  }
  // Text is written as a hex string; decoded here so assertions can name the
  // words a user typed rather than their code points.
  return parts.join("\n").replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) =>
    (hex.match(/../g) ?? []).map((byte) => String.fromCharCode(parseInt(byte, 16))).join(""),
  );
}

/**
 * How many distinct image objects the page actually references.
 *
 * Not the size of the XObject dictionary: pdf-lib mints a fresh resource name
 * on every `drawImage`, so three placements of one picture give three names
 * pointing at a single object. The object count is what decides the file size,
 * and it is what the embed cache exists to keep at one.
 */
async function distinctImages(file: File, pageIndex = 0): Promise<number> {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  const resources = doc.getPage(pageIndex).node.Resources();
  const xObjects = resources && doc.context.lookup(resources.get(PDFName.of("XObject")));
  if (!(xObjects instanceof PDFDict)) return 0;
  return new Set(xObjects.entries().map(([, value]) => value.toString())).size;
}

const TEXT: Annotation = {
  id: "t1",
  page: 1,
  kind: "text",
  at: { x: 100, y: 700 },
  text: "Approved",
  size: 18,
  color: "#d50000",
  font: "sans",
  bold: true,
};

// A 1x1 red PNG, the smallest thing pdf-lib will embed.
const PNG_BYTES = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);
const IMAGE_SOURCE: ImageSource = { id: "sig", format: "png", bytes: PNG_BYTES };

describe("editPdf", () => {
  it("refuses to save a document nobody has drawn on", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    await expect(editPdf(input, [])).rejects.toThrow(/Add something/);
  });

  it("names the output after the original and keeps every page", async () => {
    const input = await pdfFile((doc) => {
      doc.addPage([600, 800]);
      doc.addPage([600, 800]);
    }, "contract.pdf");

    const { file, drawn } = await editPdf(input, [TEXT]);
    expect(file.name).toBe("contract-edited.pdf");
    expect(drawn).toBe(1);
    const doc = await PDFDocument.load(await file.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
  });

  it("writes each annotation onto the page it belongs to and no other", async () => {
    const input = await pdfFile((doc) => {
      doc.addPage([600, 800]);
      doc.addPage([600, 800]);
    });

    const { file } = await editPdf(input, [
      TEXT,
      { ...TEXT, id: "t2", page: 2, text: "Second" },
    ]);

    await expect(contentOf(file, 0)).resolves.toContain("Approved");
    await expect(contentOf(file, 0)).resolves.not.toContain("Second");
    await expect(contentOf(file, 1)).resolves.toContain("Second");
  });

  it("rejects a page number the document doesn't have", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    await expect(editPdf(input, [{ ...TEXT, page: 4 }])).rejects.toThrow(/no page 4/);
  });

  it("draws text at the position it was given, in points", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const content = await contentOf((await editPdf(input, [TEXT])).file);
    // pdf-lib emits the text matrix as `a b c d e f Tm` — e and f are the
    // translation, which is where the baseline starts.
    expect(content).toMatch(/100(\.\d+)? 700(\.\d+)? Tm/);
  });

  it("turns text to match a page's baked-in rotation so it reads upright", async () => {
    // A page carrying /Rotate 90 is turned by the viewer. Text drawn at zero
    // degrees would arrive on its side, which is the classic annotation bug on
    // a sideways scan.
    const input = await pdfFile((doc) => void doc.addPage([600, 800]).setRotation(degrees(90)));
    const content = await contentOf((await editPdf(input, [TEXT])).file);
    // cos 90 = 0, sin 90 = 1 — the text matrix's rotation half.
    expect(content).toMatch(/0(\.\d+)? 1(\.\d+)? -1(\.\d+)? 0(\.\d+)? 100(\.\d+)? 700(\.\d+)? Tm/);
  });

  it("leaves text unrotated on an ordinary page", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const content = await contentOf((await editPdf(input, [TEXT])).file);
    expect(content).toMatch(/1 0 0 1 100(\.\d+)? 700(\.\d+)? Tm/);
  });

  it("refuses characters the built-in fonts cannot write, naming them", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    await expect(editPdf(input, [{ ...TEXT, text: "Одобрено" }])).rejects.toThrow(/can't write/);
  });

  it("accepts accented Latin text, which those fonts can write", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const { file } = await editPdf(input, [{ ...TEXT, text: "Réglé — 12 €" }]);
    expect(file.size).toBeGreaterThan(0);
  });

  it("draws an outline-only rectangle without filling it", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const shape: Annotation = { id: "r1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 140, y: 200 }, color: "#d50000", fill: null, thickness: 2, opacity: 1 };
    const content = await contentOf((await editPdf(input, [shape])).file);
    // "S" strokes the path; "f" or "B" would mean pdf-lib had filled it too.
    expect(content).toMatch(/\bS\b/);
    expect(content).not.toMatch(/\bB\b/);
  });

  it("fills a rectangle when a fill colour is set", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const shape: Annotation = { id: "r1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 140, y: 200 }, color: "#d50000", fill: "#ffffff", thickness: 2, opacity: 1 };
    const content = await contentOf((await editPdf(input, [shape])).file);
    expect(content).toMatch(/\bB\b/);
  });

  it("accepts corner points in either order", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const forwards: Annotation = { id: "r1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 140, y: 200 }, color: "#000000", fill: null, thickness: 2, opacity: 1 };
    const backwards: Annotation = { ...forwards, from: { x: 140, y: 200 }, to: { x: 40, y: 60 } };
    const a = await contentOf((await editPdf(input, [forwards])).file);
    const b = await contentOf((await editPdf(input, [backwards])).file);
    expect(a).toBe(b);
  });

  it("skips a shape too small to see rather than writing a degenerate path", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const speck: Annotation = { id: "r1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 40.1, y: 60.1 }, color: "#000000", fill: null, thickness: 2, opacity: 1 };
    await expect(editPdf(input, [speck])).resolves.toBeTruthy();
    const content = await contentOf((await editPdf(input, [speck])).file);
    expect(content.trim()).toBe("");
  });

  it("writes the whole pen stroke as a single path", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const stroke: Annotation = {
      id: "i1",
      page: 1,
      kind: "ink",
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 30 },
        { x: 40, y: 35 },
      ],
      color: "#1a1a1a",
      thickness: 2,
      opacity: 1,
      highlighter: false,
    };
    const content = await contentOf((await editPdf(input, [stroke])).file);
    // One move-to for the whole stroke, then a line-to for each point after the first.
    expect(content.match(/\bm\b/g) ?? []).toHaveLength(1);
    expect(content.match(/\bl\b/g) ?? []).toHaveLength(2);
  });

  it("still leaves a dot when the pen was tapped rather than dragged", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const dot: Annotation = { id: "i1", page: 1, kind: "ink", points: [{ x: 10, y: 10 }], color: "#1a1a1a", thickness: 4, opacity: 1, highlighter: false };
    const content = await contentOf((await editPdf(input, [dot])).file);
    // A zero-length line with a round cap is exactly a dot.
    expect(content).toMatch(/\bm\b/);
    expect(content).toMatch(/\bl\b/);
  });

  it("gives highlighter strokes a multiply blend so the words underneath survive", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const base: Annotation = { id: "i1", page: 1, kind: "ink", points: [{ x: 10, y: 10 }, { x: 90, y: 10 }], color: "#ffe600", thickness: 14, opacity: 0.4, highlighter: true };
    const highlighted = await editPdf(input, [base]);
    const plain = await editPdf(input, [{ ...base, id: "i2", highlighter: false }]);
    const doc = await PDFDocument.load(await highlighted.file.arrayBuffer());
    // The blend mode lives in an ExtGState in the page's resources.
    expect(JSON.stringify(doc.context.enumerateIndirectObjects().map(([, o]) => o.toString()))).toContain("Multiply");
    const plainDoc = await PDFDocument.load(await plain.file.arrayBuffer());
    expect(JSON.stringify(plainDoc.context.enumerateIndirectObjects().map(([, o]) => o.toString()))).not.toContain("Multiply");
  });

  it("embeds a picture once however many times it is placed", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const stamp: Annotation = { id: "m1", page: 1, kind: "image", from: { x: 10, y: 10 }, to: { x: 110, y: 60 }, source: IMAGE_SOURCE };
    const { file } = await editPdf(input, [
      stamp,
      { ...stamp, id: "m2", from: { x: 200, y: 400 }, to: { x: 300, y: 450 } },
      { ...stamp, id: "m3", from: { x: 300, y: 600 }, to: { x: 400, y: 650 } },
    ]);
    await expect(distinctImages(file)).resolves.toBe(1);
    const content = await contentOf(file);
    expect(content.match(/\bDo\b/g) ?? []).toHaveLength(3);
  });
});

describe("screenFrame", () => {
  // The box arrives axis-aligned in PDF space. What changes with the page's own
  // rotation is which corner the viewer shows bottom-left, and therefore where
  // an image has to be anchored to come out the right way up.
  const from = { x: 100, y: 200 };
  const to = { x: 300, y: 500 };

  it("anchors at the bottom-left corner on an unrotated page", () => {
    expect(screenFrame(from, to, 0)).toEqual({ x: 100, y: 200, width: 200, height: 300, rotate: 0 });
  });

  it("swaps the sides and moves the anchor a quarter turn round the box", () => {
    expect(screenFrame(from, to, 90)).toEqual({ x: 300, y: 200, width: 300, height: 200, rotate: 90 });
    expect(screenFrame(from, to, 180)).toEqual({ x: 300, y: 500, width: 200, height: 300, rotate: 180 });
    expect(screenFrame(from, to, 270)).toEqual({ x: 100, y: 500, width: 300, height: 200, rotate: 270 });
  });

  it("normalises a rotation given the long way round, or backwards", () => {
    expect(screenFrame(from, to, 450)).toEqual(screenFrame(from, to, 90));
    expect(screenFrame(from, to, -90)).toEqual(screenFrame(from, to, 270));
  });

  it("does not care which corner it was handed first", () => {
    expect(screenFrame(to, from, 90)).toEqual(screenFrame(from, to, 90));
  });
});

describe("unwritableCharacters", () => {
  it("passes the Latin text these fonts were built for", () => {
    expect(unwritableCharacters("Paid in full — £42.50, 20/05/26 (ref. #A9)")).toEqual([]);
    expect(unwritableCharacters("Réglé à Genève, naïve façade, Ærø")).toEqual([]);
  });

  it("names each unwritable character once, in order", () => {
    expect(unwritableCharacters("ok 好 好 ✓")).toEqual(["好", "✓"]);
  });

  it("catches emoji, which are the ones people actually try", () => {
    expect(unwritableCharacters("Done 👍")).toEqual(["👍"]);
  });

  it("allows the typographic extras Word inserts without asking", () => {
    // Curly quotes, an em dash and an ellipsis are all in WinAnsi, so pasting
    // from a word processor works rather than failing at the save step.
    expect(unwritableCharacters("“It’s fine” — really…")).toEqual([]);
  });
});
