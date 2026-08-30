// DOCX -> HTML (mammoth) -> PDF (jsPDF's .html(), which renders via html2canvas
// under the hood). Works well for straightforward documents; complex layouts
// (multi-column, precise page breaks, tables that span pages) won't paginate
// perfectly — an inherent limit of the "render HTML to canvas" approach, not
// something worth pretending isn't there.
import mammoth from "mammoth";
import jsPDF from "jspdf";

export async function wordToPdf(file: File): Promise<File> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const container = document.createElement("div");
  container.style.cssText =
    "width: 700px; padding: 24px; font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.5; color: #000; background: #fff; position: fixed; top: -99999px; left: -99999px;";
  container.innerHTML = html || "<p></p>";
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    await pdf.html(container, {
      width: 555,
      windowWidth: 700,
      margin: [40, 20, 40, 20],
      autoPaging: "text",
    });
    const blob = pdf.output("blob");
    return new File([blob], `${file.name.replace(/\.docx?$/i, "")}.pdf`, { type: "application/pdf" });
  } finally {
    document.body.removeChild(container);
  }
}
