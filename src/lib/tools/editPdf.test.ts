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
import {
  LINE_HEIGHT,
  editPdf,
  isSafeLinkUrl,
  markSegment,
  readFormFields,
  screenDown,
  screenFrame,
  standardFontFor,
  unwritableCharacters,
  type Annotation,
  type ImageSource,
} from "./editPdf";

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

/**
 * The baseline origin of every text run in a content stream.
 *
 * Read out of the `a b c d e f Tm` matrices rather than matched with a literal
 * regex, because a rotation of 90 degrees is written as cos(90) — an epsilon
 * around 6.1e-17, not a clean zero.
 */
function textOrigins(content: string): { x: number; y: number }[] {
  const matrix = /(-?[\d.e-]+) (-?[\d.e-]+) (-?[\d.e-]+) (-?[\d.e-]+) (-?[\d.e-]+) (-?[\d.e-]+) Tm/g;
  return [...content.matchAll(matrix)].map((m) => ({ x: Number(m[5]), y: Number(m[6]) }));
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
  italic: false,
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
    const shape: Annotation = { id: "r1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 140, y: 200 }, stroke: "#d50000", fill: null, thickness: 2, opacity: 1 };
    const content = await contentOf((await editPdf(input, [shape])).file);
    // "S" strokes the path; "f" or "B" would mean pdf-lib had filled it too.
    expect(content).toMatch(/\bS\b/);
    expect(content).not.toMatch(/\bB\b/);
  });

  it("fills a rectangle when a fill colour is set", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const shape: Annotation = { id: "r1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 140, y: 200 }, stroke: "#d50000", fill: "#ffffff", thickness: 2, opacity: 1 };
    const content = await contentOf((await editPdf(input, [shape])).file);
    expect(content).toMatch(/\bB\b/);
  });

  it("accepts corner points in either order", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const forwards: Annotation = { id: "r1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 140, y: 200 }, stroke: "#000000", fill: null, thickness: 2, opacity: 1 };
    const backwards: Annotation = { ...forwards, from: { x: 140, y: 200 }, to: { x: 40, y: 60 } };
    const a = await contentOf((await editPdf(input, [forwards])).file);
    const b = await contentOf((await editPdf(input, [backwards])).file);
    expect(a).toBe(b);
  });

  it("skips a shape too small to see rather than writing a degenerate path", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const speck: Annotation = { id: "r1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 40.1, y: 60.1 }, stroke: "#000000", fill: null, thickness: 2, opacity: 1 };
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
    };
    const content = await contentOf((await editPdf(input, [stroke])).file);
    // One move-to for the whole stroke, then a line-to for each point after the first.
    expect(content.match(/\bm\b/g) ?? []).toHaveLength(1);
    expect(content.match(/\bl\b/g) ?? []).toHaveLength(2);
  });

  it("still leaves a dot when the pen was tapped rather than dragged", async () => {
    const input = await pdfFile((doc) => void doc.addPage([600, 800]));
    const dot: Annotation = { id: "i1", page: 1, kind: "ink", points: [{ x: 10, y: 10 }], color: "#1a1a1a", thickness: 4, opacity: 1 };
    const content = await contentOf((await editPdf(input, [dot])).file);
    // A zero-length line with a round cap is exactly a dot.
    expect(content).toMatch(/\bm\b/);
    expect(content).toMatch(/\bl\b/);
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

describe("multi-line text", () => {
  // pdf-lib can break lines itself, but its line breaking ignores the `rotate`
  // option — a two-line note on a rotated page would stack sideways. So lines
  // are placed one at a time, down whichever direction the viewer calls down.
  it("stacks lines downward on an unrotated page", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const input = new File([(await doc.save()) as BlobPart], "t.pdf");
    const note: Annotation = { id: "t1", page: 1, kind: "text", at: { x: 100, y: 700 }, text: "one\ntwo", size: 10, color: "#000000", font: "sans", bold: false, italic: false };
    const content = await contentOf((await editPdf(input, [note])).file);
    const baselines = textOrigins(content);
    expect(baselines).toHaveLength(2);
    expect(baselines[0]).toEqual({ x: 100, y: 700 });
    expect(baselines[1].x).toBe(100);
    expect(baselines[1].y).toBeCloseTo(700 - 10 * LINE_HEIGHT, 6);
  });

  it("stacks lines along the page's own idea of down when it is rotated", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]).setRotation(degrees(90));
    const input = new File([(await doc.save()) as BlobPart], "t.pdf");
    const note: Annotation = { id: "t1", page: 1, kind: "text", at: { x: 100, y: 700 }, text: "one\ntwo", size: 10, color: "#000000", font: "sans", bold: false, italic: false };
    const content = await contentOf((await editPdf(input, [note])).file);
    const baselines = textOrigins(content);
    // Down on a /Rotate 90 page is +x, so the second line steps across, not down.
    expect(baselines[0]).toEqual({ x: 100, y: 700 });
    expect(baselines[1].y).toBe(700);
    expect(baselines[1].x).toBeCloseTo(100 + 10 * LINE_HEIGHT, 6);
  });

  it("skips blank lines rather than emitting an empty text run", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const input = new File([(await doc.save()) as BlobPart], "t.pdf");
    const note: Annotation = { id: "t1", page: 1, kind: "text", at: { x: 100, y: 700 }, text: "one\n\nthree", size: 10, color: "#000000", font: "sans", bold: false, italic: false };
    const content = await contentOf((await editPdf(input, [note])).file);
    expect(content.match(/\bTm\b/g) ?? []).toHaveLength(2);
  });
});

