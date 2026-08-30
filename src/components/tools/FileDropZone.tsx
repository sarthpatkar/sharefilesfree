"use client";

import { IconUpload } from "../icons";

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
  return (
    <label
      className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center transition hover:border-accent hover:bg-accent/[.04]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <IconUpload className="h-6 w-6 text-muted transition group-hover:text-accent" />
      <span className="font-medium text-foreground">{label}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
      <input type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))} />
    </label>
  );
}
