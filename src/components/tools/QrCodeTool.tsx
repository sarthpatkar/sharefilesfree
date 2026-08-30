"use client";

import { useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "../Button";
import { ToolResultCard } from "./ToolResultCard";

type ErrorCorrection = "L" | "M" | "Q" | "H";

const ERROR_CORRECTION_INFO: Record<ErrorCorrection, string> = {
  L: "Low (~7% recovery) — smallest, cleanest code",
  M: "Medium (~15% recovery) — good default",
  Q: "Quartile (~25% recovery) — sturdier against damage",
  H: "High (~30% recovery) — best if you're adding a logo",
};

/**
 * Draws the QR code onto a canvas, then (if a logo was supplied) composites
 * the logo in the center with a white padded backing so scanners don't choke
 * on it. High error-correction is recommended alongside a logo since it
 * intentionally covers real QR modules — that's why the recovery level is
 * exposed as a real user-facing setting rather than hardcoded.
 */
async function renderQrPng(opts: {
  text: string;
  size: number;
  dark: string;
  light: string;
  margin: number;
  errorCorrectionLevel: ErrorCorrection;
  logoDataUrl: string | null;
}): Promise<Blob> {
  const dataUrl = await QRCode.toDataURL(opts.text, {
    width: opts.size,
    margin: opts.margin,
    errorCorrectionLevel: opts.errorCorrectionLevel,
    color: { dark: opts.dark, light: opts.light },
  });

  if (!opts.logoDataUrl) {
    return await fetch(dataUrl).then((r) => r.blob());
  }

  const [qrImg, logoImg] = await Promise.all([loadImage(dataUrl), loadImage(opts.logoDataUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = opts.size;
  canvas.height = opts.size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.drawImage(qrImg, 0, 0, opts.size, opts.size);

  // Logo occupies ~22% of the code's width — small enough that, combined
  // with high error correction, the code still reliably scans.
  const logoSize = Math.round(opts.size * 0.22);
  const pad = Math.round(logoSize * 0.16);
  const cx = (opts.size - logoSize) / 2;
  const cy = (opts.size - logoSize) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - pad, cy - pad, logoSize + pad * 2, logoSize + pad * 2);
  ctx.drawImage(logoImg, cx, cy, logoSize, logoSize);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render the QR code."))), "image/png"),
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the logo image."));
    img.src = src;
  });
}

export function QrCodeTool({ onSend }: { onSend?: (file: File) => void }) {
  const [text, setText] = useState("");
  const [size, setSize] = useState(500);
  const [dark, setDark] = useState("#d50000");
  const [light, setLight] = useState("#ffffff");
  const [margin, setMargin] = useState(2);
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<ErrorCorrection>("M");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  function onLogoPicked(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(reader.result as string);
      // A logo eats into the code's error-correction budget — bump it up
      // automatically unless the user already chose High.
      setErrorCorrectionLevel((prev) => (prev === "H" ? prev : "Q"));
    };
    reader.readAsDataURL(f);
  }

  async function generate() {
    if (!text.trim()) {
      setError("Enter some text or a URL.");
      return;
    }
    setError(null);
    try {
      const blob = await renderQrPng({ text, size, dark, light, margin, errorCorrectionLevel, logoDataUrl });
      setResult(new File([blob], "qrcode.png", { type: "image/png" }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  if (result) {
    return <ToolResultCard file={result} onSend={onSend} onReset={reset} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Text or URL
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://example.com"
          className="border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Size ({size}px)
        <input type="range" min={200} max={1000} step={50} value={size} onChange={(e) => setSize(Number(e.target.value))} className="accent-accent" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Code color
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={dark}
              onChange={(e) => setDark(e.target.value)}
              className="h-9 w-9 cursor-pointer border border-border bg-transparent p-0.5"
              aria-label="Code color"
            />
            <input
              value={dark}
              onChange={(e) => setDark(e.target.value)}
              className="w-full border border-border bg-transparent px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-accent"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Background color
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={light}
              onChange={(e) => setLight(e.target.value)}
              className="h-9 w-9 cursor-pointer border border-border bg-transparent p-0.5"
              aria-label="Background color"
            />
            <input
              value={light}
              onChange={(e) => setLight(e.target.value)}
              className="w-full border border-border bg-transparent px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-accent"
            />
          </div>
        </label>
      </div>

      {/* Low contrast between the two colors makes a code unscannable — warn rather than silently produce a dud. */}
      {colorsTooClose(dark, light) && (
        <p className="text-xs text-danger">These colors are too close in contrast — the code may not scan. Try a darker foreground or lighter background.</p>
      )}

      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Quiet-zone margin ({margin} modules)
        <input type="range" min={0} max={8} step={1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="accent-accent" />
      </label>

      <fieldset className="flex flex-col gap-1.5 text-sm text-muted">
        <legend className="mb-0.5">Error correction</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ERROR_CORRECTION_INFO) as ErrorCorrection[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setErrorCorrectionLevel(level)}
              className={`border px-3 py-1.5 text-sm transition ${
                errorCorrectionLevel === level
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-foreground hover:border-accent/50"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{ERROR_CORRECTION_INFO[errorCorrectionLevel]}</p>
      </fieldset>

      <div className="flex flex-col gap-1.5 text-sm text-muted">
        <span>Center logo (optional)</span>
        <div className="flex items-center gap-3">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => onLogoPicked(e.target.files?.[0])}
            className="hidden"
          />
          <Button variant="ghost" type="button" onClick={() => logoInputRef.current?.click()}>
            {logoDataUrl ? "Change logo" : "Add a logo"}
          </Button>
          {logoDataUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- small local preview of a user-picked file, not a page asset */}
              <img src={logoDataUrl} alt="Logo preview" className="h-8 w-8 object-contain" />
              <button type="button" onClick={() => setLogoDataUrl(null)} className="text-xs text-muted hover:underline">
                Remove
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-muted">Your logo never leaves this device — it&apos;s added to the image right here.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button onClick={generate} className="self-start">
        Generate QR code
      </Button>
    </div>
  );
}

/** Rough perceived-brightness contrast check — not WCAG-precise, just enough to catch obviously unscannable combinations. */
function colorsTooClose(a: string, b: string): boolean {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return false;
  return Math.abs(la - lb) < 0.25;
}

function luminance(hex: string): number | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
