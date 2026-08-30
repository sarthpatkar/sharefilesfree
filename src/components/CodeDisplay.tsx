"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { IconCheck, IconLink } from "./icons";

/**
 * The sender's room code, as the loudest thing on the screen — someone is
 * reading these six digits aloud across a room, so they get display-scale
 * type in separated cells rather than a line of small text in a card.
 */
export function CodeDisplay({ code }: { code: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/receive?code=${code}` : "";

  useEffect(() => {
    let cancelled = false;
    // Flat two-colour QR — no gradients anywhere, this one included.
    QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: "#d50000", light: "#ffff17" } }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-red">
        Share this code with the receiver
      </p>

      {/* Six ruled cells — reads as a code to be transcribed, not as a label. */}
      <div className="flex" role="text" aria-label={`Code ${code.split("").join(" ")}`}>
        {code.split("").map((digit, i) => (
          <span
            key={i}
            className="flex h-[68px] w-[46px] items-center justify-center border-b-2 border-l border-ink font-display text-4xl font-bold tabular-nums text-red last:border-r sm:h-20 sm:w-14 sm:text-5xl"
          >
            {digit}
          </span>
        ))}
      </div>

      {qrDataUrl && (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code linking to ${link}`} width={132} height={132} className="border border-rule" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-red">or scan</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
        className="link inline-flex items-center gap-2 py-1 text-sm font-medium text-red"
      >
        {copied ? <IconCheck className="h-4 w-4 text-accent" /> : <IconLink className="h-4 w-4" />}
        {copied ? "Link copied" : "Copy shareable link"}
      </button>
    </div>
  );
}
