// One hex-to-RGB parser for the pdf-lib tools.
//
// Written out separately because three of them had grown their own identical
// copy. Every tool that lets somebody pick a colour ends up needing this, and a
// forgiving parser matters here: the value arrives from an <input type="color">
// in most cases but from a text field in some, so "#D50000", "d50000" and a
// stray leading space all have to land on the same colour rather than throwing
// halfway through writing a document.
import { rgb, type RGB } from "pdf-lib";

/** Parses `#rrggbb` (with or without the hash, any case). Anything unparseable falls back to mid grey rather than failing a save. */
export function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return rgb(0.5, 0.5, 0.5);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return rgb(r, g, b);
}
