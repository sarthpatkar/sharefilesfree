"use client";

import { useState, type DragEvent } from "react";
import { IconUpload } from "../icons";

/**
 * The one bounded box we allow — and it's the drop target, so the border is
 * doing real affordance work rather than decorating a card. Corner ticks
 * instead of a soft outline; the whole thing inverts to solid ink while a
 * file is dragged over it, which reads instantly on any screen.
 */
export function FileDropZone({
  onFiles,
  accept,
  multiple = true,
  label,
  hint,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label: string;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-6 py-14 text-center transition-colors duration-200 ${
        dragging ? "border-accent bg-ink text-paper" : "border-rule-strong hover:border-accent hover:bg-accent/[0.04]"
      }`}
    >
      {/* Corner ticks — a drafting-mark device rather than a soft outline. */}
      {[
        "left-0 top-0 border-l border-t",
        "right-0 top-0 border-r border-t",
        "left-0 bottom-0 border-l border-b",
        "right-0 bottom-0 border-r border-b",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`pointer-events-none absolute h-3 w-3 border-accent transition-opacity duration-200 ${pos} ${
            dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      ))}

      <IconUpload
        className={`h-6 w-6 transition-transform duration-300 group-hover:-translate-y-0.5 ${
          dragging ? "text-paper" : "text-ink-soft group-hover:text-accent"
        }`}
      />
      <span className="font-display text-lg font-bold tracking-[-0.015em]">{label}</span>
      {hint && <span className={`text-sm ${dragging ? "text-paper/80" : "text-ink-soft"}`}>{hint}</span>}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
      />
    </label>
  );
}
