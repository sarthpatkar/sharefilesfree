"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { IconCheck, IconLink } from "./icons";

/** Shows a shareable download link (for the "receiver isn't online" fallback), with a QR code and copy button. */
export function LinkShare({ token, expiresAt }: { token: string; expiresAt: number }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);

  const link = typeof window !== "undefined" ? `${window.location.origin}/download/${token}` : "";

  useEffect(() => {
    const timer = setTimeout(() => setHoursLeft(Math.max(1, Math.round((expiresAt - Date.now()) / (60 * 60 * 1000)))), 0);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 1, width: 200, color: { dark: "#0b6e4f", light: "#faf8f3" } }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-6 text-center">
      <p className="text-sm text-muted">Share this link — it works anytime, no code needed</p>
      <p className="max-w-full truncate font-mono text-sm text-accent">{link}</p>
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
        {copied ? "Link copied!" : "Copy link"}
      </button>
      {hoursLeft !== null && (
        <p className="text-xs text-muted">Expires in about {hoursLeft}h, or after being deleted for privacy.</p>
      )}
    </div>
  );
}
