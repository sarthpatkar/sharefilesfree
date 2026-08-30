"use client";

import { useEffect, useState } from "react";

/**
 * The handoff, drawn as a picture that actually teaches.
 *
 * Takes a `step` so it plays the three-step explanation rather than looping
 * regardless of what's being read:
 *   0 — the file is sitting on your machine, wire dark, phone asleep
 *   1 — the code is up on the other screen, wire waking
 *   2 — the file crosses and lands
 *
 * With no step passed it runs the full loop, which is how the hero used it.
 *
 * Tonal depth comes from the lime ladder rather than from shading — six steps
 * of the same hue read as light and shadow without introducing a colour that
 * isn't in the palette.
 */

const ARC = "M 196 158 C 280 96, 360 96, 444 158";

const CODES = ["481 902", "137 546", "620 318", "905 274"];

export function TransferAnimation({ step }: { step?: 0 | 1 | 2 }) {
  const [codeIndex, setCodeIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCodeIndex((i) => (i + 1) % CODES.length), 2600);
    return () => clearInterval(id);
  }, []);

  const loop = step === undefined;
  const awake = loop || step >= 1;
  const crossing = loop || step === 2;
  const held = loop || step === 0;

  return (
    <svg
      viewBox="0 0 640 340"
      fill="none"
      className="w-full overflow-visible"
      role="img"
      aria-label="A file crossing directly from a laptop to a phone, with no server in between"
    >
      {/* Field, with a second lighter plate behind the devices for depth. */}
      <rect x="0" y="16" width="640" height="292" fill="var(--lime-5)" />
      <rect x="0" y="16" width="640" height="120" fill="var(--lime-4)" />

      {/* ---------- The wire ---------- */}
      <path
        d={ARC}
        stroke="var(--lime-2)"
        strokeWidth="14"
        strokeLinecap="round"
        style={{ opacity: awake ? 1 : 0.45, transition: "opacity .45s ease" }}
      />
      <path
        d={ARC}
        stroke="var(--red)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 14"
        style={{ opacity: crossing ? 1 : 0.3, transition: "opacity .45s ease" }}
      />

      {/* ---------- The file, crossing ---------- */}
      {crossing &&
        [
          { delay: "0s", fill: "var(--pink)" },
          { delay: "1.15s", fill: "var(--y-max)" },
          { delay: "2.3s", fill: "var(--lime-max)" },
        ].map((packet, i) => (
          <g key={i} className="sff-packet" style={{ offsetPath: `path("${ARC}")`, animationDelay: packet.delay, animationDuration: "3.4s" }}>
            <rect x="-15" y="-19" width="30" height="38" fill={packet.fill} stroke="var(--red)" strokeWidth="4" />
            <path d="M 3 -19 v 9 h 9" stroke="var(--red)" strokeWidth="4" fill="none" strokeLinejoin="round" />
            <path d="M -7 0 h 12 M -7 8 h 12" stroke="var(--red)" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        ))}

      {/* ---------- Laptop ---------- */}
      <g>
        <rect x="34" y="112" width="168" height="106" fill="var(--red)" />
        <rect x="28" y="106" width="168" height="106" fill="var(--lime-pale)" stroke="var(--red)" strokeWidth="5" />
        <path d="M 8 218 h 208 l -10 14 H 18 z" fill="var(--lime-3)" stroke="var(--red)" strokeWidth="5" strokeLinejoin="round" />

        {/* Screen contents: a file card that stays put until it's sent. */}
        <g style={{ opacity: held ? 1 : 0.3, transition: "opacity .5s ease" }}>
          <rect x="46" y="126" width="60" height="10" fill="var(--lime-2)" />
          <rect x="46" y="148" width="132" height="42" fill="var(--y-max)" stroke="var(--red)" strokeWidth="4" />
          <rect x="58" y="158" width="20" height="22" fill="var(--pink)" />
          <rect x="86" y="162" width="78" height="7" fill="var(--red)" />
          <rect x="86" y="174" width="52" height="7" fill="var(--lime-2)" />
        </g>

        {/* Sent-progress rail. */}
        <rect x="46" y="198" width="132" height="8" fill="var(--lime-3)" />
        <rect x="46" y="198" height="8" fill="var(--red)" width={crossing ? 132 : 20} style={{ transition: "width .6s ease" }} />
      </g>

      {/* ---------- Phone ---------- */}
      <g>
        <rect x="468" y="86" width="96" height="176" fill="var(--red)" />
        <rect x="462" y="80" width="96" height="176" fill="var(--lime-pale)" stroke="var(--red)" strokeWidth="5" />
        <rect x="494" y="92" width="32" height="7" fill="var(--red)" />

        {/* Asleep until the code is shared. */}
        <g style={{ opacity: awake ? 0 : 1, transition: "opacity .4s ease" }}>
          <rect x="478" y="150" width="64" height="8" fill="var(--lime-3)" />
          <rect x="490" y="166" width="40" height="8" fill="var(--lime-3)" />
        </g>

        <g style={{ opacity: awake ? 1 : 0, transition: "opacity .45s ease" }}>
          <rect x="476" y="120" width="68" height="34" fill="var(--y-max)" stroke="var(--red)" strokeWidth="4" />
          <text x="510" y="144" textAnchor="middle" className="font-display" fill="var(--red)" fontSize="17" letterSpacing="0.5">
            {CODES[codeIndex]}
          </text>
          <rect x="480" y="166" width="60" height="8" fill="var(--pink)" />
          <rect x="488" y="182" width="44" height="8" fill="var(--lime-2)" />
        </g>

        {/* Landed. */}
        <g style={{ opacity: crossing ? 1 : 0, transition: "opacity .45s ease .2s" }}>
          <rect x="478" y="204" width="64" height="38" fill="var(--lime-max)" stroke="var(--red)" strokeWidth="4" />
          <path d="m 492 224 7 7 13 -15" stroke="var(--red)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </g>

      {/* ---------- Nothing in the middle ---------- */}
      <g transform="translate(320 286)">
        <rect x="-104" y="-19" width="208" height="38" fill="var(--red)" />
        <text x="0" y="7" textAnchor="middle" className="font-display" fill="var(--lime-max)" fontSize="15" letterSpacing="0.6">
          NO SERVER IN BETWEEN
        </text>
      </g>
    </svg>
  );
}
