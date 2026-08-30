"use client";

import { useEffect, useState } from "react";

/**
 * The hero's signature illustration: two devices with encrypted packets
 * travelling directly between them, which is literally what the product does.
 *
 * Flat strokes and solid fills only — no <linearGradient>/<radialGradient>,
 * per the site-wide ban. Depth comes from line weight and a hard offset
 * shadow instead, which also matches the print-like feel of the rest of the
 * page better than a soft glow would.
 *
 * The packets ride the *same* path strings the visible arcs are drawn from
 * (ARC_TOP / ARC_BOTTOM), via CSS `offset-path`, so a dot can never drift off
 * the line it is meant to be following.
 */

const ARC_TOP = "M 214 150 C 286 84, 356 84, 424 146";
const ARC_BOTTOM = "M 214 176 C 286 244, 356 244, 424 182";

/** Digits cycle through plausible codes so the phone screen feels live. */
const CODES = ["481 902", "137 546", "620 318", "905 274"];

export function TransferAnimation() {
  const [codeIndex, setCodeIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCodeIndex((i) => (i + 1) % CODES.length), 3400);
    return () => clearInterval(id);
  }, []);

  return (
    <svg
      viewBox="0 0 600 300"
      fill="none"
      className="w-full overflow-visible"
      role="img"
      aria-label="Illustration: a file transferring directly from a laptop to a phone, encrypted end to end, with no server in between"
    >
      {/* ---------- Connection arcs ---------- */}
      <path d={ARC_TOP} stroke="var(--rule-strong)" strokeWidth="1.25" />
      <path d={ARC_BOTTOM} stroke="var(--rule-strong)" strokeWidth="1.25" />
      <path d={ARC_TOP} stroke="var(--accent)" strokeWidth="1.5" className="sff-dash" />
      <path
        d={ARC_BOTTOM}
        stroke="var(--accent)"
        strokeWidth="1.5"
        className="sff-dash"
        style={{ animationDirection: "reverse" }}
      />

      {/* ---------- Travelling packets ---------- */}
      {[
        { path: ARC_TOP, delay: "0s", dur: "3.4s" },
        { path: ARC_TOP, delay: "1.7s", dur: "3.4s" },
        { path: ARC_BOTTOM, delay: "0.85s", dur: "3.8s" },
        { path: ARC_BOTTOM, delay: "2.55s", dur: "3.8s" },
      ].map((packet, i) => (
        <g
          key={i}
          className="sff-packet"
          style={{ offsetPath: `path("${packet.path}")`, animationDelay: packet.delay, animationDuration: packet.dur }}
        >
          <rect x="-8" y="-10" width="16" height="20" fill="var(--paper)" stroke="var(--accent)" strokeWidth="1.5" />
          <path d="M -4 -2 h 8 M -4 3 h 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="square" />
        </g>
      ))}

      {/* ---------- Left: laptop ---------- */}
      <g>
        {/* Hard offset shadow, drawn as a plain filled rect behind the body. */}
        <rect x="65" y="113" width="136" height="86" fill="var(--accent)" opacity="0.14" />
        <rect x="60" y="108" width="136" height="86" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
        <path
          d="M 42 200 h 172 l -6 8 H 48 z"
          fill="var(--paper)"
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Screen contents: a file row and a live progress bar */}
        <rect x="74" y="122" width="32" height="6" fill="var(--ink-soft)" opacity="0.35" />
        <rect x="74" y="140" width="108" height="26" fill="var(--accent)" opacity="0.1" />
        <rect x="82" y="147" width="13" height="12" stroke="var(--accent)" strokeWidth="1.4" />
        <rect x="103" y="151" width="50" height="5" fill="var(--accent)" opacity="0.55" />
        <rect x="74" y="176" width="108" height="4" fill="var(--rule-strong)" />
        <rect x="74" y="176" height="4" fill="var(--accent)">
          <animate
            attributeName="width"
            values="14;96;14"
            dur="4.2s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
          />
        </rect>
      </g>

      {/* ---------- Right: phone ---------- */}
      <g>
        <rect x="441" y="101" width="70" height="136" fill="var(--accent)" opacity="0.14" />
        <rect x="436" y="96" width="70" height="136" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
        <path d="M 460 106 h 22" stroke="var(--ink)" strokeWidth="2" strokeLinecap="square" opacity="0.5" />

        {/* The 6-digit pairing code, cycling */}
        <text
          x="471"
          y="151"
          textAnchor="middle"
          className="font-mono"
          fill="var(--accent)"
          fontSize="15"
          fontWeight="600"
          letterSpacing="0.5"
        >
          {CODES[codeIndex]}
        </text>
        <rect x="450" y="163" width="42" height="4" fill="var(--rule-strong)" />
        <rect x="456" y="175" width="30" height="4" fill="var(--rule-strong)" opacity="0.7" />

        {/* Received-file chip, timed to the packet cadence */}
        <g opacity="0">
          <rect x="448" y="192" width="46" height="24" fill="var(--accent)" opacity="0.14" />
          <path
            d="m 459 204 3.5 3.5 6.5 -7.5"
            stroke="var(--accent)"
            strokeWidth="1.75"
            strokeLinecap="square"
            strokeLinejoin="miter"
            fill="none"
          />
          <rect x="474" y="201" width="12" height="5" fill="var(--accent)" opacity="0.6" />
          <animate
            attributeName="opacity"
            values="0;0;1;1;0"
            dur="3.4s"
            repeatCount="indefinite"
            keyTimes="0;0.55;0.72;0.92;1"
          />
        </g>
      </g>

      {/* ---------- Encryption badge on the wire ----------
           A square-cornered tag, not a capsule. */}
      <g transform="translate(300 162)">
        <rect x="-33" y="-13" width="66" height="26" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
        <rect x="-19" y="-5" width="10" height="8" stroke="var(--accent)" strokeWidth="1.4" fill="none" />
        <path d="M -16.5 -5 v -2.5 a 2.5 2.5 0 0 1 5 0 V -5" stroke="var(--accent)" strokeWidth="1.4" fill="none" />
        <text
          x="7"
          y="4"
          textAnchor="middle"
          className="font-mono"
          fill="var(--ink)"
          fontSize="9"
          fontWeight="600"
          letterSpacing="1"
        >
          E2E
        </text>
      </g>

      {/* ---------- "no server in between" marker ----------
           Sits at y=268: the lower arc bottoms out near y=228 and its packets
           extend ~10px past that, so anything higher collides. */}
      <g transform="translate(300 268)">
        <path
          d="M -20 6 h 36 a 9 9 0 0 0 -2.4 -17.7 a 12 12 0 0 0 -22.6 3 a 9 9 0 0 0 -11 14.7 z"
          stroke="var(--ink-soft)"
          strokeWidth="1.4"
          fill="none"
          strokeLinejoin="round"
          opacity="0.6"
        />
        <path d="M -25 11 L 15 -19" stroke="var(--danger)" strokeWidth="1.75" strokeLinecap="square" />
        <text
          x="0"
          y="26"
          textAnchor="middle"
          className="font-mono"
          fill="var(--ink-soft)"
          fontSize="8.5"
          letterSpacing="1.6"
        >
          NO SERVER IN BETWEEN
        </text>
      </g>
    </svg>
  );
}
