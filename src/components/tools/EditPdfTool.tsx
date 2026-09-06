"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type * as pdfjsLib from "pdfjs-dist";
import {
  extractPageTextRuns,
  loadPdf,
  renderPageWithViewport,
  sampleBackground,
  textRunBox,
  type PageTextRun,
  type TextRunBox,
} from "@/lib/tools/pdfjs";
import {
  LINE_HEIGHT,
  editPdf,
  imageSourceFromFile,
  isSafeLinkUrl,
  readFormFields,
  unwritableCharacters,
  type Annotation,
  type FieldKind,
  type FontChoice,
  type FormFieldInfo,
  type ImageSource,
  type MarkStyle,
  type NewField,
  type Point,
} from "@/lib/tools/editPdf";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { FormFieldsPanel } from "./EditPdfForms";
import { Button } from "../Button";

/*
 * The editing surface for Edit PDF.
 *
 * Three rules hold the whole thing together:
 *
 * 1. Annotations live in PDF points, never in screen pixels. A click is
 *    converted through pdf.js's `viewport.convertToPdfPoint` the moment it
 *    arrives, and converted back only to draw the preview. Zoom, a page's own
 *    /Rotate and a crop box that doesn't start at the origin are then the
 *    viewport's problem rather than ours.
 * 2. The preview is drawn from exactly the data that gets written. The SVG
 *    overlay reads the same annotation list `editPdf` does, so what somebody
 *    positions is what they get.
 * 3. Mark-up snaps to the page's own text. Dragging the highlighter returns
 *    the boxes pdf.js reports for the runs under the pointer, not the pointer's
 *    own path — which is the difference between a ruled highlight and a wobbly
 *    one. Where there is no text (a scan), it falls back to the dragged box and
 *    says so.
 */

type ToolMode =
  | "select"
  | "retype"
  | "text"
  | "signature"
  | "link"
  | "field"
  | "pen"
  | "highlight"
  | "underline"
  | "strike"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "whiteout"
  | "image";

interface ToolSpec {
  mode: ToolMode;
  label: string;
  hint: string;
}

const TOOL_GROUPS: { label: string; tools: ToolSpec[] }[] = [
  {
    label: "Edit",
    tools: [
      { mode: "select", label: "Select", hint: "Click a mark to move it, drag a corner to resize, double-click text to retype it" },
      { mode: "retype", label: "Retype", hint: "Click a line of the document's own text to cover it and type over it" },
    ],
  },
  {
    label: "Mark up text",
    tools: [
      { mode: "highlight", label: "Highlight", hint: "Drag across text — the highlight snaps to the lines it covers" },
      { mode: "underline", label: "Underline", hint: "Drag across text to rule a line under it" },
      { mode: "strike", label: "Strike", hint: "Drag across text to cross it out" },
    ],
  },
  {
    label: "Draw",
    tools: [
      { mode: "pen", label: "Pen", hint: "Draw freehand — this is the one for a signature" },
      { mode: "line", label: "Line", hint: "Drag from one point to another" },
      { mode: "arrow", label: "Arrow", hint: "Drag from the tail to whatever you are pointing at" },
      { mode: "rect", label: "Box", hint: "Drag to draw a rectangle" },
      { mode: "ellipse", label: "Oval", hint: "Drag to draw an oval" },
      { mode: "whiteout", label: "Whiteout", hint: "Drag to cover something with white" },
    ],
  },
  {
    label: "Insert",
    tools: [
      { mode: "text", label: "Text", hint: "Click where the text should start, then type" },
      { mode: "signature", label: "Signature", hint: "Click where to sign, then type your name — for a handwritten one, use the pen" },
      { mode: "image", label: "Image", hint: "Choose a picture, then drag a box for it" },
      { mode: "link", label: "Link", hint: "Drag over the words that should be clickable, then paste the address" },
      { mode: "field", label: "Field", hint: "Drag a box where somebody should fill something in" },
    ],
  },
];

const ALL_TOOLS = TOOL_GROUPS.flatMap((g) => g.tools);
const MARK_MODES: ToolMode[] = ["highlight", "underline", "strike"];
const BOX_MODES: ToolMode[] = ["rect", "ellipse", "whiteout", "image", "link", "field", ...MARK_MODES];
const TEXT_MODES: ToolMode[] = ["text", "signature"];

/** One-click text people place over and over. The date is resolved when it is used, not when the module loads. */
const STAMPS: { label: string; text: () => string }[] = [
  { label: "Today", text: () => new Date().toLocaleDateString() },
  { label: "APPROVED", text: () => "APPROVED" },
  { label: "DRAFT", text: () => "DRAFT" },
  { label: "CONFIDENTIAL", text: () => "CONFIDENTIAL" },
];

const FIELD_KINDS: { value: FieldKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "checkbox", label: "Tick box" },
  { value: "dropdown", label: "Dropdown" },
];

/**
 * Maps the family pdf.js reports for a run onto one of the three built-in
 * families. Weight and slope are not guessable from what pdf.js exposes without
 * reaching into its internals, so they start plain and the B and I buttons are
 * one click away — see the tool page, which says as much.
 */
function familyOf(run: PageTextRun): FontChoice {
  const family = run.fontFamily.toLowerCase();
  if (family.includes("mono")) return "mono";
  if (family.includes("serif") && !family.includes("sans")) return "serif";
  return "sans";
}

const INK_SWATCHES = ["#1a1a1a", "#d50000", "#1447e6", "#087f5b", "#ffffff"];
const HIGHLIGHT_SWATCHES = ["#ffe600", "#7cff5c", "#5ce1ff", "#ff8ad4"];

const CSS_FONTS: Record<FontChoice, string> = {
  sans: "Helvetica, Arial, sans-serif",
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
};

const FONT_LABELS: { value: FontChoice; label: string }[] = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

/** Highlighter ink is transparent by definition — fixed, so nobody has to find the setting that makes it work. */
const HIGHLIGHT_OPACITY = 0.4;
/** Where a rule sits inside a line of text, as a fraction of the way down it. */
const MARK_DEPTH: Record<MarkStyle, number> = { highlight: 0, underline: 0.92, strike: 0.55 };
/** Corner grab targets, in CSS pixels. */
const HANDLE = 9;

let measureContext: CanvasRenderingContext2D | null = null;
function measureTextWidth(text: string, pixelSize: number, font: FontChoice, bold: boolean): number {
  if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * pixelSize * 0.5;
  measureContext.font = `${bold ? "bold " : ""}${pixelSize}px ${CSS_FONTS[font]}`;
  return Math.max(...text.split("\n").map((line) => measureContext!.measureText(line).width), 0);
}