describe("lines and arrows", () => {
  const shaft: Annotation = { id: "l1", page: 1, kind: "line", from: { x: 100, y: 100 }, to: { x: 300, y: 100 }, color: "#d50000", thickness: 2, opacity: 1, arrow: false };

  async function blank() {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    return new File([(await doc.save()) as BlobPart], "t.pdf");
  }

  it("draws a plain line as a single subpath", async () => {
    const content = await contentOf((await editPdf(await blank(), [shaft])).file);
    expect(content.match(/\bm\b/g) ?? []).toHaveLength(1);
    expect(content.match(/\bl\b/g) ?? []).toHaveLength(1);
  });

  it("adds two barbs, and only at the far end", async () => {
    const content = await contentOf((await editPdf(await blank(), [{ ...shaft, arrow: true }])).file);
    // Shaft plus one subpath per barb.
    expect(content.match(/\bm\b/g) ?? []).toHaveLength(3);
    expect(content.match(/\bl\b/g) ?? []).toHaveLength(3);
    // Both barbs converge on the arrow's tip, never on its tail.
    expect(content.match(/300 -100 l/g) ?? []).toHaveLength(3);
  });

  it("keeps the barbs inside a very short arrow instead of overshooting the tail", async () => {
    const stubby: Annotation = { ...shaft, arrow: true, to: { x: 104, y: 100 }, thickness: 6 };
    const content = await contentOf((await editPdf(await blank(), [stubby])).file);
    const xs = [...content.matchAll(/(-?\d+(?:\.\d+)?) -100 [ml]/g)].map((m) => Number(m[1]));
    // Unclamped, 6pt thickness would put the barbs 24pt back from a 4pt line.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(100);
  });

  it("ignores a line with no length", async () => {
    const content = await contentOf((await editPdf(await blank(), [{ ...shaft, to: { x: 100, y: 100 } }])).file);
    expect(content.trim()).toBe("");
  });
});

