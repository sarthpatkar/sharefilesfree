// The editorial half of every tool page.
//
// Why this file exists
// --------------------
// Measured on the live site, each tool page carried about 205 words — and of
// those, roughly 30 were the header nav, 110 the footer, and 38 a paragraph
// repeated identically on all nineteen pages. Around twenty words were actually
// about the tool. Nineteen pages that differ by a title and one sentence are
// thin pages by any reading, and two things follow from that: Google has almost
// nothing to rank them on, and an AdSense reviewer sees exactly the "low value
// content" pattern that gets a site rejected. The only revenue this project has
// was blocked behind it.
//
// So this is not filler written to hit a word count. Each entry answers what
// somebody actually arrives wanting to know — what the tool does, how to drive
// it, and above all what it CANNOT do. The honest limitations are the most
// valuable part: they are what a search result cannot tell you, they are why
// someone trusts the page, and they are already true of these tools. Where a
// conversion is rough, it says so here rather than letting somebody discover it
// after processing a document they cared about.
//
// Kept out of registry.tsx deliberately — that file wires tools into the app and
// should stay readable as wiring.

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolContent {
  /** Two or three paragraphs. What it does, who it is for, why it works this way. */
  intro: string[];
  /** How to actually use it, in order. */
  steps: string[];
  /** What it will not do, stated before someone finds out the hard way. */
  limits: string[];
  /** Questions people genuinely ask. Rendered, and emitted as FAQPage markup. */
  faqs: ToolFaq[];
}

/** Shared across every entry: the reason any of this is possible in a browser. */
const PRIVACY_FAQ: ToolFaq = {
  q: "Is my file uploaded anywhere?",
  a: "No. Everything happens inside your browser on your own device. The file is never sent to us, so there is no upload, no queue, no server to be breached and nothing for us to delete afterwards. You can prove it by opening the tool, disconnecting from the internet, and using it anyway — it still works.",
};

const NO_LIMIT_FAQ: ToolFaq = {
  q: "Is there a file size limit or a daily cap?",
  a: "No cap on either. Because the work happens on your device rather than on a server we pay for, a large file costs us nothing, so there is no reason to ration it. The only real limit is your device's own memory, and you would need a very large document to reach it.",
};

const FREE_FAQ: ToolFaq = {
  q: "Is it really free, and is there a watermark?",
  a: "Free, with no watermark, no sign-up and no trial. The site is paid for by advertising rather than by charging you or by quietly degrading the output.",
};

