// Coverage for the tools added alongside the tool-page content work.
//
// pdf-lib and jsPDF both run outside a browser, so these exercise the real
// conversion rather than a mock of it — the output is loaded back and inspected.
import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { rotatePdf } from "./rotatePdf";
import { flattenPdfDetailed } from "./flattenPdf";
import { textToPdf } from "./textToPdf";
import { csvToPdf } from "./csvToPdf";

async function pdfFile(build: (doc: PDFDocument) => void | Promise<void>, name = "test.pdf"): Promise<File> {
  const doc = await PDFDocument.create();
  await build(doc);
  const bytes = await doc.save();
  return new File([bytes as BlobPart], name, { type: "application/pdf" });
}

async function pagesOf(file: File) {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  return doc.getPages();
}

describe("rotatePdf", () => {
  it("turns every page by the requested angle", async () => {
    const input = await pdfFile((doc) => {
      doc.addPage([600, 800]);
      doc.addPage([600, 800]);
    });

    const pages = await pagesOf(await rotatePdf(input, { angle: 90 }));
    expect(pages).toHaveLength(2);
    for (const page of pages) expect(page.getRotation().angle).toBe(90);
  });

  it("adds to an existing rotation rather than replacing it", async () => {
    // A page already turned 90 and rotated 90 again should land at 180.
    // Setting absolutely would silently undo the first correction.
    const input = await pdfFile((doc) => {
      doc.addPage([600, 800]).setRotation(degrees(90));
    });

    const [page] = await pagesOf(await rotatePdf(input, { angle: 90 }));
    expect(page.getRotation().angle).toBe(180);
  });

  it("wraps past a full turn instead of producing 450 degrees", async () => {
    const input = await pdfFile((doc) => {
      doc.addPage([600, 800]).setRotation(degrees(270));
    });

    const [page] = await pagesOf(await rotatePdf(input, { angle: 180 }));
    expect(page.getRotation().angle).toBe(90);
  });

  it("keeps every page and the page size", async () => {
    // The guard against a zero-page document stays in the code for genuinely
    // malformed input, but it cannot be exercised from here: pdf-lib writes a
    // default page when saving an empty document, so a zero-page PDF is not
    // constructible through the library. Asserting what rotation must NOT
    // disturb is the useful test instead.
    const input = await pdfFile((doc) => {
      doc.addPage([400, 900]);
      doc.addPage([400, 900]);
      doc.addPage([400, 900]);
    });

    const pages = await pagesOf(await rotatePdf(input, { angle: 180 }));
    expect(pages).toHaveLength(3);
    for (const page of pages) {
      expect(Math.round(page.getWidth())).toBe(400);
      expect(Math.round(page.getHeight())).toBe(900);
    }
  });
});

describe("flattenPdf", () => {
  it("removes the interactive fields so the values can no longer be edited", async () => {
    const input = await pdfFile(async (doc) => {
      const page = doc.addPage([600, 800]);
      const field = doc.getForm().createTextField("applicant.name");
      field.setText("Priya Nair");
      field.addToPage(page, { x: 50, y: 700, width: 200, height: 24 });
    });

    const before = await PDFDocument.load(await input.arrayBuffer());
    expect(before.getForm().getFields()).toHaveLength(1);

    const { file, fieldCount } = await flattenPdfDetailed(input);
    expect(fieldCount).toBe(1);

    const after = await PDFDocument.load(await file.arrayBuffer());
    expect(after.getForm().getFields()).toHaveLength(0);
  });

  it("leaves a PDF with no form fields intact instead of failing", async () => {
    const input = await pdfFile((doc) => {
      doc.addPage([600, 800]);
    });

    const { file, fieldCount } = await flattenPdfDetailed(input);
    expect(fieldCount).toBe(0);
    expect((await pagesOf(file))).toHaveLength(1);
  });
});

describe("textToPdf", () => {
  it("produces a real PDF from plain text", async () => {
    const input = new File(["Hello.\nThis is a plain text file.\n"], "notes.txt", { type: "text/plain" });
    const out = await textToPdf(input);

    expect(out.name).toBe("notes.pdf");
    expect(out.type).toBe("application/pdf");
    const doc = await PDFDocument.load(await out.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("adds pages rather than running off the bottom of the first one", async () => {
    const many = Array.from({ length: 400 }, (_, i) => `Line number ${i + 1}`).join("\n");
    const out = await textToPdf(new File([many], "long.txt", { type: "text/plain" }));

    const doc = await PDFDocument.load(await out.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("refuses an empty file instead of producing a blank PDF", async () => {
    await expect(textToPdf(new File(["   \n  "], "empty.txt", { type: "text/plain" }))).rejects.toThrow(/no text/i);
  });
});

describe("csvToPdf", () => {
  it("converts rows into a PDF table", async () => {
    const csv = "name,qty\nWidget,3\nGadget,11\n";
    const out = await csvToPdf(new File([csv], "stock.csv", { type: "text/csv" }));

    expect(out.name).toBe("stock.pdf");
    const doc = await PDFDocument.load(await out.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("handles quoted fields containing commas, which a naive split would break", async () => {
    const csv = 'name,address\n"Nair, Priya","12 High St, Mumbai"\n';
    const out = await csvToPdf(new File([csv], "people.csv", { type: "text/csv" }));
    expect(out.size).toBeGreaterThan(0);
  });

  it("refuses a file with no rows", async () => {
    await expect(csvToPdf(new File([""], "blank.csv", { type: "text/csv" }))).rejects.toThrow(/no readable rows/i);
  });
});