describe("text mark-up", () => {
  const box = { from: { x: 100, y: 500 }, to: { x: 260, y: 512 } };

  async function blank(rotation = 0) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    if (rotation) page.setRotation(degrees(rotation));
    return new File([(await doc.save()) as BlobPart], "t.pdf");
  }

  it("fills one rectangle per line, multiplied so the words show through", async () => {
    const mark: Annotation = { id: "m1", page: 1, kind: "mark", style: "highlight", boxes: [box, { from: { x: 100, y: 486 }, to: { x: 200, y: 498 } }], color: "#ffe600", opacity: 0.45 };
    const { file } = await editPdf(await blank(), [mark]);
    const content = await contentOf(file);
    // pdf-lib builds rectangles as an explicit closed path rather than with
    // the `re` operator, so closepath is what there is one of per box.
    expect(content.match(/\bh\b/g) ?? []).toHaveLength(2);
    const doc = await PDFDocument.load(await file.arrayBuffer());
    expect(JSON.stringify(doc.context.enumerateIndirectObjects().map(([, o]) => o.toString()))).toContain("Multiply");
  });

  it("draws underline and strikethrough at different heights in the same box", async () => {
    const under = await contentOf((await editPdf(await blank(), [{ id: "m1", page: 1, kind: "mark", style: "underline", boxes: [box], color: "#d50000", opacity: 1 }])).file);
    const strike = await contentOf((await editPdf(await blank(), [{ id: "m1", page: 1, kind: "mark", style: "strike", boxes: [box], color: "#d50000", opacity: 1 }])).file);
    const heightOf = (content: string) => Number(/100 (-?\d+(?:\.\d+)?) m/.exec(content)![1]);
    // The underline sits lower on the page than the strikethrough.
    expect(heightOf(under)).toBeLessThan(heightOf(strike));
  });

  it("skips a box too small to be a line of text", async () => {
    const content = await contentOf((await editPdf(await blank(), [{ id: "m1", page: 1, kind: "mark", style: "highlight", boxes: [{ from: { x: 10, y: 10 }, to: { x: 10.2, y: 10.2 } }], color: "#ffe600", opacity: 0.4 }])).file);
    expect(content.trim()).toBe("");
  });
});

describe("whiteout", () => {
  it("fills without an outline, so nothing frames the patch", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const input = new File([(await doc.save()) as BlobPart], "t.pdf");
    const patch: Annotation = { id: "w1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 200, y: 90 }, stroke: null, fill: "#ffffff", thickness: 0, opacity: 1 };
    const content = await contentOf((await editPdf(input, [patch])).file);
    expect(content).toMatch(/\bf\b/);
    expect(content).not.toMatch(/\bS\b/);
    expect(content).not.toMatch(/\bB\b/);
  });

  it("draws nothing at all when neither a fill nor an outline is set", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const input = new File([(await doc.save()) as BlobPart], "t.pdf");
    const empty: Annotation = { id: "s1", page: 1, kind: "rect", from: { x: 40, y: 60 }, to: { x: 200, y: 90 }, stroke: null, fill: null, thickness: 2, opacity: 1 };
    const content = await contentOf((await editPdf(input, [empty])).file);
    expect(content.trim()).toBe("");
  });
});

describe("screenDown", () => {
  it("points down the page when nothing is rotated", () => {
    expect(screenDown(0)).toEqual({ x: 0, y: -1 });
  });

  it("follows the viewer round each quarter turn", () => {
    expect(screenDown(90)).toEqual({ x: 1, y: 0 });
    expect(screenDown(180)).toEqual({ x: 0, y: 1 });
    expect(screenDown(270)).toEqual({ x: -1, y: 0 });
  });

  it("normalises angles given the long way round, or backwards", () => {
    expect(screenDown(450)).toEqual(screenDown(90));
    expect(screenDown(-90)).toEqual(screenDown(270));
  });
});

