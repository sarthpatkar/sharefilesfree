"use client";

import { useEffect, useState } from "react";

/**
 * The hero's signature illustration: two devices with encrypted packets
 * travelling directly between them, which is literally what the product does.
 *
 * Built as one inline SVG rather than a canvas or a Lottie file — it stays
 * crisp at any size, inherits the theme's currentColor tokens (so it works in
 * dark mode for free), weighs nothing, and needs no runtime.
 *
 * The packets ride the *same* path strings the visible arcs are drawn from
 * (ARC_TOP / ARC_BOTTOM below), via CSS `offset-path`, so the dots can never
 * drift off the line they're supposed to be following.
 */

const ARC_TOP = "M 214 150 C 286 84, 356 84, 424 146";
const ARC_BOTTOM = "M 214 176 C 286 244, 356 244, 424 182";

/** Digits cycle through a few plausible codes so the phone screen feels live. */
const CODES = ["481 902", "137 546", "620 318", "905 274"];

export function TransferAnimation() {
  const [codeIndex, setCodeIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCodeIndex((i) => (i + 1) % CODES.length), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 600 300"
        fill="none"
        className="w-full overflow-visible"
        role="img"
        aria-label="Illustration: a file transferring directly from a laptop to a phone, encrypted end to end"
      >
        <defs>
          <linearGradient id="sff-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="sff-halo">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft halo behind the whole scene */}
        <ellipse cx="300" cy="160" rx="250" ry="120" fill="url(#sff-halo)" />

        {/* ---------- Connection arcs ---------- */}
        <path d={ARC_TOP} stroke="url(#sff-arc)" strokeWidth="1.5" />
        <path d={ARC_BOTTOM} stroke="url(#sff-arc)" strokeWidth="1.5" />
        <path d={ARC_TOP} stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.5" className="sff-dash" />
        <path d={ARC_BOTTOM} stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.5" className="sff-dash" style={{ animationDirection: "reverse" }} />

        {/* ---------- Travelling packets ---------- */}
        {[
          { path: ARC_TOP, delay: "0s", dur: "3.2s" },
          { path: ARC_TOP, delay: "1.6s", dur: "3.2s" },
          { path: ARC_BOTTOM, delay: "0.8s", dur: "3.6s" },
          { path: ARC_BOTTOM, delay: "2.4s", dur: "3.6s" },
        ].map((packet, i) => (
          <g
            key={i}
            className="sff-packet"
            style={{ offsetPath: `path("${packet.path}")`, animationDelay: packet.delay, animationDuration: packet.dur }}
          >
            <rect x="-9" y="-11" width="18" height="22" rx="3" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.5" />
            <path d="M 3 -11 v 5 h 5" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
            <path d="M -4 -1 h 8 M -4 4 h 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          </g>
        ))}

        {/* ---------- Left: laptop ---------- */}
        <g>
          <circle cx="128" cy="158" r="52" fill="var(--accent)" opacity="0.07" className="sff-pulse-ring" style={{ transformOrigin: "128px 158px" }} />
          <rect x="60" y="108" width="136" height="86" rx="7" fill="var(--card)" stroke="currentColor" strokeWidth="1.75" strokeOpacity="0.55" />
          <path d="M 44 200 h 168 a 6 6 0 0 1 -6 6 H 50 a 6 6 0 0 1 -6 -6 z" fill="var(--card)" stroke="currentColor" strokeWidth="1.75" strokeOpacity="0.55" strokeLinejoin="round" />

          {/* Screen contents: a file row and a live-looking progress bar */}
          <rect x="74" y="122" width="34" height="8" rx="4" fill="var(--muted)" opacity="0.28" />
          <rect x="74" y="140" width="108" height="26" rx="5" fill="var(--accent)" opacity="0.08" />
          <rect x="82" y="148" width="14" height="10" rx="2" stroke="var(--accent)" strokeWidth="1.4" />
          <rect x="104" y="150" width="48" height="6" rx="3" fill="var(--accent)" opacity="0.5" />
          <rect x="74" y="176" width="108" height="5" rx="2.5" fill="var(--muted)" opacity="0.18" />
          <rect x="74" y="176" width="72" height="5" rx="2.5" fill="var(--accent)">
            <animate attributeName="width" values="18;92;18" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
          </rect>
        </g>

        {/* ---------- Right: phone ---------- */}
        <g>
          <circle cx="470" cy="164" r="46" fill="var(--accent)" opacity="0.07" className="sff-pulse-ring" style={{ transformOrigin: "470px 164px", animationDelay: "1.4s" }} />
          <rect x="436" y="96" width="70" height="136" rx="13" fill="var(--card)" stroke="currentColor" strokeWidth="1.75" strokeOpacity="0.55" />
          <path d="M 460 104 h 22" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.4" strokeLinecap="round" />

          {/* The 6-digit pairing code, cycling */}
          <text
            x="471"
            y="150"
            textAnchor="middle"
            className="font-mono"
            fill="var(--accent)"
            fontSize="15"
            fontWeight="600"
            letterSpacing="0.5"
          >
            {CODES[codeIndex]}
          </text>
          <rect x="450" y="162" width="42" height="4" rx="2" fill="var(--muted)" opacity="0.2" />
          <rect x="456" y="174" width="30" height="4" rx="2" fill="var(--muted)" opacity="0.14" />

          {/* Received-file chip that fades in and out with the packet cadence */}
          <g opacity="0">
            <rect x="448" y="192" width="46" height="24" rx="5" fill="var(--accent)" opacity="0.12" />
            <path d="m 460 204 3.5 3.5 6 -7" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <rect x="474" y="201" width="12" height="5" rx="2.5" fill="var(--accent)" opacity="0.55" />
            <animate attributeName="opacity" values="0;0;1;1;0" dur="3.2s" repeatCount="indefinite" keyTimes="0;0.55;0.72;0.92;1" />
          </g>
        </g>

        {/* ---------- Encryption badge on the wire ---------- */}
        <g transform="translate(300 162)">
          <rect x="-34" y="-14" width="68" height="28" rx="14" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.4" strokeOpacity="0.45" />
          <rect x="-19" y="-5" width="11" height="9" rx="2" stroke="var(--accent)" strokeWidth="1.4" fill="none" />
          <path d="M -16.5 -5 v -2.5 a 3 3 0 0 1 6 0 V -5" stroke="var(--accent)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <text x="6" y="4" textAnchor="middle" className="font-mono" fill="var(--accent)" fontSize="9" fontWeight="600" letterSpacing="0.5">
            E2E
          </text>
        </g>

        {/* ---------- "no server" marker: a crossed-out cloud below the wire ----------
             Sits at y=268 deliberately: the lower arc bottoms out around y=228 and
             its packets extend ~11px past that, so anything higher collides. */}
        <g opacity="0.45" transform="translate(300 268)">
          <path
            d="M -20 6 a 9 9 0 0 1 1.5 -17.8 a 12 12 0 0 1 22.6 -3 a 9 9 0 0 1 2.4 17.7 z"
            stroke="var(--muted)"
            strokeWidth="1.5"
            fill="none"
            strokeLinejoin="round"
          />
          <path d="M -24 10 L 14 -18" stroke="var(--danger)" strokeWidth="1.75" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