interface ScreenBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxFrom(a: Point, b: Point): ScreenBox {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

function within(box: ScreenBox, p: Point, slack = 4): boolean {
  return p.x >= box.x - slack && p.x <= box.x + box.width + slack && p.y >= box.y - slack && p.y <= box.y + box.height + slack;
}

function overlaps(a: ScreenBox, b: ScreenBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

type Handle = "nw" | "ne" | "sw" | "se" | "from" | "to";

type Draft =
  | { kind: "box"; from: Point; to: Point }
  | { kind: "stroke"; points: Point[] }
  | { kind: "move"; id: string; last: Point }
  | { kind: "resize"; id: string; handle: Handle; original: Annotation; oldBox: ScreenBox; anchor: Point }
  | null;

interface TextDraft {
  /** Top-left of the editor, in screen pixels. */
  at: Point;
  value: string;
  /** Set when retyping an existing annotation rather than making a new one. */
  editing?: { id: string; at: Point };
}

let nextAnnotationId = 0;

export function EditPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [frameWidth, setFrameWidth] = useState(0);
  const [rendered, setRendered] = useState<{ dataUrl: string; viewport: pdfjsLib.PageViewport; canvas: HTMLCanvasElement } | null>(null);
  const [textRuns, setTextRuns] = useState<Record<number, PageTextRun[]>>({});

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [mode, setMode] = useState<ToolMode>("text");
  const [inkColor, setInkColor] = useState("#d50000");
  const [highlightColor, setHighlightColor] = useState("#ffe600");
  const [thickness, setThickness] = useState(2);
  const [filled, setFilled] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [font, setFont] = useState<FontChoice>("sans");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);

  const [formFields, setFormFields] = useState<FormFieldInfo[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [newFields, setNewFields] = useState<NewField[]>([]);
  const [linkDraft, setLinkDraft] = useState<{ box: ScreenBox; url: string } | null>(null);
  const [fieldDraft, setFieldDraft] = useState<{ box: ScreenBox; name: string; kind: FieldKind; options: string } | null>(null);
  const [presetText, setPresetText] = useState<string | null>(null);

  const [pendingImage, setPendingImage] = useState<{ source: ImageSource; url: string; ratio: number } | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "saving" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const revocableUrls = useRef(new Map<string, string>());
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {});

  // Shadow copies of two pieces of state, written alongside every setState that
  // touches them. State updates are asynchronous, but one pointer gesture can
  // fire several before React re-renders — starting a drag commits an open text
  // box and then moves a mark — and each step has to see what the one before it
  // did. Only ever written from event handlers and effects, never during render.
  const annotationsRef = useRef<Annotation[]>([]);
  const textDraftRef = useRef<TextDraft | null>(null);