describe("markSegment", () => {
  const from = { x: 100, y: 500 };
  const to = { x: 300, y: 520 };

  it("runs across the box, at the requested depth from the top", () => {
    expect(markSegment(from, to, 0, 0.5)).toEqual([{ x: 100, y: 510 }, { x: 300, y: 510 }]);
  });

  it("measures depth from whichever edge the viewer shows as the top", () => {
    // Unrotated, deeper means further down the page; at 180 the page is upside
    // down, so deeper means further UP it.
    const [a] = markSegment(from, to, 0, 0.9);
    const [b] = markSegment(from, to, 180, 0.9);
    expect(a.y).toBeLessThan(510);
    expect(b.y).toBeGreaterThan(510);
  });

  it("runs the other way across the box on a quarter-turned page", () => {
    const [start, end] = markSegment(from, to, 90, 0.5);
    expect(start.x).toBe(200);
    expect(end.x).toBe(200);
    expect([start.y, end.y]).toEqual([500, 520]);
  });

  it("does not care which corner it was handed first", () => {
    expect(markSegment(to, from, 0, 0.5)).toEqual(markSegment(from, to, 0, 0.5));
  });
});

describe("standardFontFor", () => {
  it("picks the right one of the twelve built-in faces", () => {
    expect(standardFontFor("sans", false, false)).toBe("Helvetica");
    expect(standardFontFor("sans", true, false)).toBe("Helvetica-Bold");
    expect(standardFontFor("sans", false, true)).toBe("Helvetica-Oblique");
    expect(standardFontFor("sans", true, true)).toBe("Helvetica-BoldOblique");
    expect(standardFontFor("serif", false, true)).toBe("Times-Italic");
    expect(standardFontFor("mono", true, true)).toBe("Courier-BoldOblique");
  });

  it("falls back to a sans face rather than throwing on an unknown family", () => {
    expect(standardFontFor("script" as never, false, false)).toBe("Helvetica");
  });
});

describe("isSafeLinkUrl", () => {
  it("accepts the three schemes that mean open the web or start an email", () => {
    expect(isSafeLinkUrl("https://example.com/a?b=1")).toBe(true);
    expect(isSafeLinkUrl("http://example.com")).toBe(true);
    expect(isSafeLinkUrl("mailto:someone@example.com")).toBe(true);
    expect(isSafeLinkUrl("  https://example.com  ")).toBe(true);
  });

  it("refuses schemes a reader would execute rather than open", () => {
    // The document goes to someone else, and their reader will follow whatever
    // is in the link — so this is an allowlist, not a blocklist.
    expect(isSafeLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeLinkUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeLinkUrl("JavaScript:alert(1)")).toBe(false);
  });

  it("refuses anything that is not a URL at all", () => {
    expect(isSafeLinkUrl("example.com")).toBe(false);
    expect(isSafeLinkUrl("")).toBe(false);
  });
});

