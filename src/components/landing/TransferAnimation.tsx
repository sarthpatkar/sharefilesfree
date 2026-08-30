"use client";

import { useEffect, useState } from "react";

/**
 * The file crossing from one screen to the other, drawn in the full palette —
 * this is where hot pink and blush earn their place, as pure graphic on a
 * lime field. Flat fills only, no gradients, no outlines doing decorative
 * work.
 *
 * The packets ride the same path strings the visible arcs are drawn from, via
 * CSS offset-path, so a packet can never drift off its line.
 */

const ARC_TOP = "M 214 150 C 286 84, 356 84, 424 146";
const ARC_BOTTOM = "M 214 176 C 286 244, 356 244, 424 182";

const CODES = ["481 902", "137 546", "620 318", "905 274"];

export function TransferAnimation() {
  const [codeIndex, setCodeIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCodeIndex((i) => (i + 1) % CODES.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <svg
      viewBox="0 0 600 300"
      fill="none"
      className="w-full overflow-visible"
      role="img"
      aria-label="A file crossing directly from a laptop to a phone, with no server in between"
    >
      {/* Blush field behind the whole scene. */}
      <rect x="10" y="30" width="580" height="240" fill="var(--blush)" />

      {/* ---------- The two arcs ---------- */}
      <path d={ARC_TOP} stroke="var(--red)" strokeWidth="4" strokeLinecap="round" />
      <path d={ARC_BOTTOM} stroke="var(--red)" strokeWidth="4" strokeLinecap="round" />

      {/* ---------- Packets ---------- */}
      {[
        { path: ARC_TOP, delay: "0s", dur: "3s", fill: "var(--pink)" },
        { path: ARC_TOP, delay: "1.5s", dur: "3s", fill: "var(--yellow)" },
        { path: ARC_BOTTOM, delay: "0.75s", dur: "3.4s", fill: "var(--yellow)" },
        { path: ARC_BOTTOM, delay: "2.25s", dur: "3.4s", fill: "var(--pink)" },
      ].map((packet, i) => (
        <g
          key={i}
          className="sff-packet"
          style={{ offsetPath: `path("${packet.path}")`, animationDelay: packet.delay, animationDuration: packet.dur }}
        >
          <rect x="-11" y="-13" width="22" height="26" fill={packet.fill} stroke="var(--red)" strokeWidth="3" />
        </g>
      ))}

      {/* ---------- Laptop ---------- */}
      <g>
        <rect x="60" y="108" width="140" height="90" fill="var(--yellow)" stroke="var(--red)" strokeWidth="4" />
        <path d="M 40 202 h 180 l -8 12 H 48 z" fill="var(--lime)" stroke="var(--red)" strokeWidth="4" strokeLinejoin="round" />
        <rect x="76" y="124" width="46" height="9" fill="var(--pink)" />
        <rect x="76" y="144" width="108" height="30" fill="var(--lime)" />
        <rect x="86" y="152" width="16" height="14" fill="var(--pink)" />
        <rect x="110" y="156" width="60" height="7" fill="var(--red)" />
        <rect x="76" y="182" width="108" height="7" fill="var(--blush)" />
        <rect x="76" y="182" height="7" fill="var(--red)">
          <animate attributeName="width" values="16;98;16" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
        </rect>
      </g>

      {/* ---------- Phone ---------- */}
      <g>
        <rect x="436" y="92" width="76" height="146" fill="var(--yellow)" stroke="var(--red)" strokeWidth="4" />
        <rect x="462" y="102" width="24" height="6" fill="var(--red)" />
        <text
          x="474"
          y="152"
          textAnchor="middle"
          className="font-display"
          fill="var(--red)"
          fontSize="19"
          letterSpacing="0.5"
        >
          {CODES[codeIndex]}
        </text>
        <rect x="452" y="166" width="44" height="7" fill="var(--pink)" />
        <rect x="460" y="180" width="28" height="7" fill="var(--blush)" />
        <g opacity="0">
          <rect x="450" y="198" width="48" height="26" fill="var(--lime)" />
          <path d="m 461 211 5 5 9 -11" stroke="var(--red)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <animate attributeName="opacity" values="0;0;1;1;0" dur="3s" repeatCount="indefinite" keyTimes="0;0.55;0.72;0.92;1" />
        </g>
      </g>

      {/* ---------- Nothing in the middle ---------- */}
      <g transform="translate(300 258)">
        <rect x="-86" y="-16" width="172" height="32" fill="var(--red)" />
        <text x="0" y="6" textAnchor="middle" className="font-display" fill="var(--lime)" fontSize="14" letterSpacing="0.5">
          NO SERVER IN BETWEEN
        </text>
      </g>
    </svg>
  );
}
