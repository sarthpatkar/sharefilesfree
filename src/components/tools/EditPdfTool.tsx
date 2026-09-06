"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type * as pdfjsLib from "pdfjs-dist";
import { loadPdf, renderPageWithViewport } from "@/lib/tools/pdfjs";
import {
  editPdf,
  imageSourceFromFile,
  unwritableCharacters,
  type Annotation,
  type FontChoice,
  type ImageSource,
  type Point,
} from "@/lib/tools/editPdf";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

/*
 * The editing surface for Edit PDF.
 *
 * Two rules hold the whole thing together:
 *
 * 1. Annotations live in PDF points, never in screen pixels. A click is
 *    converted through pdf.js's `viewport.convertToPdfPoint` the moment it
 *    arrives, and converted back only to draw the preview. Zoom, a page's own
 *    /Rotate and a crop box that doesn't start at the origin are then the
 *    viewport's problem rather than ours.
 * 2. The preview is drawn from exactly the data that gets written. The SVG
 *    overlay reads the same annotation list `editPdf` does, so what somebody
 *    positions is what they get.
 */

type ToolMode = "select" | "text" | "rect" | "ellipse" | "pen" | "highlighter" | "image";

const TOOL_MODES: { mode: ToolMode; label: string; hint: string }[] = [
  { mode: "select", label: "Select", hint: "Click a mark to drag it, or delete it" },
  { mode: "text", label: "Text", hint: "Click where the text should start, then type" },
  { mode: "rect", label: "Rectangle", hint: "Drag to draw a box" },
  { mode: "ellipse", label: "Ellipse", hint: "Drag to draw an oval" },
  { mode: "pen", label: "Pen", hint: "Draw freehand — this is the one for a signature" },
  { mode: "highlighter", label: "Highlighter", hint: "Drag across text to highlight it" },
  { mode: "image", label: "Image", hint: "Choose a picture, then drag a box for it" },
];

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
/** How much fatter than the pen a highlighter nib is, in points. */
const HIGHLIGHT_NIB = (thickness: number) => Math.max(thickness * 6, 12);

