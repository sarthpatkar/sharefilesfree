"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { IconCheck, IconLink } from "./icons";

/** Shows the sender's room code as big digits, a copyable link, and a QR code for scanning from another device. */
export function CodeDisplay({ code }: { code: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/receive?code=${code}` : "";

  useEffect(() => {
    let cancelled = false;
    // Branded QR (pine green on cream) instead of the library's default black-on-white.
    QRCode.toDataURL(link, { margin: 1, width: 200, color: { dark: "#0b6e4f", light: "#faf8f3" } }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-6 text-center">
      <p className="text-sm text-muted">Share this code with the receiver</p>
      <p className="font-display text-4xl font-medium tracking-[0.25em] text-foreground">{code}</p>
      {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt={`QR code for ${link}`} width={160} height={160} className="rounded-lg border border-border p-2" />
      )}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover hover:underline"
      >
        {copied ? <IconCheck className="h-4 w-4" /> : <IconLink className="h-4 w-4" />}
        {copied ? "Link copied!" : "Copy shareable link"}
      </button>
    </div>
  );
}