describe("links", () => {
  async function blank() {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    return new File([(await doc.save()) as BlobPart], "t.pdf");
  }

  const link: Annotation = { id: "k1", page: 1, kind: "link", from: { x: 100, y: 700 }, to: { x: 260, y: 716 }, url: "https://example.com/terms" };

  it("writes a Link annotation carrying the URL", async () => {
    const { file } = await editPdf(await blank(), [link]);
    const doc = await PDFDocument.load(await file.arrayBuffer());
    const dump = doc.context
      .enumerateIndirectObjects()
      .map(([, o]) => o.toString())
      .join("\n");
    expect(dump).toContain("/Link");
    expect(dump).toContain("https://example.com/terms");
  });

  it("attaches the annotation to the page rather than orphaning it", async () => {
    const { file } = await editPdf(await blank(), [link]);
    const doc = await PDFDocument.load(await file.arrayBuffer());
    expect(doc.getPage(0).node.Annots()?.size()).toBe(1);
  });

  it("keeps the annotations a page already had", async () => {
    const { file } = await editPdf(await blank(), [link, { ...link, id: "k2", from: { x: 100, y: 600 }, to: { x: 260, y: 616 } }]);
    const doc = await PDFDocument.load(await file.arrayBuffer());
    expect(doc.getPage(0).node.Annots()?.size()).toBe(2);
  });

  it("refuses a script URL instead of writing it into the file", async () => {
    await expect(editPdf(await blank(), [{ ...link, url: "javascript:alert(1)" }])).rejects.toThrow(/isn't a link/);
  });
});

describe("forms", () => {
  async function blank(rotation = 0) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    if (rotation) page.setRotation(degrees(rotation));
    return new File([(await doc.save()) as BlobPart], "t.pdf");
  }

  const textField = { id: "f1", page: 1, kind: "text" as const, name: "fullName", from: { x: 100, y: 700 }, to: { x: 340, y: 724 } };

  it("saves a document that only changes the form, with nothing drawn", async () => {
    const { file, drawn } = await editPdf(await blank(), [], { newFields: [textField] });
    expect(drawn).toBe(1);
    await expect(readFormFields(file)).resolves.toHaveLength(1);
  });

  it("still refuses a save that changes nothing at all", async () => {
    await expect(editPdf(await blank(), [], {})).rejects.toThrow(/Add something/);
  });

  it("creates each kind of field, and reads it back", async () => {
    const { file } = await editPdf(await blank(), [], {
      newFields: [
        textField,
        { id: "f2", page: 1, kind: "checkbox", name: "agreed", from: { x: 100, y: 660 }, to: { x: 116, y: 676 } },
        { id: "f3", page: 1, kind: "dropdown", name: "plan", from: { x: 100, y: 600 }, to: { x: 240, y: 624 }, options: ["Monthly", "Yearly"] },
      ],
    });
    const fields = await readFormFields(file);
    expect(fields.map((f) => [f.name, f.kind]).sort()).toEqual([
      ["agreed", "checkbox"],
      ["fullName", "text"],
      ["plan", "dropdown"],
    ]);
    expect(fields.find((f) => f.name === "plan")?.options).toEqual(["Monthly", "Yearly"]);
  });

  it("fills a field it has just created, in the same pass", async () => {
    const { file } = await editPdf(await blank(), [], { newFields: [textField], formValues: { fullName: "Ada Lovelace" } });
    const fields = await readFormFields(file);
    expect(fields[0].value).toBe("Ada Lovelace");
  });

  it("fills fields the document already had", async () => {
    const { file: withField } = await editPdf(await blank(), [], {
      newFields: [textField, { id: "f2", page: 1, kind: "checkbox", name: "agreed", from: { x: 100, y: 660 }, to: { x: 116, y: 676 } }],
    });
    const { file } = await editPdf(withField, [], { formValues: { fullName: "Grace Hopper", agreed: true } });
    const fields = await readFormFields(file);
    expect(fields.find((f) => f.name === "fullName")?.value).toBe("Grace Hopper");
    expect(fields.find((f) => f.name === "agreed")?.value).toBe(true);
  });

  it("reports where each field sits, so the page can point at it", async () => {
    const { file } = await editPdf(await blank(), [], { newFields: [textField] });
    const [field] = await readFormFields(file);
    expect(field.places).toHaveLength(1);
    expect(field.places[0].page).toBe(1);
    // Within a point: pdf-lib insets a widget's rectangle by half its border
    // width, so the box comes back a hair inside where it was asked for.
    expect(Math.abs(field.places[0].from.x - 100)).toBeLessThanOrEqual(1);
  });

  it("refuses a duplicate field name rather than corrupting the form", async () => {
    await expect(editPdf(await blank(), [], { newFields: [textField, { ...textField, id: "f2" }] })).rejects.toThrow(/already has a field/);
  });

  it("says plainly that a rotated page cannot take a field", async () => {
    // pdf-lib places widgets in unrotated user space, so a field on a turned
    // page lands sideways. Refusing beats shipping a broken form.
    await expect(editPdf(await blank(90), [], { newFields: [textField] })).rejects.toThrow(/rotated/);
  });

  it("returns nothing for a document with no form, rather than inventing one", async () => {
    await expect(readFormFields(await blank())).resolves.toEqual([]);
  });

  it("ignores a value for a field that does not exist", async () => {
    const { file } = await editPdf(await blank(), [], { newFields: [textField], formValues: { nope: "x", fullName: "Ada" } });
    const fields = await readFormFields(file);
    expect(fields).toHaveLength(1);
    expect(fields[0].value).toBe("Ada");
  });
});
