"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Shows the sender's room code as big digits, a copyable link, and a QR code for scanning from another device. */
export function CodeDisplay({ code }: { code: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/receive?code=${code}` : "";

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 1, width: 200 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/10 bg-black/[.02] p-6 text-center dark:border-white/10 dark:bg-white/[.03]">
      <p className="text-sm text-black/60 dark:text-white/60">Share this code with the receiver</p>
      <p className="font-mono text-4xl font-semibold tracking-[0.3em]">{code}</p>
      {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt={`QR code for ${link}`} width={160} height={160} className="rounded-lg bg-white p-2" />
      )}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
      >
        {copied ? "Link copied!" : "Copy shareable link"}
      </button>
    </div>
  );
}