let measureContext: CanvasRenderingContext2D | null = null;
function measureTextWidth(text: string, pixelSize: number, font: FontChoice, bold: boolean): number {
  if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * pixelSize * 0.5;
  measureContext.font = `${bold ? "bold " : ""}${pixelSize}px ${CSS_FONTS[font]}`;
  return measureContext.measureText(text).width;
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

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

type Draft =
  | { kind: "box"; from: Point; to: Point }
  | { kind: "stroke"; points: Point[] }
  | { kind: "move"; id: string; last: Point }
  | null;

let nextAnnotationId = 0;

export function EditPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [frameWidth, setFrameWidth] = useState(0);
  const [rendered, setRendered] = useState<{ dataUrl: string; viewport: pdfjsLib.PageViewport } | null>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [mode, setMode] = useState<ToolMode>("text");
  const [inkColor, setInkColor] = useState("#d50000");
  const [highlightColor, setHighlightColor] = useState("#ffe600");
  const [thickness, setThickness] = useState(2);
  const [filled, setFilled] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [font, setFont] = useState<FontChoice>("sans");
  const [bold, setBold] = useState(false);

  const [pendingImage, setPendingImage] = useState<{ source: ImageSource; url: string; ratio: number } | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [textDraft, setTextDraft] = useState<{ at: Point; value: string } | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "saving" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const revocableUrls = useRef(new Map<string, string>());

  // Shadow copies of two pieces of state, written alongside every setState that
  // touches them. State updates are asynchronous, but one pointer gesture can
  // fire several before React re-renders — starting a drag commits an open text
  // box and then moves a mark — and each step has to see what the one before it
  // did. Only ever written from event handlers, never during render.
  const annotationsRef = useRef<Annotation[]>([]);
  const textDraftRef = useRef<typeof textDraft>(null);

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
      if (!cancelled) setRendered(next);
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

  /** Every change to the annotation list goes through here, so undo has one place to record. */
  function apply(change: (prev: Annotation[]) => Annotation[], undoable = true) {
    const prev = annotationsRef.current;
    const next = change(prev);
    if (next === prev) return next;
    annotationsRef.current = next;
    if (undoable) setHistory((h) => [...h.slice(-40), prev]);
    setAnnotations(next);
    return next;
  }

  function undo() {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    annotationsRef.current = previous;
    setAnnotations(previous);
    setHistory(history.slice(0, -1));
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
    if (!open || !open.value.trim() || !viewport) return annotationsRef.current;
    // The click marks the top-left of the text, which is where people expect to
    // start typing. The PDF wants the baseline, about four fifths of the way
    // down — worked out in screen space so a rotated page needs no special case.
    const baseline = toPdf({ x: open.at.x, y: open.at.y + fontSize * scale * 0.8 });
    return apply((prev) => [
      ...prev,
      { id: `a${nextAnnotationId++}`, page: pageNumber, kind: "text", at: baseline, text: open.value, size: fontSize, color: inkColor, font, bold },
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

  /** Screen-space bounds of an annotation — used for the selection outline and for hit testing. */
  function annotationBox(annotation: Annotation): ScreenBox {
    if (annotation.kind === "text") {
      const base = toScreen(annotation.at);
      const pixelSize = annotation.size * scale;
      return {
        x: base.x,
        y: base.y - pixelSize * 0.8,
        width: measureTextWidth(annotation.text, pixelSize, annotation.font, annotation.bold),
        height: pixelSize,
      };
    }
    if (annotation.kind === "ink") {
      const points = annotation.points.map(toScreen);
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    return boxFrom(toScreen(annotation.from), toScreen(annotation.to));
  }

  function hitTest(p: Point): Annotation | null {
    // Backwards, because the most recently drawn mark is the one on top.
    for (let i = pageAnnotations.length - 1; i >= 0; i--) {
      const annotation = pageAnnotations[i];
      if (annotation.kind === "ink") {
        const points = annotation.points.map(toScreen);
        const reach = (annotation.thickness * scale) / 2 + 5;
        if (points.length === 1 && Math.hypot(points[0].x - p.x, points[0].y - p.y) <= reach) return annotation;
        for (let j = 1; j < points.length; j++) {
          if (distanceToSegment(p, points[j - 1], points[j]) <= reach) return annotation;
        }
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
    return { ...annotation, from: shift(annotation.from), to: shift(annotation.to) };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!viewport) return;
    const at = pointerPosition(e);
    commitText();

    if (mode === "select") {
      const hit = hitTest(at);
      setSelectedId(hit?.id ?? null);
      if (hit) {
        // The whole drag is one undo step, so the history entry is pushed here
        // rather than on every pointermove.
        const snapshot = annotationsRef.current;
        setHistory((h) => [...h.slice(-40), snapshot]);
        setDraft({ kind: "move", id: hit.id, last: at });
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    setSelectedId(null);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (mode === "text") {
      textDraftRef.current = { at, value: "" };
      setTextDraft(textDraftRef.current);
      return;
    }
    if (mode === "pen" || mode === "highlighter") {
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
    const from = toPdf(draft.last);
    const to = toPdf(at);
    apply((prev) => prev.map((a) => (a.id === draft.id ? translate(a, to.x - from.x, to.y - from.y) : a)), false);
    setDraft({ ...draft, last: at });
  }

  function onPointerUp() {
    if (!draft || !viewport) return;
    const current = draft;
    setDraft(null);
    if (current.kind === "move") return;

    if (current.kind === "stroke") {
      if (current.points.length === 0) return;
      const highlighting = mode === "highlighter";
      apply((prev) => [
        ...prev,
        {
          id: `a${nextAnnotationId++}`,
          page: pageNumber,
          kind: "ink",
          points: current.points.map(toPdf),
          color: highlighting ? highlightColor : inkColor,
          thickness: highlighting ? HIGHLIGHT_NIB(thickness) : thickness,
          opacity: highlighting ? HIGHLIGHT_OPACITY : 1,
          highlighter: highlighting,
        },
      ]);
      return;
    }

    const box = boxFrom(current.from, current.to);
    const tapped = box.width < 6 && box.height < 6;

    if (mode === "image") {
      if (!pendingImage) return;
      // Fitted inside the dragged box rather than filling it, so a signature or
      // a logo is never stretched. A plain tap gets a sensible default size
      // instead of nothing at all.
      const target = tapped ? { x: current.from.x, y: current.from.y, width: 220, height: 220 / pendingImage.ratio } : box;
      const height = Math.min(target.width / pendingImage.ratio, target.height);
      const width = height * pendingImage.ratio;
      const x = target.x + (target.width - width) / 2;
      const y = target.y + (target.height - height) / 2;
      apply((prev) => [
        ...prev,
        { id: `a${nextAnnotationId++}`, page: pageNumber, kind: "image", from: toPdf({ x, y }), to: toPdf({ x: x + width, y: y + height }), source: pendingImage.source },
      ]);
      return;
    }

    if (tapped) return;
    apply((prev) => [
      ...prev,
      {
        id: `a${nextAnnotationId++}`,
        page: pageNumber,
        kind: mode === "ellipse" ? "ellipse" : "rect",
        from: toPdf({ x: box.x, y: box.y }),
        to: toPdf({ x: box.x + box.width, y: box.y + box.height }),
        color: inkColor,
        fill: filled ? inkColor : null,
        thickness,
        opacity: 1,
      },
    ]);
  }

  function switchTool(next: ToolMode) {
    commitText();
    setMode(next);
    setSelectedId(null);
  }

  function goToPage(next: number) {
    commitText();
    setPageNumber(Math.min(Math.max(next, 1), pageCount));
    setSelectedId(null);
  }

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
    if (list.length === 0) {
      setError("Add something to the page first — text, a shape, a drawing or an image.");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const out = await editPdf(file, list);
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
    setAnnotations([]);
    annotationsRef.current = [];
    setHistory([]);
    setSelectedId(null);
    setTextDraft(null);
    textDraftRef.current = null;
    setPendingImage(null);
    for (const url of revocableUrls.current.values()) URL.revokeObjectURL(url);
    revocableUrls.current.clear();
    setImageUrls({});
    setResult(null);
    setZoom(1);
    setStatus("idle");
    setError(null);
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
        hint="Add text, shapes, drawings and images — nothing is uploaded"
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

  const activeHint = TOOL_MODES.find((t) => t.mode === mode)?.hint ?? "";
  const draftBox = draft?.kind === "box" ? boxFrom(draft.from, draft.to) : null;
  const selected = selectedId ? pageAnnotations.find((a) => a.id === selectedId) : undefined;
  const badCharacters = textDraft ? unwritableCharacters(textDraft.value) : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Tools. A ruled band of flat blocks; the active one becomes a red field rather than gaining an outline. */}
      <div className="flex flex-wrap gap-px border-y-2 border-ink bg-ink py-px">
        {TOOL_MODES.map((tool) => (
          <button
            key={tool.mode}
            type="button"
            onClick={() => switchTool(tool.mode)}
            aria-pressed={mode === tool.mode}
            className={`flex-1 px-3 py-2.5 text-[13px] font-bold leading-none ${mode === tool.mode ? "bg-red text-yellow" : "bg-y-max text-black"}`}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {/* Settings for whichever tool is active. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] font-semibold text-black">
        <span className="text-red">{activeHint}</span>

        {mode !== "select" && mode !== "image" && (
          <div className="flex items-center gap-1.5">
            {(mode === "highlighter" ? HIGHLIGHT_SWATCHES : INK_SWATCHES).map((swatch) => {
              const active = (mode === "highlighter" ? highlightColor : inkColor) === swatch;
              return (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Colour ${swatch}`}
                  aria-pressed={active}
                  onClick={() => (mode === "highlighter" ? setHighlightColor(swatch) : setInkColor(swatch))}
                  className={`h-6 w-6 border-2 ${active ? "border-ink" : "border-black/25"}`}
                  style={{ background: swatch }}
                />
              );
            })}
            <input
              type="color"
              aria-label="Custom colour"
              value={mode === "highlighter" ? highlightColor : inkColor}
              onChange={(e) => (mode === "highlighter" ? setHighlightColor(e.target.value) : setInkColor(e.target.value))}
              className="h-6 w-8 cursor-pointer border-2 border-black/25 bg-transparent p-0"
            />
          </div>
        )}

        {mode === "text" && (
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
            </div>
          </>
        )}

        {(mode === "rect" || mode === "ellipse" || mode === "pen" || mode === "highlighter") && (
          <label className="flex items-center gap-2">
            {mode === "highlighter" ? "Nib" : "Line"}
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
          <button
            type="button"
            onClick={() => {
              apply((prev) => prev.filter((a) => a.id !== selected.id));
              setSelectedId(null);
            }}
            className="link text-red"
          >
            Delete selected
          </button>
        )}
      </div>

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
          <span className="text-red">
            {pageAnnotations.length} {pageAnnotations.length === 1 ? "mark" : "marks"} on this page · {annotations.length} in all
          </span>
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
          style={{ width: rendered.viewport.width, height: rendered.viewport.height, touchAction: "none" }}
          className={`relative select-none bg-white ${mode === "select" ? "cursor-default" : "cursor-crosshair"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rendered.dataUrl} alt={`Page ${pageNumber}`} width={rendered.viewport.width} height={rendered.viewport.height} draggable={false} />

          <svg width={rendered.viewport.width} height={rendered.viewport.height} className="pointer-events-none absolute inset-0" aria-hidden="true">
            {pageAnnotations.map((annotation) => {
              if (annotation.kind === "text") {
                const base = toScreen(annotation.at);
                return (
                  <text
                    key={annotation.id}
                    x={base.x}
                    y={base.y}
                    fill={annotation.color}
                    fontSize={annotation.size * scale}
                    fontFamily={CSS_FONTS[annotation.font]}
                    fontWeight={annotation.bold ? 700 : 400}
                  >
                    {annotation.text}
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
                    style={annotation.highlighter ? { mixBlendMode: "multiply" } : undefined}
                  />
                );
              }
              const box = boxFrom(toScreen(annotation.from), toScreen(annotation.to));
              if (annotation.kind === "image") {
                return <image key={annotation.id} href={imageUrls[annotation.source.id]} x={box.x} y={box.y} width={box.width} height={box.height} preserveAspectRatio="none" />;
              }
              const shared = { fill: annotation.fill ?? "none", stroke: annotation.color, strokeWidth: annotation.thickness * scale, opacity: annotation.opacity };
              return annotation.kind === "rect" ? (
                <rect key={annotation.id} x={box.x} y={box.y} width={box.width} height={box.height} {...shared} />
              ) : (
                <ellipse key={annotation.id} cx={box.x + box.width / 2} cy={box.y + box.height / 2} rx={box.width / 2} ry={box.height / 2} {...shared} />
              );
            })}

            {/* Live feedback for whatever is being drawn right now. */}
            {draftBox && mode === "image" && <rect x={draftBox.x} y={draftBox.y} width={draftBox.width} height={draftBox.height} fill="none" stroke="#d50000" strokeWidth={1} strokeDasharray="4 4" />}
            {draftBox && (mode === "rect" || mode === "ellipse") && (
              <rect
                x={draftBox.x}
                y={draftBox.y}
                width={draftBox.width}
                height={draftBox.height}
                fill={filled ? inkColor : "none"}
                stroke={inkColor}
                strokeWidth={thickness * scale}
                strokeDasharray={mode === "ellipse" ? "4 4" : undefined}
              />
            )}
            {draft?.kind === "stroke" && (
              <polyline
                points={draft.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={mode === "highlighter" ? highlightColor : inkColor}
                strokeWidth={(mode === "highlighter" ? HIGHLIGHT_NIB(thickness) : thickness) * scale}
                strokeOpacity={mode === "highlighter" ? HIGHLIGHT_OPACITY : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {selected &&
              (() => {
                const box = annotationBox(selected);
                return <rect x={box.x - 3} y={box.y - 3} width={box.width + 6} height={box.height + 6} fill="none" stroke="#d50000" strokeWidth={1.5} strokeDasharray="5 3" />;
              })()}
          </svg>

          {/* The text box, sitting exactly where the text will land. */}
          {textDraft && (
            <input
              autoFocus
              value={textDraft.value}
              onChange={(e) => {
                textDraftRef.current = { ...textDraft, value: e.target.value };
                setTextDraft(textDraftRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitText();
                if (e.key === "Escape") {
                  textDraftRef.current = null;
                  setTextDraft(null);
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Type, then press Enter"
              style={{
                left: textDraft.at.x - 2,
                top: textDraft.at.y - 2,
                fontSize: fontSize * scale,
                fontFamily: CSS_FONTS[font],
                fontWeight: bold ? 700 : 400,
                color: inkColor,
                minWidth: Math.max(fontSize * scale * 6, 130),
              }}
              className="absolute z-10 border-2 border-red bg-white/90 leading-tight outline-none"
            />
          )}
        </div>
      </div>

      {badCharacters.length > 0 && (
        <p role="alert" className="border-l-2 border-rule-strong pl-3 text-sm text-black">
          The built-in PDF fonts can&rsquo;t write {badCharacters.map((c) => `"${c}"`).join(", ")}. Latin letters, digits and
          punctuation only — no Greek, Cyrillic, CJK or emoji.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button onClick={save} disabled={status === "saving" || (annotations.length === 0 && !textDraft?.value.trim())}>
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
