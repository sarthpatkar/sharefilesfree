"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { IconCheck, IconLink } from "./icons";

/**
 * The sender's room code, as the loudest thing on the screen — someone is
 * reading these six digits aloud across a room, so they get display-scale
 * type in separated cells rather than a line of small text in a card.
 */
export function CodeDisplay({
  code,
  expiresAt,
  secret,
  group = false,
}: {
  code: string;
  expiresAt?: number | null;
  /** Present for long-lived rooms, which cannot be joined by code alone. */
  secret?: string | null;
  /**
   * A group share rather than a one-to-one transfer. Only the wording changes:
   * a group code is six characters rather than six digits, and it is being read
   * to a room rather than to one person.
   */
  group?: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The code goes in the fragment, not a query string. A fragment is never put
  // on the wire — it doesn't reach our server, Caddy's access log, or
  // Cloudflare's edge, and it isn't sent in a Referer header if the receiver
  // clicks an outbound link. As ?code= it was written to every one of those.
  //
  // For a long-lived room the fragment carries the room secret as well, which is
  // what makes that room safe to leave open for hours: the six or eight digits
  // alone are guessable by anyone willing to spend attempts, and the number of
  // open rooms — hence the number of winning guesses — grows with the site. The
  // fragment is the right place for it for the reason above: it is the only part
  // of a URL that never reaches a server or a log.
  const fragment = secret ? `${code}.${secret}` : code;
  const link = typeof window !== "undefined" ? `${window.location.origin}/receive#${fragment}` : "";

  useEffect(() => {
    let cancelled = false;
    // Flat two-colour QR — no gradients anywhere, this one included.
    QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: "#d50000", light: "#faf8f4" } }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">
          {secret
            ? "Send the link or the QR"
            : group
              ? "Read this out to the room, or share the link"
              : "Read this out, or send the link"}
        </p>
        {/* The failure mode nobody expects the first time: the file travels
            between the two browsers, so closing this page stops the transfer
            the way unplugging a cable would. Worth saying before it happens. */}
        <p className="max-w-xs text-center text-[13px] font-medium leading-[1.5] text-black opacity-55">
          {secret
            ? group
              ? "There is nothing to read out for a share left open this long — it has to be harder to guess than six characters, so it travels as a link or a QR."
              : "There are no digits to read out for a code this long-lived — it has to be harder to guess than six numbers, so it travels as a link."
            : group
              ? "Everyone types it in at sharefilesfree.com, or scans the code below."
              : "They type it in at sharefilesfree.com."}{" "}
          Leave this page open until {group ? "every device has the file" : "the transfer finishes"} — the file goes
          from here to them, so closing it stops it.
          {expiresAt ? ` Works until ${new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : ""}
        </p>
      </div>

      {/* The digits are shown ONLY when they are usable on their own.

          A long-lived room needs its secret as well, and that secret only ever
          travels in the link. Rendering the code here anyway — in the same
          display-scale cells that mean "read this out" everywhere else on the
          site — was an invitation to do exactly the one thing that cannot work:
          somebody reads the eight digits down the phone, the other person types
          them, and gets "that code is invalid or has expired". Technically true
          and completely misleading, and the sender would have no idea why.

          So for those rooms the code stops being shown at all. It is a routing
          key inside the link now, not something a person handles. */}
      {!secret && (
        // Ruled cells — reads as a code to be transcribed, not as a label.
        <div className="flex" role="text" aria-label={`Code ${code.split("").join(" ")}`}>
          {code.split("").map((digit, i) => (
            <span
              key={i}
              className={`flex h-[68px] w-[46px] items-center justify-center border-b-2 border-l border-ink text-[2rem] font-bold text-black last:border-r sm:h-20 sm:w-14 sm:text-[2.6rem] ${
                group ? "font-mono" : "tabular-nums"
              }`}
            >
              {digit}
            </span>
          ))}
        </div>
      )}

      {qrDataUrl && (
        <div className="flex flex-col items-center gap-2">
          {/* Bigger when it is the way in rather than an alternative to the
              digits — it should read as the thing to point a camera at. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR code linking to ${link}`}
            width={secret ? 184 : 132}
            height={secret ? 184 : 132}
            className="border border-rule"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-red">
            {secret ? "scan this" : "or scan"}
          </span>
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
        className={
          secret
            ? "sff-nudge inline-flex items-center gap-2 bg-red px-5 py-3 text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-y-pale"
            : "link inline-flex items-center gap-2 py-1 text-sm font-medium text-red"
        }
      >
        {copied ? <IconCheck className="h-4 w-4 text-accent" /> : <IconLink className="h-4 w-4" />}
        {copied ? "Link copied" : "Copy shareable link"}
      </button>
    </div>
  );
}