  /** The scrolling frame's width drives the fit-to-column scale. A callback ref, because the element it lands on changes as the tool loads. */
  const frameRef = useCallback((node: HTMLDivElement | null) => {
    resizeObserver.current?.disconnect();
    resizeObserver.current = null;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width));
    observer.observe(node);
    resizeObserver.current = observer;
  }, []);

  useEffect(() => () => resizeObserver.current?.disconnect(), []);

  // Preview URLs for placed images outlive individual renders, but not the tool.
  useEffect(() => {
    const urls = revocableUrls.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    loadPdf(file)
      .then((doc) => {
        if (cancelled) return;
        setPdf(doc);
        setPageCount(doc.numPages);
        setPageNumber(1);
        setStatus("ready");
        // A form the document already has is worth surfacing without being
        // asked: most people arriving with one want to fill it, not draw on it.
        readFormFields(file)
          .then((fields) => !cancelled && setFormFields(fields))
          .catch(() => !cancelled && setFormFields([]));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "That file couldn't be opened as a PDF.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!pdf || frameWidth <= 0) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(Math.max((frameWidth / unscaled.width) * zoom, 0.15), 4);
      const next = await renderPageWithViewport(pdf, pageNumber, scale);
      if (cancelled) return;
      setRendered(next);
      // Text positions are fetched once per page and cached: they are in PDF
      // units, so zooming re-projects them rather than needing them again.
      setTextRuns((cached) => {
        if (!cached[pageNumber]) {
          extractPageTextRuns(pdf, pageNumber)
            .then((runs) => !cancelled && setTextRuns((prev) => ({ ...prev, [pageNumber]: runs })))
            .catch(() => !cancelled && setTextRuns((prev) => ({ ...prev, [pageNumber]: [] })));
        }
        return cached;
      });
    })().catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : "That page couldn't be drawn.");
        setStatus("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, zoom, frameWidth]);

  const viewport = rendered?.viewport ?? null;
  const scale = viewport?.scale ?? 1;
  const pageAnnotations = annotations.filter((a) => a.page === pageNumber);

  function toPdf(p: Point): Point {
    if (!viewport) return p;
    const [x, y] = viewport.convertToPdfPoint(p.x, p.y);
    return { x, y };
  }

  function toScreen(p: Point): Point {
    if (!viewport) return p;
    const [x, y] = viewport.convertToViewportPoint(p.x, p.y);
    return { x, y };
  }

  function pdfBox(box: ScreenBox): { from: Point; to: Point } {
    return { from: toPdf({ x: box.x, y: box.y }), to: toPdf({ x: box.x + box.width, y: box.y + box.height }) };
  }

  /** Every change to the annotation list goes through here, so undo has one place to record. */
  function apply(change: (prev: Annotation[]) => Annotation[], undoable = true) {
    const prev = annotationsRef.current;
    const next = change(prev);
    if (next === prev) return next;
    annotationsRef.current = next;
    if (undoable) {
      setHistory((h) => [...h.slice(-60), prev]);
      setFuture([]);
    }
    setAnnotations(next);
    return next;
  }

  function undo() {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture((f) => [annotationsRef.current, ...f]);
    annotationsRef.current = previous;
    setAnnotations(previous);
    setHistory((h) => h.slice(0, -1));
    setSelectedId(null);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, annotationsRef.current]);
    annotationsRef.current = next;
    setAnnotations(next);
    setFuture((f) => f.slice(1));
    setSelectedId(null);
  }

  /**
   * Turns the open text box into a real annotation and returns the resulting
   * list. Every path that ends text entry calls it — clicking elsewhere,
   * switching tool, changing page, saving — and it clears its own ref first, so
   * it can never commit the same text twice.
   */
  function commitText(): Annotation[] {
    const open = textDraftRef.current;
    textDraftRef.current = null;
    if (open) setTextDraft(null);
    if (!open || !viewport) return annotationsRef.current;
    const value = open.value.replace(/\s+$/, "");

    if (open.editing) {
      const { id } = open.editing;
      if (!value) return apply((prev) => prev.filter((a) => a.id !== id));
      return apply((prev) =>
        prev.map((a) => (a.id === id && a.kind === "text" ? { ...a, text: value, size: fontSize, color: inkColor, font, bold, italic } : a)),
      );
    }

    if (!value) return annotationsRef.current;
    // The click marks the top-left of the text, which is where people expect to
    // start typing. The PDF wants the first baseline, about four fifths of a
    // line down — worked out in screen space so a rotated page needs no case.
    const baseline = toPdf({ x: open.at.x, y: open.at.y + fontSize * scale * 0.8 });
    return apply((prev) => [
      ...prev,
      { id: `a${nextAnnotationId++}`, page: pageNumber, kind: "text", at: baseline, text: value, size: fontSize, color: inkColor, font, bold, italic },
    ]);
  }

  function pointerPosition(e: ReactPointerEvent<HTMLDivElement>): Point {
    const surface = surfaceRef.current;
    if (!surface || !viewport) return { x: 0, y: 0 };
    const rect = surface.getBoundingClientRect();
    // Scaled by the rendered-to-laid-out ratio, so a page the browser has
    // shrunk to fit still maps a click to the right spot.
    return {
      x: ((e.clientX - rect.left) * viewport.width) / rect.width,
      y: ((e.clientY - rect.top) * viewport.height) / rect.height,
    };
  }

  /** Screen-space bounds of an annotation — used for the selection outline, the handles and hit testing. */
  function annotationBox(annotation: Annotation): ScreenBox {
    if (annotation.kind === "text") {
      const base = toScreen(annotation.at);
      const pixelSize = annotation.size * scale;
      const lines = annotation.text.split("\n").length;
      return {
        x: base.x,
        y: base.y - pixelSize * 0.8,
        width: measureTextWidth(annotation.text, pixelSize, annotation.font, annotation.bold),
        height: pixelSize * (1 + (lines - 1) * LINE_HEIGHT),
      };
    }
    if (annotation.kind === "ink") {
      const points = annotation.points.map(toScreen);
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    if (annotation.kind === "mark") {
      const corners = annotation.boxes.flatMap((b) => [toScreen(b.from), toScreen(b.to)]);
      const xs = corners.map((p) => p.x);
      const ys = corners.map((p) => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    return boxFrom(toScreen(annotation.from), toScreen(annotation.to));
  }

  /** Grab points for resizing. Lines get their two ends; snapped mark-up gets none, because its shape belongs to the text. */
  function handlesFor(annotation: Annotation): { id: Handle; x: number; y: number }[] {
    if (annotation.kind === "mark") return [];
    if (annotation.kind === "line") {
      const from = toScreen(annotation.from);
      const to = toScreen(annotation.to);
      return [
        { id: "from", x: from.x, y: from.y },
        { id: "to", x: to.x, y: to.y },
      ];
    }
    const b = annotationBox(annotation);
    return [
      { id: "nw", x: b.x, y: b.y },
      { id: "ne", x: b.x + b.width, y: b.y },
      { id: "sw", x: b.x, y: b.y + b.height },
      { id: "se", x: b.x + b.width, y: b.y + b.height },
    ];
  }

  function hitTest(p: Point): Annotation | null {
    // Backwards, because the most recently drawn mark is the one on top.
    for (let i = pageAnnotations.length - 1; i >= 0; i--) {
      const annotation = pageAnnotations[i];
      if (annotation.kind === "ink" || annotation.kind === "line") {
        const points = annotation.kind === "ink" ? annotation.points.map(toScreen) : [toScreen(annotation.from), toScreen(annotation.to)];
        const reach = (annotation.thickness * scale) / 2 + 5;
        if (points.length === 1 && Math.hypot(points[0].x - p.x, points[0].y - p.y) <= reach) return annotation;
        for (let j = 1; j < points.length; j++) {
          if (distanceToSegment(p, points[j - 1], points[j]) <= reach) return annotation;
        }
        continue;
      }
      if (annotation.kind === "mark") {
        if (annotation.boxes.some((b) => within(boxFrom(toScreen(b.from), toScreen(b.to)), p, 2))) return annotation;
        continue;
      }
      if (within(annotationBox(annotation), p)) return annotation;
    }
    return null;
  }

  function translate(annotation: Annotation, dx: number, dy: number): Annotation {
    const shift = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
    if (annotation.kind === "text") return { ...annotation, at: shift(annotation.at) };
    if (annotation.kind === "ink") return { ...annotation, points: annotation.points.map(shift) };
    if (annotation.kind === "mark") return { ...annotation, boxes: annotation.boxes.map((b) => ({ from: shift(b.from), to: shift(b.to) })) };
    return { ...annotation, from: shift(annotation.from), to: shift(annotation.to) };
  }

  /** Re-fits an annotation into a new screen box. Always computed from the untouched original, so dragging a handle around cannot compound rounding. */
  function refit(original: Annotation, oldBox: ScreenBox, newBox: ScreenBox): Annotation {
    if (original.kind === "text") {
      // Text has one degree of freedom worth having: its size. Width follows.
      const factor = oldBox.height > 0 ? newBox.height / oldBox.height : 1;
      const size = Math.min(Math.max(original.size * factor, 4), 400);
      const pixelSize = size * scale;
      return { ...original, size, at: toPdf({ x: newBox.x, y: newBox.y + pixelSize * 0.8 }) };
    }
    if (original.kind === "ink") {
      const sx = oldBox.width > 0 ? newBox.width / oldBox.width : 1;
      const sy = oldBox.height > 0 ? newBox.height / oldBox.height : 1;
      return {
        ...original,
        points: original.points.map((point) => {
          const s = toScreen(point);
          return toPdf({ x: newBox.x + (s.x - oldBox.x) * sx, y: newBox.y + (s.y - oldBox.y) * sy });
        }),
      };
    }
    if (original.kind === "mark") return original;
    return { ...original, ...pdfBox(newBox) };
  }

  /** Every text run on the page, already projected onto the screen. */
  function runBoxes(): { run: PageTextRun; box: TextRunBox }[] {
    const runs = textRuns[pageNumber];
    if (!runs || !viewport) return [];
    const out: { run: PageTextRun; box: TextRunBox }[] = [];
    for (const run of runs) {
      const box = textRunBox(run, viewport);
      if (box) out.push({ run, box });
    }
    return out;
  }

  /**
   * The whole line of the document's own text under a point.
   *
   * Runs are grouped by baseline rather than by proximity, because a line is
   * usually several runs — a bold word mid-sentence starts a new one — and
   * covering only the run that was clicked would leave the rest of the sentence
   * showing through the patch.
   */
  function lineUnder(p: Point): { box: ScreenBox; text: string; baseline: number; height: number; run: PageTextRun } | null {
    const boxes = runBoxes();
    const hit = boxes.find((entry) => within(entry.box, p, 2));
    if (!hit) return null;
    const key = Math.round(hit.box.baseline / 3);
    const line = boxes.filter((entry) => Math.round(entry.box.baseline / 3) === key).sort((a, b) => a.box.x - b.box.x);
    const left = Math.min(...line.map((e) => e.box.x));
    const right = Math.max(...line.map((e) => e.box.x + e.box.width));
    const top = Math.min(...line.map((e) => e.box.y));
    const bottom = Math.max(...line.map((e) => e.box.y + e.box.height));
    return {
      box: { x: left, y: top, width: right - left, height: bottom - top },
      text: line.map((e) => e.run.str).join(""),
      baseline: hit.box.baseline,
      height: hit.box.height,
      run: hit.run,
    };
  }

  /**
   * Covers a line of the document's own text and opens it for retyping.
   *
   * This is as close as a tool that never re-flows anything can get to editing
   * existing text, and it is what most corrections actually need: a date, a
   * name, a figure. The patch is filled with the colour sampled from the paper
   * around the line rather than assumed white, so it works on a tinted form or
   * a shaded table row.
   */
  function retypeAt(p: Point) {
    if (!viewport || !rendered) return;
    const line = lineUnder(p);
    if (!line) {
      setHint("No text there. Retype works on the document's own text — on a scan there is none to find, so use Whiteout and Text instead.");
      return;
    }
    setHint(null);

    const pad = 1.5;
    const patchBox = { x: line.box.x - pad, y: line.box.y - pad, width: line.box.width + pad * 2, height: line.box.height + pad * 2 };
    const background = sampleBackground(rendered.canvas, line.box);
    const size = line.height / scale;
    const family = familyOf(line.run);
    const textId = `a${nextAnnotationId++}`;

    setFont(family);
    setFontSize(Math.round(size * 10) / 10);
    setInkColor("#1a1a1a");
    setBold(false);
    setItalic(false);

    // Patch and replacement land in one step, so one undo takes both back.
    apply((prev) => [
      ...prev,
      { id: `a${nextAnnotationId++}`, page: pageNumber, kind: "rect", ...pdfBox(patchBox), stroke: null, fill: background, thickness: 0, opacity: 1 },
      {
        id: textId,
        page: pageNumber,
        kind: "text",
        at: toPdf({ x: line.box.x, y: line.baseline }),
        text: line.text,
        size,
        color: "#1a1a1a",
        font: family,
        bold: false,
        italic: false,
      },
    ]);

    setMode("select");
    setSelectedId(textId);
    textDraftRef.current = { at: { x: line.box.x, y: line.box.y }, value: line.text, editing: { id: textId, at: toPdf({ x: line.box.x, y: line.baseline }) } };
    setTextDraft(textDraftRef.current);
  }

  /**
   * The boxes a mark-up drag should actually cover.
   *
   * Runs whose box the drag crosses are grouped into lines by their baseline and
   * merged, then clipped to the drag horizontally — so half a sentence
   * highlights half a sentence, while a drag spanning three lines gets three
   * clean rules. Returns null when the page has no text under the pointer,
   * which is the honest answer on a scan.
   */
  function snapToText(drag: ScreenBox): ScreenBox[] | null {
    if (!viewport) return null;
    const runs = textRuns[pageNumber];
    if (!runs || runs.length === 0) return null;

    const lines = new Map<number, ScreenBox[]>();
    for (const run of runs) {
      const box = textRunBox(run, viewport);
      if (!box || !overlaps(box, drag)) continue;
      const key = Math.round(box.baseline / 3);
      const bucket = lines.get(key);
      if (bucket) bucket.push(box);
      else lines.set(key, [box]);
    }
    if (lines.size === 0) return null;

    const merged: ScreenBox[] = [];
    for (const boxes of [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)) {
      const left = Math.max(Math.min(...boxes.map((b) => b.x)), drag.x);
      const right = Math.min(Math.max(...boxes.map((b) => b.x + b.width)), drag.x + drag.width);
      if (right - left < 1) continue;
      const top = Math.min(...boxes.map((b) => b.y));
      const bottom = Math.max(...boxes.map((b) => b.y + b.height));
      merged.push({ x: left, y: top, width: right - left, height: bottom - top });
    }
    return merged.length > 0 ? merged : null;
  }

  function addMark(drag: ScreenBox) {
    const style = mode as MarkStyle;
    const snapped = snapToText(drag);
    setHint(
      snapped
        ? null
        : "No text found there, so the mark follows what you dragged. On a scanned page, run OCR first if you want it to snap.",
    );
    const boxes = (snapped ?? [drag]).map(pdfBox);
    apply((prev) => [
      ...prev,
      {
        id: `a${nextAnnotationId++}`,
        page: pageNumber,
        kind: "mark",
        style,
        boxes,
        color: style === "highlight" ? highlightColor : inkColor,
        opacity: style === "highlight" ? HIGHLIGHT_OPACITY : 1,
      },
    ]);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!viewport) return;
    const at = pointerPosition(e);
    commitText();

    if (mode === "select") {
      const selected = selectedId ? pageAnnotations.find((a) => a.id === selectedId) : undefined;
      // Handles win over the annotation underneath them, or a corner grab would
      // start a move instead of a resize.
      const grabbed = selected && handlesFor(selected).find((h) => Math.hypot(h.x - at.x, h.y - at.y) <= HANDLE);
      if (selected && grabbed) {
        const oldBox = annotationBox(selected);
        const anchor =
          grabbed.id === "nw"
            ? { x: oldBox.x + oldBox.width, y: oldBox.y + oldBox.height }
            : grabbed.id === "ne"
              ? { x: oldBox.x, y: oldBox.y + oldBox.height }
              : grabbed.id === "sw"
                ? { x: oldBox.x + oldBox.width, y: oldBox.y }
                : { x: oldBox.x, y: oldBox.y };
        setHistory((h) => [...h.slice(-60), annotationsRef.current]);
        setFuture([]);
        setDraft({ kind: "resize", id: selected.id, handle: grabbed.id, original: selected, oldBox, anchor });
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      const hit = hitTest(at);
      setSelectedId(hit?.id ?? null);
      if (hit) {
        // The whole drag is one undo step, so the history entry is pushed here
        // rather than on every pointermove.
        setHistory((h) => [...h.slice(-60), annotationsRef.current]);
        setFuture([]);
        setDraft({ kind: "move", id: hit.id, last: at });
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (mode === "retype") {
      retypeAt(at);
      return;
    }

    setSelectedId(null);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (TEXT_MODES.includes(mode)) {
      // A stamp preloads the box so the common case is one click and Enter.
      textDraftRef.current = { at, value: presetText ?? "" };
      setPresetText(null);
      setTextDraft(textDraftRef.current);
      return;
    }
    if (mode === "pen") {
      setDraft({ kind: "stroke", points: [at] });
      return;
    }
    setDraft({ kind: "box", from: at, to: at });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draft || !viewport) return;
    const at = pointerPosition(e);
    if (draft.kind === "box") {
      setDraft({ ...draft, to: at });
      return;
    }
    if (draft.kind === "stroke") {
      const last = draft.points[draft.points.length - 1];
      // Thinning the stream stops a signature becoming ten thousand line
      // segments in the saved file, with no visible loss of smoothness.
      if (Math.hypot(at.x - last.x, at.y - last.y) < 1.5) return;
      setDraft({ ...draft, points: [...draft.points, at] });
      return;
    }
    if (draft.kind === "resize") {
      const original = draft.original;
      if (original.kind === "line" && (draft.handle === "from" || draft.handle === "to")) {
        const moved = draft.handle === "from" ? { from: toPdf(at) } : { to: toPdf(at) };
        apply((prev) => prev.map((a) => (a.id === draft.id ? { ...original, ...moved } : a)), false);
        return;
      }
      const newBox = boxFrom(draft.anchor, at);
      if (newBox.width < 3 || newBox.height < 3) return;
      apply((prev) => prev.map((a) => (a.id === draft.id ? refit(original, draft.oldBox, newBox) : a)), false);
      return;
    }
    const from = toPdf(draft.last);
    const to = toPdf(at);
    apply((prev) => prev.map((a) => (a.id === draft.id ? translate(a, to.x - from.x, to.y - from.y) : a)), false);
    setDraft({ ...draft, last: at });
  }

  function onPointerUp() {
    if (!draft || !viewport) return;
    const current = draft;
    setDraft(null);
    if (current.kind === "move" || current.kind === "resize") return;

    if (current.kind === "stroke") {
      if (current.points.length === 0) return;
      apply((prev) => [
        ...prev,
        { id: `a${nextAnnotationId++}`, page: pageNumber, kind: "ink", points: current.points.map(toPdf), color: inkColor, thickness, opacity: 1 },
      ]);
      return;
    }

    const box = boxFrom(current.from, current.to);
    const tapped = box.width < 6 && box.height < 6;

    if (MARK_MODES.includes(mode)) {
      if (tapped) return;
      addMark(box);
      return;
    }

    if (mode === "link") {
      if (tapped) return;
      // Snapped like mark-up, so a link over a sentence hugs the sentence
      // rather than whatever rectangle the hand drew.
      const snapped = snapToText(box);
      setLinkDraft({ box: snapped?.[0] ?? box, url: "" });
      return;
    }

    if (mode === "field") {
      if (tapped) return;
      setFieldDraft({ box, name: `field${newFields.length + 1}`, kind: "text", options: "" });
      return;
    }

    if (mode === "line" || mode === "arrow") {
      if (Math.hypot(current.to.x - current.from.x, current.to.y - current.from.y) < 6) return;
      apply((prev) => [
        ...prev,
        {
          id: `a${nextAnnotationId++}`,
          page: pageNumber,
          kind: "line",
          from: toPdf(current.from),
          to: toPdf(current.to),
          color: inkColor,
          thickness,
          opacity: 1,
          arrow: mode === "arrow",
        },
      ]);
      return;
    }

    if (mode === "image") {
      if (!pendingImage) return;
      // Fitted inside the dragged box rather than filling it, so a signature or
      // a logo is never stretched. A plain tap gets a sensible default size
      // instead of nothing at all.
      const target = tapped ? { x: current.from.x, y: current.from.y, width: 220, height: 220 / pendingImage.ratio } : box;
      const height = Math.min(target.width / pendingImage.ratio, target.height);
      const width = height * pendingImage.ratio;
      const placed = { x: target.x + (target.width - width) / 2, y: target.y + (target.height - height) / 2, width, height };
      apply((prev) => [...prev, { id: `a${nextAnnotationId++}`, page: pageNumber, kind: "image", ...pdfBox(placed), source: pendingImage.source }]);
      return;
    }

    if (tapped) return;
    const whiteout = mode === "whiteout";
    apply((prev) => [
      ...prev,
      {
        id: `a${nextAnnotationId++}`,
        page: pageNumber,
        kind: mode === "ellipse" ? "ellipse" : "rect",
        ...pdfBox(box),
        stroke: whiteout ? null : inkColor,
        fill: whiteout ? "#ffffff" : filled ? inkColor : null,
        thickness: whiteout ? 0 : thickness,
        opacity: 1,
      },
    ]);
  }

  /** Double-clicking text reopens it for retyping, which is the one thing a placed note always ends up needing. */
  function onDoubleClick(e: ReactPointerEvent<HTMLDivElement>) {
    if (!viewport) return;
    const hit = hitTest(pointerPosition(e));
    if (!hit || hit.kind !== "text") return;
    const box = annotationBox(hit);
    setMode("select");
    setSelectedId(hit.id);
    setFontSize(hit.size);
    setInkColor(hit.color);
    setFont(hit.font);
    setBold(hit.bold);
    textDraftRef.current = { at: { x: box.x, y: box.y }, value: hit.text, editing: { id: hit.id, at: hit.at } };
    setTextDraft(textDraftRef.current);
  }

  function duplicateSelected() {
    const selected = annotationsRef.current.find((a) => a.id === selectedId);
    if (!selected) return;
    // Offset by a few points so the copy is visibly on top rather than exactly
    // hidden behind the original.
    const copy = { ...translate(selected, 12, -12), id: `a${nextAnnotationId++}` };
    apply((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    apply((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }

  function commitLink() {
    if (!linkDraft) return;
    const url = linkDraft.url.trim();
    if (!isSafeLinkUrl(url)) {
      setError("That needs to be a full web address — https://example.com, or mailto:someone@example.com.");
      return;
    }
    setError(null);
    apply((prev) => [...prev, { id: `a${nextAnnotationId++}`, page: pageNumber, kind: "link", ...pdfBox(linkDraft.box), url }]);
    setLinkDraft(null);
  }

  function commitField() {
    if (!fieldDraft) return;
    const name = fieldDraft.name.trim();
    if (!name) {
      setError("Give the field a name — it is what the answer comes back under.");
      return;
    }
    if (formFields.some((f) => f.name === name) || newFields.some((f) => f.name === name)) {
      setError(`This document already has a field called "${name}".`);
      return;
    }
    setError(null);
    const { from, to } = pdfBox(fieldDraft.box);
    setNewFields((prev) => [
      ...prev,
      {
        id: `f${nextAnnotationId++}`,
        page: pageNumber,
        kind: fieldDraft.kind,
        name,
        from,
        to,
        options: fieldDraft.kind === "dropdown" ? fieldDraft.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
        fontSize: 11,
      },
    ]);
    setFieldDraft(null);
  }

  function switchTool(next: ToolMode) {
    commitText();
    setMode(next);
    setSelectedId(null);
    setHint(null);
    setLinkDraft(null);
    setFieldDraft(null);
    setPresetText(null);
    if (next === "signature") {
      // A typed signature is a name set in italic serif at a size that reads as
      // a signature rather than as a caption.
      setFont("serif");
      setItalic(true);
      setBold(false);
      setFontSize(26);
      setInkColor("#1a1a1a");
    }
  }

  function goToPage(next: number) {
    commitText();
    setPageNumber(Math.min(Math.max(next, 1), pageCount));
    setSelectedId(null);
  }

  // Kept fresh every render, so the listener registered once on mount always
  // calls the current version without re-subscribing on every keystroke.
  useEffect(() => {
    shortcuts.current = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (e.key === "Escape") {
          textDraftRef.current = null;
          setTextDraft(null);
        }
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setDraft(null);
      }
    };
  });

  useEffect(() => {
    if (!file) return;
    const listener = (e: KeyboardEvent) => shortcuts.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [file]);

  async function chooseImage(picked: File) {
    try {
      const source = await imageSourceFromFile(picked);
      let url = revocableUrls.current.get(source.id);
      if (!url) {
        url = URL.createObjectURL(new Blob([source.bytes as BlobPart], { type: source.format === "png" ? "image/png" : "image/jpeg" }));
        revocableUrls.current.set(source.id, url);
        setImageUrls((prev) => ({ ...prev, [source.id]: url as string }));
      }
      const probe = new Image();
      probe.src = url;
      await probe.decode();
      setPendingImage({ source, url, ratio: probe.naturalWidth / Math.max(probe.naturalHeight, 1) });
      setError(null);
    } catch {
      setError(`Couldn't read ${picked.name}. PNG and JPEG are the safest choices.`);
    }
  }

  async function save() {
    if (!file) return;
    const list = commitText();
    const changedValues = Object.keys(formValues).length > 0;
    if (list.length === 0 && newFields.length === 0 && !changedValues) {
      setError("Add something first — text, a mark, a drawing, an image, or an answer in a form field.");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const out = await editPdf(file, list, { formValues, newFields });
      setResult(out.file);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That PDF couldn't be saved.");
      setStatus("ready");
    }
  }

  function reset() {
    setFile(null);
    setPdf(null);
    setRendered(null);
    setTextRuns({});
    setAnnotations([]);
    annotationsRef.current = [];
    setHistory([]);
    setFuture([]);
    setSelectedId(null);
    setTextDraft(null);
    textDraftRef.current = null;
    setPendingImage(null);
    setFormFields([]);
    setFormValues({});
    setNewFields([]);
    setLinkDraft(null);
    setFieldDraft(null);
    setPresetText(null);
    for (const url of revocableUrls.current.values()) URL.revokeObjectURL(url);
    revocableUrls.current.clear();
    setImageUrls({});
    setResult(null);
    setZoom(1);
    setStatus("idle");
    setError(null);
    setHint(null);
  }

  if (status === "done" && result) {
    return <ToolResultCard file={result} onSend={onSend} onReset={reset} />;
  }

  if (!file) {
    return (
      <FileDropZone
        onFiles={(files) => {
          setFile(files[0]);
          setStatus("loading");
          setError(null);
        }}
        accept="application/pdf,.pdf"
        multiple={false}
        label="Drop a PDF here, or click to choose"
        hint="Highlight, sign, draw and type on it — nothing is uploaded"
      />
    );
  }

  if (!rendered) {
    return (
      <div ref={frameRef} className="py-6">
        <p className="text-sm font-semibold text-black" role={error ? "alert" : undefined}>
          {error ?? "Opening the document…"}
        </p>
      </div>
    );
  }

  const activeTool = ALL_TOOLS.find((t) => t.mode === mode);
  const draftBox = draft?.kind === "box" ? boxFrom(draft.from, draft.to) : null;
  const selected = selectedId ? pageAnnotations.find((a) => a.id === selectedId) : undefined;
  const badCharacters = textDraft ? unwritableCharacters(textDraft.value) : [];
  const usesInkColor = ["text", "signature", "pen", "line", "arrow", "rect", "ellipse", "underline", "strike"].includes(mode);
  const isTextMode = TEXT_MODES.includes(mode);
  const pagesWithMarks = [...new Set([...annotations.map((a) => a.page), ...newFields.map((f) => f.page)])].sort((a, b) => a - b);
  const pageNewFields = newFields.filter((f) => f.page === pageNumber);
  const pageWidgets = formFields.flatMap((f) => f.places.filter((pl) => pl.page === pageNumber).map((pl) => ({ name: f.name, ...pl })));
  const draftLines = textDraft ? textDraft.value.split("\n") : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Tools, grouped by what they are for. Flat blocks; the active one becomes a red field rather than gaining an outline. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y-2 border-ink py-2.5">
        {TOOL_GROUPS.map((group) => (
          <div key={group.label} className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-red">{group.label}</span>
            <div className="flex gap-px bg-ink p-px">
              {group.tools.map((tool) => (
                <button
                  key={tool.mode}
                  type="button"
                  onClick={() => switchTool(tool.mode)}
                  aria-pressed={mode === tool.mode}
                  className={`px-2.5 py-2 text-[13px] font-bold leading-none ${mode === tool.mode ? "bg-red text-yellow" : "bg-y-max text-black"}`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Settings for whichever tool is active. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] font-semibold text-black">
        <span className="text-red">{activeTool?.hint}</span>

        {(usesInkColor || mode === "highlight") && (
          <div className="flex items-center gap-1.5">
            {(mode === "highlight" ? HIGHLIGHT_SWATCHES : INK_SWATCHES).map((swatch) => {
              const active = (mode === "highlight" ? highlightColor : inkColor) === swatch;
              return (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Colour ${swatch}`}
                  aria-pressed={active}
                  onClick={() => (mode === "highlight" ? setHighlightColor(swatch) : setInkColor(swatch))}
                  className={`h-6 w-6 border-2 ${active ? "border-ink" : "border-black/25"}`}
                  style={{ background: swatch }}
                />
              );
            })}
            <input
              type="color"
              aria-label="Custom colour"
              value={mode === "highlight" ? highlightColor : inkColor}
              onChange={(e) => (mode === "highlight" ? setHighlightColor(e.target.value) : setInkColor(e.target.value))}
              className="h-6 w-8 cursor-pointer border-2 border-black/25 bg-transparent p-0"
            />
          </div>
        )}

        {isTextMode && (
          <>
            <label className="flex items-center gap-2">
              Size
              <input type="range" min={6} max={72} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="accent-red" />
              <span className="font-mono tabular-nums text-red">{fontSize}pt</span>
            </label>
            <div className="flex gap-px bg-ink p-px">
              {FONT_LABELS.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={font === choice.value}
                  onClick={() => setFont(choice.value)}
                  className={`px-2.5 py-1.5 leading-none ${font === choice.value ? "bg-red text-yellow" : "bg-y-max text-black"}`}
                >
                  {choice.label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={bold}
                aria-label="Bold"
                onClick={() => setBold(!bold)}
                className={`px-2.5 py-1.5 font-bold leading-none ${bold ? "bg-red text-yellow" : "bg-y-max text-black"}`}
              >
                B
              </button>
              <button
                type="button"
                aria-pressed={italic}
                aria-label="Italic"
                onClick={() => setItalic(!italic)}
                className={`px-2.5 py-1.5 italic leading-none ${italic ? "bg-red text-yellow" : "bg-y-max text-black"}`}
              >
                I
              </button>
            </div>
            {mode === "text" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-red">Stamp</span>
                <div className="flex gap-px bg-ink p-px">
                  {STAMPS.map((stamp) => (
                    <button
                      key={stamp.label}
                      type="button"
                      aria-pressed={presetText === stamp.text()}
                      onClick={() => setPresetText(stamp.text())}
                      className={`px-2 py-1.5 text-[12px] leading-none ${presetText === stamp.text() ? "bg-red text-yellow" : "bg-y-max text-black"}`}
                    >
                      {stamp.label}
                    </button>
                  ))}
                </div>
                {presetText && <span className="text-red">Now click where it goes.</span>}
              </div>
            )}
          </>
        )}

        {["pen", "line", "arrow", "rect", "ellipse"].includes(mode) && (
          <label className="flex items-center gap-2">
            Line
            <input type="range" min={1} max={12} value={thickness} onChange={(e) => setThickness(Number(e.target.value))} className="accent-red" />
            <span className="font-mono tabular-nums text-red">{thickness}</span>
          </label>
        )}

        {(mode === "rect" || mode === "ellipse") && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} className="accent-red" />
            Fill it in
          </label>
        )}

        {mode === "image" && (
          <>
            <label className="flex cursor-pointer items-center gap-2 bg-y-max px-3 py-1.5 leading-none">
              {pendingImage ? "Change image" : "Choose an image"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && chooseImage(e.target.files[0])} />
            </label>
            {pendingImage && <span className="text-red">Now drag a box on the page, or tap to drop it in.</span>}
          </>
        )}

        {mode === "select" && selected && (
          <div className="flex items-center gap-4">
            <button type="button" onClick={duplicateSelected} className="link text-red">
              Duplicate
            </button>
            <button type="button" onClick={deleteSelected} className="link text-red">
              Delete
            </button>
          </div>
        )}
      </div>

      {mode === "whiteout" && (
        <p className="border-l-2 border-rule-strong pl-3 text-sm text-black">
          Whiteout covers, it does not remove. The text underneath stays in the file and can still be copied out of it — this is
          not redaction.
        </p>
      )}

      {/* Page navigation and view controls. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y-2 border-ink py-2 text-[13px] font-semibold text-black">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber === 1} className="bg-y-max px-2.5 py-1.5 leading-none disabled:opacity-40">
            ← Prev
          </button>
          <span className="font-mono tabular-nums text-red">
            Page {pageNumber} of {pageCount}
          </span>
          <button type="button" onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber === pageCount} className="bg-y-max px-2.5 py-1.5 leading-none disabled:opacity-40">
            Next →
          </button>
          <label className="flex items-center gap-1.5">
            Go to
            <input
              type="number"
              min={1}
              max={pageCount}
              value={pageNumber}
              onChange={(e) => goToPage(Number(e.target.value))}
              aria-label="Go to page"
              className="w-16 border-2 border-ink bg-y-max px-1.5 py-1 font-mono tabular-nums text-black outline-none"
            />
          </label>
          <span className="text-red">
            {pageAnnotations.length} {pageAnnotations.length === 1 ? "mark" : "marks"} here · {annotations.length} in all
          </span>
          {pagesWithMarks.length > 1 && (
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-red">Marked</span>
              {pagesWithMarks.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => goToPage(n)}
                  aria-label={`Go to page ${n}`}
                  className={`px-1.5 py-1 font-mono text-[12px] tabular-nums leading-none ${n === pageNumber ? "bg-red text-yellow" : "bg-y-max text-black"}`}
                >
                  {n}
                </button>
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="bg-y-max px-2.5 py-1.5 leading-none">
            −
          </button>
          <span className="font-mono tabular-nums text-red">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="bg-y-max px-2.5 py-1.5 leading-none">
            +
          </button>
          <button type="button" onClick={undo} disabled={history.length === 0} className="link text-red disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} className="link text-red disabled:opacity-40">
            Redo
          </button>
        </div>
      </div>

      {/* The page itself. */}
      <div ref={frameRef} className="sff-track overflow-x-auto">
        <div
          ref={surfaceRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          style={{ width: rendered.viewport.width, height: rendered.viewport.height, touchAction: "none" }}
          className={`relative select-none bg-white ${mode === "select" ? "cursor-default" : "cursor-crosshair"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rendered.dataUrl} alt={`Page ${pageNumber}`} width={rendered.viewport.width} height={rendered.viewport.height} draggable={false} />

          <svg width={rendered.viewport.width} height={rendered.viewport.height} className="pointer-events-none absolute inset-0" aria-hidden="true">
            {pageAnnotations.map((annotation) => {
              if (annotation.kind === "text") {
                const base = toScreen(annotation.at);
                const pixelSize = annotation.size * scale;
                return (
                  <text
                    key={annotation.id}
                    x={base.x}
                    y={base.y}
                    fill={annotation.color}
                    fontSize={pixelSize}
                    fontFamily={CSS_FONTS[annotation.font]}
                    fontWeight={annotation.bold ? 700 : 400}
                  >
                    {annotation.text.split("\n").map((line, index) => (
                      <tspan key={index} x={base.x} dy={index === 0 ? 0 : pixelSize * LINE_HEIGHT}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                );
              }
              if (annotation.kind === "ink") {
                const points = annotation.points.map(toScreen);
                return (
                  <polyline
                    key={annotation.id}
                    points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={annotation.color}
                    strokeWidth={annotation.thickness * scale}
                    strokeOpacity={annotation.opacity}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }
              if (annotation.kind === "line") {
                const from = toScreen(annotation.from);
                const to = toScreen(annotation.to);
                const length = Math.hypot(to.x - from.x, to.y - from.y);
                const barb = Math.min(Math.max(annotation.thickness * 4, 7) * scale, length * 0.6);
                const heading = Math.atan2(to.y - from.y, to.x - from.x);
                const tip = (sign: number) => ({
                  x: to.x + Math.cos(heading + sign * Math.PI * (5 / 6)) * barb,
                  y: to.y + Math.sin(heading + sign * Math.PI * (5 / 6)) * barb,
                });
                const shared = { stroke: annotation.color, strokeWidth: annotation.thickness * scale, strokeLinecap: "round" as const };
                return (
                  <g key={annotation.id}>
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...shared} />
                    {annotation.arrow &&
                      [1, -1].map((sign) => {
                        const t = tip(sign);
                        return <line key={sign} x1={t.x} y1={t.y} x2={to.x} y2={to.y} {...shared} />;
                      })}
                  </g>
                );
              }
              if (annotation.kind === "mark") {
                return (
                  <g key={annotation.id} style={{ mixBlendMode: "multiply" }}>
                    {annotation.boxes.map((b, index) => {
                      const box = boxFrom(toScreen(b.from), toScreen(b.to));
                      if (annotation.style === "highlight") {
                        return <rect key={index} x={box.x} y={box.y} width={box.width} height={box.height} fill={annotation.color} opacity={annotation.opacity} />;
                      }
                      const y = box.y + box.height * MARK_DEPTH[annotation.style];
                      return (
                        <line
                          key={index}
                          x1={box.x}
                          y1={y}
                          x2={box.x + box.width}
                          y2={y}
                          stroke={annotation.color}
                          strokeWidth={Math.max(Math.min(box.width, box.height) * 0.06, 0.7)}
                        />
                      );
                    })}
                  </g>
                );
              }
              const box = boxFrom(toScreen(annotation.from), toScreen(annotation.to));
              if (annotation.kind === "link") {
                // Invisible in the finished PDF; shown here so you can see what
                // you made, and underlined the way a link is expected to look.
                return (
                  <g key={annotation.id}>
                    <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="#1447e6" fillOpacity={0.08} />
                    <line x1={box.x} y1={box.y + box.height} x2={box.x + box.width} y2={box.y + box.height} stroke="#1447e6" strokeWidth={1} />
                  </g>
                );
              }
              if (annotation.kind === "image") {
                return <image key={annotation.id} href={imageUrls[annotation.source.id]} x={box.x} y={box.y} width={box.width} height={box.height} preserveAspectRatio="none" />;
              }
              const shared = {
                fill: annotation.fill ?? "none",
                stroke: annotation.stroke ?? "none",
                strokeWidth: annotation.thickness * scale,
                opacity: annotation.opacity,
              };
              return annotation.kind === "rect" ? (
                <rect key={annotation.id} x={box.x} y={box.y} width={box.width} height={box.height} {...shared} />
              ) : (
                <ellipse key={annotation.id} cx={box.x + box.width / 2} cy={box.y + box.height / 2} rx={box.width / 2} ry={box.height / 2} {...shared} />
              );
            })}

            {/* The form as it stands: fields the document already has, and the ones
                waiting to be created. Both are outlines only — they are places to
                type, not marks on the page. */}
            {pageWidgets.map((widget, index) => {
              const box = boxFrom(toScreen(widget.from), toScreen(widget.to));
              return (
                <rect key={`w${index}`} x={box.x} y={box.y} width={box.width} height={box.height} fill="#1447e6" fillOpacity={0.06} stroke="#1447e6" strokeWidth={1} strokeDasharray="3 2" />
              );
            })}
            {pageNewFields.map((field) => {
              const box = boxFrom(toScreen(field.from), toScreen(field.to));
              return (
                <g key={field.id}>
                  <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="#087f5b" fillOpacity={0.08} stroke="#087f5b" strokeWidth={1.5} strokeDasharray="4 3" />
                  <text x={box.x + 3} y={box.y - 3} fontSize={11} fill="#087f5b" fontFamily={CSS_FONTS.sans}>
                    {field.name}
                  </text>
                </g>
              );
            })}

            {/* Live feedback for whatever is being drawn right now. */}
            {draftBox && BOX_MODES.includes(mode) && (
              <rect
                x={draftBox.x}
                y={draftBox.y}
                width={draftBox.width}
                height={draftBox.height}
                fill={mode === "whiteout" ? "#ffffff" : mode === "highlight" ? highlightColor : filled && (mode === "rect" || mode === "ellipse") ? inkColor : "none"}
                fillOpacity={mode === "highlight" ? HIGHLIGHT_OPACITY : 1}
                stroke={mode === "rect" || mode === "ellipse" ? inkColor : "#d50000"}
                strokeWidth={mode === "rect" || mode === "ellipse" ? thickness * scale : 1}
                strokeDasharray={mode === "rect" ? undefined : "4 4"}
              />
            )}
            {draft?.kind === "box" && (mode === "line" || mode === "arrow") && (
              <line x1={draft.from.x} y1={draft.from.y} x2={draft.to.x} y2={draft.to.y} stroke={inkColor} strokeWidth={thickness * scale} strokeLinecap="round" />
            )}
            {draft?.kind === "stroke" && (
              <polyline
                points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={inkColor}
                strokeWidth={thickness * scale}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Selection outline and its grab handles. */}
            {selected &&
              (() => {
                const box = annotationBox(selected);
                return (
                  <g>
                    <rect x={box.x - 3} y={box.y - 3} width={box.width + 6} height={box.height + 6} fill="none" stroke="#d50000" strokeWidth={1.5} strokeDasharray="5 3" />
                    {handlesFor(selected).map((h) => (
                      <rect key={h.id} x={h.x - HANDLE / 2} y={h.y - HANDLE / 2} width={HANDLE} height={HANDLE} fill="#d50000" stroke="#ffffff" strokeWidth={1.5} />
                    ))}
                  </g>
                );
              })()}
          </svg>

          {/* The text box, sitting exactly where the text will land. */}
          {textDraft && (
            <textarea
              autoFocus
              value={textDraft.value}
              rows={draftLines.length}
              onChange={(e) => {
                textDraftRef.current = { ...textDraft, value: e.target.value };
                setTextDraft(textDraftRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitText();
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              placeholder="Type — ⌘⏎ to place"
              style={{
                left: textDraft.at.x - 2,
                top: textDraft.at.y - 2,
                fontSize: fontSize * scale,
                lineHeight: LINE_HEIGHT,
                fontFamily: CSS_FONTS[font],
                fontWeight: bold ? 700 : 400,
                color: inkColor,
                width: Math.max(measureTextWidth(textDraft.value || "M", fontSize * scale, font, bold) + fontSize * scale, 130),
              }}
              className="absolute z-10 resize-none overflow-hidden border-2 border-red bg-white/90 outline-none"
            />
          )}

          {/* Asking for the address inline rather than through a browser prompt,
              which is blocked in some contexts and looks like a phishing box. */}
          {linkDraft && (
            <div
              style={{ left: linkDraft.box.x, top: linkDraft.box.y + linkDraft.box.height + 6 }}
              className="absolute z-10 flex items-center gap-2 border-2 border-ink bg-y-pale p-2"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                type="url"
                value={linkDraft.url}
                placeholder="https://example.com"
                aria-label="Link address"
                onChange={(e) => setLinkDraft({ ...linkDraft, url: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLink();
                  if (e.key === "Escape") setLinkDraft(null);
                }}
                className="w-64 border-2 border-ink bg-white px-2 py-1.5 text-[13px] font-semibold text-black outline-none"
              />
              <button type="button" onClick={commitLink} className="bg-red px-3 py-2 text-[13px] font-bold leading-none text-yellow">
                Add
              </button>
              <button type="button" onClick={() => setLinkDraft(null)} className="link text-[13px] text-red">
                Cancel
              </button>
            </div>
          )}

          {fieldDraft && (
            <div
              style={{ left: fieldDraft.box.x, top: fieldDraft.box.y + fieldDraft.box.height + 6 }}
              className="absolute z-10 flex flex-wrap items-center gap-2 border-2 border-ink bg-y-pale p-2"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={fieldDraft.name}
                aria-label="Field name"
                placeholder="Field name"
                onChange={(e) => setFieldDraft({ ...fieldDraft, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitField();
                  if (e.key === "Escape") setFieldDraft(null);
                }}
                className="w-40 border-2 border-ink bg-white px-2 py-1.5 text-[13px] font-semibold text-black outline-none"
              />
              <select
                value={fieldDraft.kind}
                aria-label="Field type"
                onChange={(e) => setFieldDraft({ ...fieldDraft, kind: e.target.value as FieldKind })}
                className="border-2 border-ink bg-white px-2 py-1.5 text-[13px] font-semibold text-black"
              >
                {FIELD_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              {fieldDraft.kind === "dropdown" && (
                <input
                  value={fieldDraft.options}
                  aria-label="Dropdown choices, separated by commas"
                  placeholder="Yes, No, Maybe"
                  onChange={(e) => setFieldDraft({ ...fieldDraft, options: e.target.value })}
                  className="w-44 border-2 border-ink bg-white px-2 py-1.5 text-[13px] font-semibold text-black outline-none"
                />
              )}
              <button type="button" onClick={commitField} className="bg-red px-3 py-2 text-[13px] font-bold leading-none text-yellow">
                Add
              </button>
              <button type="button" onClick={() => setFieldDraft(null)} className="link text-[13px] text-red">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <FormFieldsPanel
        fields={formFields}
        values={formValues}
        newFields={newFields}
        onChange={(name, value) => setFormValues((prev) => ({ ...prev, [name]: value }))}
        onLocate={(page) => goToPage(page)}
        onRemoveNew={(id) => setNewFields((prev) => prev.filter((f) => f.id !== id))}
      />

      {badCharacters.length > 0 && (
        <p role="alert" className="border-l-2 border-rule-strong pl-3 text-sm text-black">
          The built-in PDF fonts can&rsquo;t write {badCharacters.map((c) => `"${c}"`).join(", ")}. Latin letters, digits and
          punctuation only — no Greek, Cyrillic, CJK or emoji.
        </p>
      )}

      {hint && <p className="border-l-2 border-rule-strong pl-3 text-sm text-black">{hint}</p>}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button onClick={save} disabled={status === "saving" || (annotations.length === 0 && newFields.length === 0 && Object.keys(formValues).length === 0 && !textDraft?.value.trim())}>
          {status === "saving" ? "Saving…" : "Save edited PDF"}
        </Button>
        <button
          type="button"
          onClick={() => {
            apply((prev) => prev.filter((a) => a.page !== pageNumber));
            setSelectedId(null);
          }}
          disabled={pageAnnotations.length === 0}
          className="link text-sm text-red disabled:opacity-40"
        >
          Clear this page
        </button>
        <button type="button" onClick={reset} className="link text-sm text-red">
          Start over
        </button>
      </div>
    </div>
  );
}
