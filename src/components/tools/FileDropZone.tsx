"use client";

import { useState, type DragEvent } from "react";
import { IconUpload } from "../icons";

/**
 * A solid colour field rather than a dashed outline — the block itself is the
 * target. While a file is dragged over it the field flips to red so the hit
 * area is unmistakable; that's drag feedback, not a hover tint.
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
      className={`sff-nudge sff-block flex cursor-pointer flex-col items-center justify-center gap-2 px-6 py-14 text-center ${
        dragging ? "bg-red" : "bg-y-max"
      }`}
    >
      <IconUpload className={`h-7 w-7 ${dragging ? "text-lime" : "text-black"}`} />
      <span className={`text-[17px] font-bold leading-tight tracking-[-0.01em] ${dragging ? "text-yellow" : "text-black"}`}>
        {dragging ? "Let go" : label}
      </span>
      {hint && <span className={`text-[14px] font-semibold ${dragging ? "text-lime" : "text-black"}`}>{hint}</span>}
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