export const TOOL_CONTENT: Record<string, ToolContent> = {
  "merge-pdf": {
    intro: [
      "Combining PDFs is the most common thing anyone needs to do to one, and it is usually needed at the worst moment: a form and its attachments have to go as a single document, a scanned contract arrived as eight separate files, or a submission portal accepts one upload and you have three.",
      "This merges any number of PDFs into a single file, in an order you set by dragging. It runs entirely in your browser, so a merge of confidential documents does not involve handing them to anyone — which matters more for this operation than most, because the files people merge are usually the ones with signatures, invoices or ID scans in them.",
    ],
    steps: [
      "Drop in every PDF you want combined, or click to choose them. You can add more at any point before merging.",
      "Drag the files into the order you want. They are merged top to bottom, and the order shown is exactly the order you will get.",
      "Press merge. The new document is assembled on your device, which takes a moment for large files.",
      "Save the result, or hand it straight to the transfer page if you need to send it to someone.",
    ],
    limits: [
      "Page content is copied exactly as-is. Fonts, images and layout survive the merge untouched, because nothing is re-rendered.",
      "A password-protected PDF cannot be merged until the password is removed, since the pages cannot be read while they are encrypted.",
      "Form fields with the same name across two documents can collide, which is a property of the PDF format rather than of this tool. Flatten the forms first if the values matter.",
    ],
    faqs: [
      { q: "Does merging reduce the quality of the pages?", a: "No. Merging copies each page's existing content into a new document rather than re-rendering or re-compressing it, so text stays selectable and images keep their original resolution. The result is usually close to the sum of the input sizes for that reason." },
      { q: "How many PDFs can I merge at once?", a: "As many as you like. The practical ceiling is your device's memory, and merging dozens of ordinary documents is comfortable on a normal laptop or phone." },
      PRIVACY_FAQ,
      FREE_FAQ,
    ],
  },

  "split-pdf": {
    intro: [
      "Splitting is the other half of merging, and it is usually about sending someone less than everything. One chapter out of a report, the signature page of a contract, or a single invoice from a statement covering a year.",
      "You can pull out a range of pages as a new PDF, or break the document into one file per page and take the lot as a zip. Page thumbnails are rendered first so you are choosing by what you can see rather than by counting.",
    ],
    steps: [
      "Open the PDF you want to split. Thumbnails of every page are generated on your device.",
      "Choose a page range to extract, or switch to splitting every page into its own file.",
      "Check the preview matches what you meant — page numbering catches people out on documents with a cover page.",
      "Save the extracted PDF, or the zip if you split the whole document.",
    ],
    limits: [
      "Extracted pages keep their original content exactly. Nothing is re-rendered, so nothing is degraded.",
      "Links pointing at pages left behind in the original will no longer resolve, which is unavoidable when a page is removed from its document.",
      "Very long documents take a moment to generate thumbnails for, because every page is being rendered on your device rather than on a server.",
    ],
    faqs: [
      { q: "Can I extract non-consecutive pages, like 1, 4 and 9?", a: "Split each range you need and merge the results, or split every page and keep the ones you want. A single pass over scattered pages is on the list." },
      { q: "Will splitting shrink the file?", a: "Usually, but not proportionally. A PDF shares resources like fonts and images across pages, so a single page carried out of a document can bring more with it than you would expect." },
      PRIVACY_FAQ,
      NO_LIMIT_FAQ,
    ],
  },

  "organize-pdf": {
    intro: [
      "Scanners produce documents in the wrong order with impressive reliability: pages upside down, the last sheet first, a blank one in the middle where something fed twice.",
      "This shows the whole document as a grid of page thumbnails you can reorder, rotate and delete, then rebuilds it in the arrangement you leave it in. It is the tool to reach for when the content is right and only the arrangement is wrong.",
    ],
    steps: [
      "Open the PDF. Every page is rendered as a thumbnail so you can see what you are moving.",
      "Drag pages into the order you want, rotate any that came in sideways, and delete the ones that should not be there.",
      "Check the grid reads correctly end to end before rebuilding.",
      "Save the reorganised document.",
    ],
    limits: [
      "Rotation is stored as a page property, the way the format intends, so text stays selectable and nothing is re-rendered or degraded.",
      "Deleting a page cannot be undone after saving, so keep the original until you have checked the result.",
      "Documents with hundreds of pages take a while to render thumbnails for, because every page is drawn on your device.",
    ],
    faqs: [
      { q: "Does rotating a page reduce its quality?", a: "No. The rotation is recorded as an instruction on the page rather than by redrawing it, so the underlying content is untouched." },
      { q: "Can I add pages from another PDF here?", a: "Not in this tool — merge the two documents first, then organise the combined file." },
      PRIVACY_FAQ,
      FREE_FAQ,
    ],
  },

  "compress-pdf": {
    intro: [
      "PDFs are usually too big for the same two reasons: photographs saved at full camera resolution, and scans stored as images of pages rather than as text. Email limits and upload forms are what force the issue.",
      "Two modes are offered, and the difference between them is worth understanding before you pick. Light compression is lossless — it rewrites the file's structure and removes redundancy, typically saving 5 to 20 per cent, and changes nothing you can see. Strong compression rasterises each page to a JPEG, which can shrink an image-heavy document dramatically but destroys selectable text.",
    ],
    steps: [
      "Open the PDF you want smaller.",
      "Choose light compression if the text must stay selectable and searchable, or strong if size matters more than that.",
      "Compress, then compare the reported before and after sizes.",
      "Save it — or if it did not shrink usefully, keep the original.",
    ],
    limits: [
      "Strong compression converts pages into images. Text stops being selectable, searchable and screen-reader accessible. This is stated plainly rather than buried, because it is not reversible.",
      "An already-optimised PDF may barely shrink at all. When that happens the tool says so rather than showing a fake saving.",
      "A text-only document has little to compress, since the size is in the text itself. The big wins are in scans and photographs.",
    ],
    faqs: [
      { q: "Which mode should I use?", a: "Light, unless the file is still too large afterwards. Light is safe and reversible in the sense that nothing is lost. Only move to strong when you have decided the document does not need selectable text — a scan being emailed for reference, rather than a contract someone will search." },
      { q: "Why did my file barely get smaller?", a: "It was probably already optimised, or its size is in text and vector graphics rather than images. There is genuinely little to remove in that case, and we would rather tell you than pretend otherwise." },
      { q: "Will compression make my scan unreadable?", a: "Strong compression can soften fine detail on a low-quality scan. Check the result before deleting the original — the preview is there for that." },
      PRIVACY_FAQ,
    ],
  },

  "watermark-pdf": {
    intro: [
      "A watermark marks intent. DRAFT across a proposal, CONFIDENTIAL on something being circulated for review, or a name across a document being shared with one particular person.",
      "This stamps text across every page with control over size, angle, opacity and position, so it reads as a watermark rather than obscuring what is underneath.",
    ],
    steps: [
      "Open the PDF you want to mark.",
      "Type the watermark text — short is better, since it repeats on every page.",
      "Adjust opacity, size and rotation until it is legible without competing with the content. A diagonal watermark at low opacity is the convention because it works.",
      "Apply and save.",
    ],
    limits: [
      "The watermark is drawn onto the page, so it cannot be toggled off afterwards. Keep the unmarked original.",
      "It is a visual mark, not a security control. Anyone determined can remove it. It signals status; it does not enforce it.",
      "Text watermarks only for now — an image or logo watermark is not yet supported.",
    ],
    faqs: [
      { q: "Can somebody remove the watermark?", a: "With effort, yes. A watermark is a deterrent and a label, not protection. If a document genuinely must not be redistributed, a watermark is not the mechanism for that." },
      { q: "Can I watermark only some pages?", a: "Not currently — it applies to every page. Split the document, watermark the part you need, and merge it back if you need finer control." },
      PRIVACY_FAQ,
      FREE_FAQ,
    ],
  },

  "add-page-numbers": {
    intro: [
      "Page numbers matter most on documents people will print, sign or refer to out loud — contracts, submissions, reports discussed in a meeting where somebody needs to say \"page eleven\" and be understood.",
      "This adds them in any of six positions, starting from whatever number you choose, which is what you need when a document is one section of something larger.",
    ],
    steps: [
      "Open the PDF.",
      "Pick a position. Bottom centre and bottom right are the usual choices for anything that will be printed.",
      "Set the starting number if the first page should not be 1 — useful when a cover page is not counted.",
      "Apply and save.",
    ],
    limits: [
      "Numbers are drawn onto the pages, so they cannot be edited afterwards. Keep the original if the numbering might change.",
      "A page whose existing content reaches the very edge can collide with the number. Check the corners before you commit.",
      "Numbering is sequential through the document; per-section restarts are not supported.",
    ],
    faqs: [
      { q: "Can I skip numbering the cover page?", a: "Set the start number to account for it, or split the cover off, number the rest, and merge them back together." },
      { q: "Can I use formats like 'Page 3 of 12'?", a: "Not yet — plain numerals only at the moment." },
      PRIVACY_FAQ,
      NO_LIMIT_FAQ,
    ],
  },

  "images-to-pdf": {
    intro: [
      "Photographs of documents are how most paperwork actually gets captured now, and almost every place that receives paperwork wants a PDF rather than a folder of photos.",
      "This turns a set of images into a single PDF with one image per page, in the order you arrange them. It is the quickest route from a phone camera roll to something a submission form will accept.",
    ],
    steps: [
      "Add the images. JPEG and PNG both work, and you can add as many as you need.",
      "Put them in the right order — this is where receipts and multi-page forms usually go wrong.",
      "Create the PDF.",
      "Save it, or send it straight on from the transfer page.",
    ],
    limits: [
      "Each image becomes one page at its own aspect ratio, so a mix of portrait and landscape photos produces a mix of page shapes.",
      "Images are embedded at their original resolution. Photos straight from a modern phone make a large PDF; compress them first if size matters.",
      "There is no automatic edge detection or perspective correction — this places your images, it does not clean them up.",
    ],
    faqs: [
      { q: "Can I use HEIC photos from an iPhone?", a: "Convert them to JPEG first with the HEIC to JPG tool, then bring them here. Both steps run on your device." },
      { q: "Why is my PDF so large?", a: "Because full-resolution phone photos are large, and they are embedded as-is rather than being quietly degraded. Run the images through the image compressor first if you need a smaller result." },
      PRIVACY_FAQ,
      NO_LIMIT_FAQ,
    ],
  },

  "word-to-pdf": {
    intro: [
      "Sending a Word document asks the recipient to have Word, and to see the same layout you did — neither of which is safe to assume. A PDF removes both questions.",
      "This converts .docx documents in your browser. It handles straightforward documents well: text, headings, lists, basic tables and inline images.",
    ],
    steps: [
      "Open the .docx file.",
      "Wait for the conversion — a long document takes a moment, since your device is doing the rendering.",
      "Check the preview, particularly around page breaks and any tables.",
      "Save the PDF.",
    ],
    limits: [
      "Complex layouts may not paginate identically to Word. Multi-column layouts, floating text boxes, headers and footers, and precise table borders are the usual places a difference shows.",
      "Fonts not available in the browser are substituted, which can shift line breaks.",
      "Only .docx is supported. The older .doc format is a different thing entirely and is not handled.",
    ],
    faqs: [
      { q: "Will the PDF look exactly like it does in Word?", a: "For a straightforward document, very close. For anything with heavy layout work — columns, floating images, elaborate tables — expect differences, and check before sending. This is an honest limitation of converting in a browser rather than through Word itself." },
      { q: "Can I convert a PDF back into Word?", a: "There is a PDF to Word tool, but it is deliberately labelled basic: it recovers text, not layout. Converting in that direction is a genuinely harder problem." },
      PRIVACY_FAQ,
      FREE_FAQ,
    ],
  },

  "excel-to-pdf": {
    intro: [
      "Spreadsheets get sent as PDFs when the numbers are final and the recipient should read them rather than edit them — quotes, invoices, reports going to somebody who does not need the formulas.",
      "This renders each sheet as a table in a PDF, one sheet per page, keeping the values as they appear rather than the formulas behind them.",
    ],
    steps: [
      "Open the .xlsx or .csv file.",
      "Review the detected sheets and the data found in each.",
      "Convert, then check the column widths in the preview.",
      "Save the PDF.",
    ],
    limits: [
      "Cell formatting is not carried across. Colours, conditional formatting, merged cells and custom number formats are not reproduced — this is a clean table of values, not a picture of your spreadsheet.",
      "Very wide sheets have to compress columns to fit the page. Landscape data with many columns is where this looks worst.",
      "Charts and images embedded in the sheet are not included.",
    ],
    faqs: [
      { q: "Will my formatting and colours survive?", a: "No — the output is a plain table of the values. If the appearance matters as much as the numbers, exporting to PDF from your spreadsheet application will serve you better, and saying so is more useful than pretending otherwise." },
      { q: "Are formulas converted, or their results?", a: "The results, as they were last calculated in the file. A PDF has no concept of a formula." },
      PRIVACY_FAQ,
      NO_LIMIT_FAQ,
    ],
  },

  "pdf-to-powerpoint": {
    intro: [
      "Sometimes a deck exists only as a PDF and it needs to go back into PowerPoint — to be presented, or to have a slide pulled out of it.",
      "Each page becomes one slide. Be clear about what that means before you rely on it: every slide is an image of the original page, visually accurate but not editable text.",
    ],
    steps: [
      "Open the PDF.",
      "Convert. Each page is rendered on your device and placed on its own slide.",
      "Save the .pptx and open it in PowerPoint, Keynote or Google Slides.",
    ],
    limits: [
      "Slides contain images, not editable text boxes. You can present, reorder and annotate around them; you cannot click into a heading and retype it.",
      "That is a limitation of the problem rather than of this tool — no reliable browser-side engine reconstructs editable slides from a PDF, and one that pretended to would produce a mess.",
      "Page dimensions are preserved, so a PDF that was not slide-shaped produces unusually shaped slides.",
    ],
    faqs: [
      { q: "Why is the text not editable?", a: "A PDF page holds positioned glyphs, not the structure of a slide — there is no title, no bullet list, no text box to recover. Rebuilding that is guesswork, and guesswork produces a deck that is worse than an image. So the conversion is visually faithful and honest about being images." },
      { q: "What is this actually good for?", a: "Presenting a PDF as slides, adding your own annotations over the top, or lifting a single page into an existing deck." },
      PRIVACY_FAQ,
      FREE_FAQ,
    ],
  },

  "pdf-to-word": {
    intro: [
      "Getting text back out of a PDF is one of the most-searched conversions there is, and one of the most over-promised. This tool is deliberately labelled basic, and it is worth reading why before you use it on something important.",
      "It recovers the text with rough heading detection and produces a .docx you can edit. It does not reconstruct layout, columns, tables or images. For pulling the words out of a document so they can be rewritten, it does the job well. For reproducing the document, it does not.",
    ],
    steps: [
      "Open the PDF.",
      "Convert — text is extracted page by page on your device.",
      "Save the .docx and open it in Word or Google Docs.",
      "Expect to reapply formatting. The words will be there; the design will not.",
    ],
    limits: [
      "Layout is not preserved. Columns become sequential text, tables lose their structure, and images are not carried over.",
      "A scanned PDF contains no text at all, only pictures of text, so nothing can be extracted. Run it through the OCR tool first.",
      "Heading detection is inferred from font size and will not always agree with you.",
    ],
    faqs: [
      { q: "Why does my table come out as a jumble?", a: "Because a PDF has no concept of a table — only text at coordinates. Reconstructing rows and columns from positions is genuinely hard and frequently wrong, so this tool does not guess. That is why it says basic." },
      { q: "Nothing was extracted from my file. Why?", a: "It is almost certainly a scan: an image of a page rather than text. Use the OCR tool to recognise the characters first, then convert." },
      { q: "Is there a converter that does keep layout?", a: "Ones that do it well run substantial software on a server, which means uploading your document. That trade is available elsewhere; this site does not make it." },
      PRIVACY_FAQ,
    ],
  },

  "pdf-to-excel": {
    intro: [
      "Numbers arrive locked in PDFs constantly — bank statements, invoices, published reports — and getting them into a spreadsheet is usually retyping.",
      "This extracts text line by line into a spreadsheet, which saves the typing. It is labelled basic for a specific reason: it does not detect real table structure, because a PDF does not contain any.",
    ],
    steps: [
      "Open the PDF.",
      "Convert — each line of text becomes a row.",
      "Save the .xlsx and open it in Excel, Numbers or Google Sheets.",
      "Split the columns yourself using your spreadsheet's text-to-columns feature.",
    ],
    limits: [
      "Columns are not detected. You get the text of each line, and separating it into fields is a step you do afterwards.",
      "A scanned PDF has no text to extract. OCR it first.",
      "Multi-line cells and merged headers will not survive, since neither exists in the source.",
    ],
    faqs: [
      { q: "Why are all my values in one column?", a: "Because a PDF stores text at coordinates and has no concept of a cell. Inferring column boundaries from spacing works until a value is wide or a column is empty, and then it fails silently — which is worse than making you do it deliberately with text-to-columns." },
      { q: "Will this work on a bank statement?", a: "If the statement is a real PDF rather than a scan, the text comes out and needs splitting into columns. If it is a scan, run OCR first." },
      PRIVACY_FAQ,
      NO_LIMIT_FAQ,
    ],
  },

  "pdf-to-markdown": {
    intro: [
      "Markdown is how documentation, notes and static sites are written, and PDFs are a common place useful text is stuck.",
      "This extracts the text and infers structure from it — headings from font sizes, bullets from list markers — producing Markdown you can paste into a repository, a wiki or a note-taking app.",
    ],
    steps: [
      "Open the PDF.",
      "Convert. Headings and lists are inferred as the text is extracted.",
      "Review the Markdown, particularly the heading levels.",
      "Save the .md file or copy the text out.",
    ],
    limits: [
      "Structure is guessed from appearance. A document using font size decoratively will produce headings where you did not intend any.",
      "Tables and images are not converted.",
      "Scanned PDFs contain no text — OCR them first.",
    ],
    faqs: [
      { q: "How accurate is the heading detection?", a: "Good on documents with a consistent visual hierarchy, unreliable on heavily designed ones. It is a starting point that saves the typing, not a finished conversion." },
      { q: "Are links preserved?", a: "Link text is kept; the underlying URLs are not consistently recoverable from a PDF." },
      PRIVACY_FAQ,
      FREE_FAQ,
    ],
  },

  "compress-image": {
    intro: [
      "Phone photographs are far larger than almost any use needs. A few megabytes per image is normal, which is fine until you attach ten of them to an email or upload them to a form with a limit.",
      "This re-encodes images at a quality you choose, showing the before and after size so the trade is visible rather than guessed at. It runs on your device, so a folder of personal photos does not get uploaded to a stranger's server to be made smaller.",
    ],
    steps: [
      "Add the images you want to shrink.",
      "Choose an output format and quality. JPEG suits photographs; PNG suits graphics with flat colour; WebP is usually smallest.",
      "Compress, then compare the sizes reported for each file.",
      "Save the results.",
    ],
    limits: [
      "JPEG and WebP compression is lossy. Detail is discarded to save space, and it cannot be recovered afterwards — keep the originals.",
      "Some files will not get smaller. An already-compressed image re-encoded can grow, and when that happens it is reported honestly rather than shown as a saving.",
      "Metadata such as EXIF is not preserved, which removes camera and location data. Usually welcome, occasionally not.",
    ],
    faqs: [
      { q: "Which format should I pick?", a: "WebP for the smallest file if the destination supports it. JPEG for maximum compatibility with photographs. PNG only for graphics with sharp edges and flat colour, where JPEG artefacts would show." },
      { q: "One of my images got bigger. Why?", a: "It was already well compressed, and re-encoding added overhead without finding anything to remove. The tool reports that rather than showing a false saving — keep the original in that case." },
      { q: "Does this strip location data from my photos?", a: "Yes. Re-encoding drops EXIF metadata, including GPS coordinates, which is often a good reason to run photos through it before sharing them." },
      PRIVACY_FAQ,
    ],
  },

  "resize-image": {
    intro: [
      "Upload forms specify pixel dimensions with great confidence and no way to meet them: profile photos, ID uploads, marketplace listings, forum avatars.",
      "This resizes to the dimensions you give, keeping proportions if you want them kept, and runs entirely on your device.",
    ],
    steps: [
      "Add the image.",
      "Enter the width or height you need. Lock the aspect ratio unless the target genuinely requires a fixed shape.",
      "Resize and check the preview.",
      "Save it.",
    ],
    limits: [
      "Enlarging a small image cannot add detail that was never captured. It will look soft, because the information is not there.",
      "Unlocking the aspect ratio will distort the picture. That is occasionally what a form demands, and it is why the option exists.",
      "Resizing re-encodes the image, so a lossy format loses a little quality in the process.",
    ],
    faqs: [
      { q: "Can I make a small image bigger without it blurring?", a: "Not meaningfully. Upscaling invents pixels by interpolation — it can smooth the result but cannot recover detail that was never in the file." },
      { q: "How do I hit an exact size in kilobytes?", a: "Resize first, then run the result through the image compressor and adjust quality until it fits. Dimensions and file size are separate levers." },
      PRIVACY_FAQ,
      FREE_FAQ,
    ],
  },

  "heic-to-jpg": {
    intro: [
      "iPhones save photographs as HEIC, which is smaller and better than JPEG and understood by noticeably less of the world. Windows, older Android phones, plenty of web forms and most printing services all want a JPEG.",
      "This converts HEIC images to JPEG in your browser — including on devices whose own browser cannot display HEIC natively.",
    ],
    steps: [
      "Add your .heic or .heif files. Several at once is fine.",
      "Convert. Each one is decoded on your device.",
      "Save the JPEGs.",
    ],
    limits: [
      "JPEG is a lossy format, so the conversion is not pixel-perfect. At normal quality the difference is invisible.",
      "Live Photos convert their still frame only; the short video attached to them is not carried across.",
      "Large batches take real time and processing power, because your device is decoding every image.",
    ],
    faqs: [
      { q: "Why can't I open HEIC files on Windows?", a: "HEIC needs a codec Windows does not always ship, and Microsoft charges for one in some editions. Converting to JPEG sidesteps the question." },
      { q: "Will the JPEG be bigger than the HEIC?", a: "Usually, yes. HEIC is a more efficient format — that is exactly why Apple uses it, and why converting costs some file size in exchange for compatibility." },
      PRIVACY_FAQ,
      NO_LIMIT_FAQ,
    ],
  },

  "qr-code-generator": {
    intro: [
      "A QR code is the shortest distance between something on a screen and something in a hand — a link on a poster, a menu on a table, a form at an event.",
      "This generates one from any text or URL, on your device, and hands you an image to use wherever you like. Nothing is registered, nothing expires, and nothing tracks the scans, because nothing about it reaches us.",
    ],
    steps: [
      "Type or paste the text or URL you want encoded.",
      "Check the preview updates — shorter content makes a simpler, more reliably scannable code.",
      "Download the image and place it wherever it is going.",
    ],
    limits: [
      "The code is static. It encodes exactly what you typed, so if the destination URL changes the printed code is dead. Use a link you control if it might move.",
      "Long text produces a dense code that is harder to scan, especially when printed small.",
      "There are no scan analytics, because that would require routing every scan through a server that logged it.",
    ],
    faqs: [
      { q: "Does the code expire, or stop working?", a: "Never. It contains your content directly rather than pointing at a redirect on our servers, so there is nothing to expire and nothing to shut down." },
      { q: "Can I track how many people scan it?", a: "Not with this. Tracking scans means sending every scanner through a server that records them, which is exactly the kind of thing this site is built not to do. Use a link shortener with analytics if you need that." },
      { q: "How small can I print it?", a: "Keep it at least two centimetres square for short content, and larger for dense codes. Test with a phone before printing a hundred." },
      PRIVACY_FAQ,
    ],
  },

  "csv-excel-converter": {
    intro: [
      "CSV is what systems export and Excel is what people read. Moving between the two is constant, and the usual method — opening a CSV in Excel — is exactly where leading zeros vanish and dates silently rearrange themselves.",
      "This converts in both directions on your device, which also means a file of customer records or payroll data does not have to be uploaded anywhere to change format.",
    ],
    steps: [
      "Add the .csv or .xlsx file.",
      "The direction is detected from what you gave it.",
      "Convert, then check the preview — particularly the first column and anything that looks like a date.",
      "Save the result.",
    ],
    limits: [
      "CSV holds values and nothing else. Converting to CSV drops formatting, formulas, colours and multiple sheets, because the format has nowhere to put them.",
      "Only the first sheet is converted when producing a CSV, since a CSV cannot represent more than one.",
      "Very large files are limited by your device's memory rather than by any cap we impose.",
    ],
    faqs: [
      { q: "Will my leading zeros survive?", a: "Through this conversion, yes — values are carried across as text. The classic damage happens when a CSV is opened directly in Excel, which guesses types aggressively. Converting to .xlsx first avoids the guess." },
      { q: "Can I convert several sheets at once?", a: "Into a single CSV, no — the format holds one table. Convert the workbook to CSV one sheet at a time." },
      PRIVACY_FAQ,
      NO_LIMIT_FAQ,
    ],
  },

  "ocr-pdf": {
    intro: [
      "A scanned page is a photograph. It looks like text, but there is no text in the file — which is why searching it finds nothing and copying from it is impossible.",
      "Optical character recognition reads the shapes and produces actual text. This runs the recognition engine in your browser, which is unusual: OCR is normally a server job, and doing it on your device means a scanned passport or medical letter never leaves it.",
    ],
    steps: [
      "Add the scanned PDF or image.",
      "Start recognition and give it time — this is the most computationally demanding tool here, and it is running on your device.",
      "Review the extracted text, especially names and numbers.",
      "Copy it out or save it.",
    ],
    limits: [
      "Accuracy depends heavily on the scan. Straight, well-lit, high-resolution pages read well; skewed, shadowed or low-resolution ones produce errors.",
      "Handwriting is not recognised. This reads printed text.",
      "Columns, tables and complex layouts are read in an order that may not match how you would read them.",
      "It is slow, and on a phone it is slower. That is the cost of not uploading your documents.",
    ],
    faqs: [
      { q: "Why is it so much slower than other OCR sites?", a: "Because they run recognition on their servers, which means your scanned document is uploaded to them. This runs the engine inside your browser on your own processor. The speed difference is the privacy difference, stated plainly." },
      { q: "Can it read handwriting?", a: "No. Handwriting recognition is a substantially different problem and this engine does not attempt it." },
      { q: "How do I get the best accuracy?", a: "Scan at 300 DPI or more, keep the page flat and square to the camera, and light it evenly. Recognition quality is set mostly by the input, not the engine." },
      PRIVACY_FAQ,
    ],
  },

  "rotate-pdf": {
    intro: [
      "A whole document arriving sideways is almost always a scanner or a phone: the sheet went in the wrong way round, or the page was photographed in landscape. Every page is turned the same way, and every page needs turning back.",
      "This rotates the entire document in one step. Organize PDF can already turn individual pages, and that is the tool for a document where only page four is wrong — this is for when the answer is the same for all of them and a thumbnail grid is more work than the job deserves.",
    ],
    steps: [
      "Open the PDF, or several at once if they all came out of the same scanner.",
      "Choose the turn: 90 degrees right, 90 degrees left, or 180 for a document that came in upside down.",
      "Rotate, then check the result opens the right way up.",
      "Save it.",
    ],
    limits: [
      "Every page turns by the same amount. For a document where pages disagree, use Organize PDF instead.",
      "Rotation is recorded as a property of the page rather than by redrawing it, so nothing is re-rendered and no quality is lost.",
      "Rotating a page that was already rotated adds to the existing angle rather than replacing it, which is what you want when correcting a scan in two steps.",
    ],
    faqs: [
      { q: "Does rotating reduce quality or make the file bigger?", a: "Neither. The PDF format stores rotation as an instruction on the page, so the content is untouched and the file size barely moves. Nothing is converted to an image." },
      { q: "Why does my viewer show it upright but it prints sideways?", a: "Some viewers display a rotation without applying it on export. Saving the file here writes the rotation into the document itself, so it travels with the file." },
      { q: "Can I rotate just one page?", a: "Not here — use Organize PDF, which shows every page as a thumbnail and lets you turn them individually." },
      PRIVACY_FAQ,
    ],
  },

  "edit-pdf": {
    intro: [
      "Two different searches lead here and they want the same thing. \"Edit PDF\" is usually someone who needs to put something ON a page — a signature, a date, a corrected figure, a note for whoever reads it next. \"Annotate PDF\" is the same person using the word a lawyer or a lecturer would. So this is one tool rather than two: text, rectangles, ovals, a freehand pen, a highlighter and images, placed anywhere on any page.",
      "It runs entirely in your browser, which matters more here than for almost anything else on the site. The documents people sign, initial or scribble a correction on are contracts, tenancy agreements, medical forms and passport scans — the exact category you would least like to hand to a stranger's server for processing. Nothing is uploaded, so there is nothing to hand over.",
      "The pen is the reason most people arrive. Sign with a finger on a phone or a trackpad on a laptop, or place a photograph of your signature as an image — both end up as ordinary page content, so the file opens correctly in any reader and prints the way it looks.",
    ],
    steps: [
      "Open the PDF. The first page is drawn on your device, sized to fit the column, with the rest a click away.",
      "Pick a tool. Text places a box where you click and types into it; rectangle, oval, pen and highlighter are all drag-to-draw; image asks for a picture first and then a box to fit it into.",
      "Set the colour, size or line weight before you draw — the controls above the page change with the tool you have chosen.",
      "Zoom in for anything fiddly, like a signature line or a small form field. Zooming changes the view only; marks already placed stay exactly where you put them.",
      "Use Select to drag a mark somewhere better or delete it, and Undo to step back. Then save the edited PDF, or hand it straight to the transfer page to send it to someone.",
    ],
    limits: [
      "It cannot edit the text that is already in the PDF. Nothing here will let you click into an existing paragraph and retype it. That is a genuinely different and much harder job — a PDF stores glyphs at fixed positions with no notion of a sentence, so \"changing a word\" means re-flowing a line the file never described. Anyone promising otherwise is either rebuilding the page as an image or converting to Word and back, and both lose the original. What this does is add new content on top of what is there.",
      "Everything you draw is written into the page, not attached as a PDF comment object. That is what makes it show up identically everywhere and survive printing, but it also means the marks cannot be clicked and re-edited later in Acrobat. Keep the original if you might need to change your mind.",
      "A filled rectangle over sensitive text hides it from view but does NOT remove it. The words are still in the file and can be copied straight out from underneath. This is not a redaction tool, and no tool that draws a box on top of text is one.",
      "Text uses the fonts built into the PDF format, which cover Latin letters, digits and punctuation. Greek, Cyrillic, Chinese, Japanese, Korean and emoji have no place in those fonts — the tool tells you before you place the text rather than after. Embedding a Unicode font would mean a multi-megabyte download on every visit.",
      "A password-protected PDF has to be unlocked first, since the pages cannot be drawn while they are encrypted.",
      "Marks are placed by hand, not snapped to anything. There is no grid, no alignment guide and no form-field detection, so filling a long form is a manual job.",
    ],
    faqs: [
      { q: "Can I change the wording that is already in the document?", a: "No, and it is worth being clear about why. A PDF is a set of instructions for painting glyphs at fixed coordinates; it does not record which glyphs form a word, a sentence or a paragraph, so there is nothing to re-flow when a word gets longer. Tools that claim to do it either convert the document to Word and back — which rebuilds the layout and usually breaks it — or replace the page with a picture. This tool adds new content over the existing page, which is what most \"edit\" jobs actually need: a signature, a date, a correction, a note." },
      { q: "How do I sign a document?", a: "Two ways, and both are common. Choose the pen and sign with a finger, a stylus or a trackpad — zoom in first, it is much easier at 200%. Or photograph your signature on white paper, cut it out as a PNG with a transparent background, and place it with the image tool, which is the tidier option if you sign a lot of things." },
      { q: "Will the highlighter hide the text underneath?", a: "No. Highlighter strokes are written with a multiply blend, the same way real highlighter ink works — the colour darkens the page without covering it, so the words stay readable and still selectable. Ordinary shapes with fill switched on are opaque by comparison." },
      { q: "Is drawing a black box over text the same as redacting it?", a: "No, and treating it as though it were is how confidential information leaks. The rectangle sits above the text; the text itself is untouched and anyone can select and copy it, or read it out of the file directly. Real redaction removes the underlying content. If a document must be safe to release, delete the sensitive text at the source and produce a fresh PDF." },
      { q: "Does it work on a phone or tablet?", a: "Yes, and the pen is better with a finger or a stylus than with a mouse. The page is scaled to fit the screen, and because positions are stored against the document rather than the screen, zooming in to place something precisely cannot shift anything you have already drawn." },
      { q: "What happens to pages that were scanned in sideways?", a: "They are handled. A page can carry its own rotation, and marks are positioned through the same machinery the viewer uses, so text lands upright and in the place you clicked rather than rotated into a corner. If the whole document is the wrong way up, Rotate PDF will fix that first." },
      PRIVACY_FAQ,
      NO_LIMIT_FAQ,
      FREE_FAQ,
    ],
  },

  "flatten-pdf": {
    intro: [
      "A filled-in PDF form is still a form. The values sit in interactive fields that anyone opening the file can click into and change, which is a problem the moment the form is evidence of something — a signed agreement, a completed application, an invoice with an amount on it.",
      "Flattening turns those values into ordinary page content. The boxes stop being editable and the answers become part of the page, while the text stays real, selectable text and the file stays small.",
    ],
    steps: [
      "Open the completed PDF form.",
      "Flatten it. Field values are drawn into the page and the interactive fields are removed.",
      "Check the values still read correctly, particularly anything filled in by another application.",
      "Save it — and keep the original, because this cannot be undone.",
    ],
    limits: [
      "It cannot be reversed. Once flattened the fields are gone, so keep the editable original if you might need to change an answer.",
      "It flattens form fields, not the whole page. This is not the tool for making text unselectable — that is rasterising, and Compress PDF's strong mode does it at the cost of searchable text.",
      "A document with no form fields comes back essentially unchanged, because there was nothing interactive to lock down.",
    ],
    faqs: [
      { q: "What is the difference between flattening and just printing to PDF?", a: "Printing to PDF usually rasterises the page or re-renders it, which can lose selectable text and inflate the file. Flattening keeps the document as a document — the text stays text, the file stays small, and only the interactivity goes." },
      { q: "Will this stop someone editing the document entirely?", a: "It stops the form fields being filled in differently. It is not encryption and not a permissions lock — somebody with a PDF editor can still alter page content. Flattening is about preventing accidental or casual change, not about defeating a determined one." },
      { q: "My filled values disappeared after flattening. Why?", a: "Some form fillers store a value without generating the appearance that displays it. Appearances are regenerated here before flattening to avoid exactly that, but a document using an unusual embedded font can still lose them — check the result before discarding the original." },
      PRIVACY_FAQ,
    ],
  },

  "txt-to-pdf": {
    intro: [
      "Plain text is what logs, exports, notes and code come as, and PDF is what gets attached to things — a support ticket, a submission, a record that should look the same wherever it is opened.",
      "This draws the text directly into the PDF, which matters more than it sounds: the result contains real text you can select, search and copy, rather than a picture of text. Files stay small for the same reason.",
    ],
    steps: [
      "Add your .txt, .log or .md files. Several at once is fine.",
      "Pick a page size, and turn on the monospaced font if the content is a log, code, or anything lined up with spaces.",
      "Adjust the text size — smaller fits more per page, which matters for long logs.",
      "Convert and save.",
    ],
    limits: [
      "Markdown is laid out as plain text, not rendered. A heading written with hashes appears with its hashes; this is a text-to-PDF converter, not a Markdown renderer.",
      "Very long lines wrap to the page width. With the monospaced font on, that can break column alignment in wide logs — landscape or a smaller text size usually fixes it.",
      "No syntax highlighting or colour. The output is black text on white pages.",
    ],
    faqs: [
      { q: "Will the text be selectable in the PDF?", a: "Yes. The characters are written into the document rather than drawn as an image, so the result is searchable, copyable and readable by screen readers — and a fraction of the size a rasterised page would be." },
      { q: "Should I use the monospaced font?", a: "If the content is a log file, source code, or anything where spaces line columns up, yes — a proportional font destroys that alignment. For ordinary prose, leave it off; it reads better." },
      { q: "What about very large log files?", a: "They work, and produce a lot of pages. The conversion runs on your device, so a very long file takes a moment, but there is no size cap." },
      PRIVACY_FAQ,
    ],
  },

  "csv-to-pdf": {
    intro: [
      "A CSV is for a machine to read. When a person has to read it — a supplier list attached to an email, a reconciliation someone will check, an export going into a report — it needs to be a table on a page.",
      "This goes straight from CSV to a formatted PDF table without stopping at a spreadsheet, which also removes the step where opening a CSV in Excel quietly reformats dates and eats leading zeros.",
    ],
    steps: [
      "Add the CSV file.",
      "Say whether the first row is a heading row — it usually is, and it changes how the table is drawn.",
      "Choose landscape for anything with more than about six columns.",
      "Convert and save.",
    ],
    limits: [
      "Very wide files compress their columns to fit the page. Beyond roughly a dozen columns even landscape becomes cramped; splitting the file is the honest fix.",
      "The output is a plain table. There is no conditional formatting, no colour coding and no cell styling, because a CSV contains none of that to carry across.",
      "Extremely long files produce many pages and take a moment, since the whole table is laid out on your device.",
    ],
    faqs: [
      { q: "Why go straight to PDF instead of opening the CSV in Excel first?", a: "Because opening a CSV in a spreadsheet is where the damage usually happens — leading zeros stripped from account numbers, product codes read as dates. Values are carried across as text here, so what was in the file is what lands on the page." },
      { q: "Are quoted fields and embedded commas handled properly?", a: "Yes. Parsing goes through a real CSV parser rather than splitting on commas, so quoted fields containing commas, line breaks and escaped quotes all come through intact." },
      { q: "Can I convert several CSVs at once?", a: "Yes — add them together and each becomes its own PDF, delivered as a zip." },
      PRIVACY_FAQ,
    ],
  },
};
