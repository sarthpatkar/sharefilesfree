"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Button } from "../Button";
import { ToolResultCard } from "./ToolResultCard";

export function QrCodeTool({ onSend }: { onSend?: (file: File) => void }) {
  const [text, setText] = useState("");
  const [size, setSize] = useState(500);
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!text.trim()) {
      setError("Enter some text or a URL.");
      return;
    }
    setError(null);
    try {
      const dataUrl = await QRCode.toDataURL(text, { width: size, margin: 2, color: { dark: "#0b6e4f", light: "#ffffff" } });
      // data: URLs (unlike blob: URLs) are safely fetchable to get real bytes back.
      const blob = await fetch(dataUrl).then((r) => r.blob());
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
          className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Size ({size}px)
        <input type="range" min={200} max={1000} step={50} value={size} onChange={(e) => setSize(Number(e.target.value))} className="accent-accent" />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={generate} className="self-start">
        Generate QR code
      </Button>
    </div>
  );
}
