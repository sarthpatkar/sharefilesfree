"use client";

import type { FormFieldInfo, NewField } from "@/lib/tools/editPdf";

/*
 * The fill-in-the-form half of Edit PDF.
 *
 * Filling a form through its real fields rather than by drawing text on top of
 * it is the whole point of this panel. Most "free PDF editors" do the latter:
 * the result looks right and is useless to whoever receives it, because the
 * values are paint rather than data, and they land where the eye guessed rather
 * than where the field is. Going through the fields keeps the answers editable,
 * keeps them machine-readable, and puts them exactly where they belong.
 */

const KIND_LABELS: Record<string, string> = {
  text: "Text",
  checkbox: "Tick box",
  dropdown: "Dropdown",
  radio: "Choice",
  other: "Unsupported",
};

export function FormFieldsPanel({
  fields,
  values,
  newFields,
  onChange,
  onLocate,
  onRemoveNew,
}: {
  fields: FormFieldInfo[];
  values: Record<string, string | boolean>;
  newFields: NewField[];
  onChange: (name: string, value: string | boolean) => void;
  onLocate: (page: number) => void;
  onRemoveNew: (id: string) => void;
}) {
  if (fields.length === 0 && newFields.length === 0) return null;

  return (
    <section className="flex flex-col">
      <h3 className="border-b-2 border-ink pb-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-red">
        Form fields · {fields.length + newFields.length}
      </h3>

      {fields.map((field) => {
        const current = values[field.name] ?? field.value;
        const place = field.places[0];
        return (
          <div key={field.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink/25 py-2 text-[13px]">
            <button
              type="button"
              onClick={() => place && onLocate(place.page)}
              disabled={!place}
              className="link min-w-0 flex-1 truncate text-left font-semibold text-red disabled:no-underline disabled:opacity-60"
              title={place ? `Go to page ${place.page}` : undefined}
            >
              {field.name}
            </button>
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-black/60">{KIND_LABELS[field.kind] ?? field.kind}</span>

            {field.kind === "checkbox" && (
              <input
                type="checkbox"
                aria-label={field.name}
                checked={Boolean(current)}
                onChange={(e) => onChange(field.name, e.target.checked)}
                className="h-5 w-5 accent-red"
              />
            )}

            {(field.kind === "dropdown" || field.kind === "radio") && (
              <select
                aria-label={field.name}
                value={String(current ?? "")}
                onChange={(e) => onChange(field.name, e.target.value)}
                className="border-2 border-ink bg-y-max px-2 py-1.5 font-semibold text-black"
              >
                <option value="">— not set —</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {field.kind === "text" && (
              <input
                type="text"
                aria-label={field.name}
                value={String(current ?? "")}
                onChange={(e) => onChange(field.name, e.target.value)}
                className="min-w-[10rem] flex-[2] border-2 border-ink bg-y-max px-2 py-1.5 font-semibold text-black outline-none"
              />
            )}

            {field.kind === "other" && (
              // A signature field or a push button. Saying so beats an input
              // that silently does nothing.
              <span className="text-black/60">Can&rsquo;t be filled here</span>
            )}
          </div>
        );
      })}

      {newFields.map((field) => (
        <div key={field.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink/25 py-2 text-[13px]">
          <button type="button" onClick={() => onLocate(field.page)} className="link min-w-0 flex-1 truncate text-left font-semibold text-red">
            {field.name}
          </button>
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-black/60">New · {KIND_LABELS[field.kind]}</span>
          <span className="text-black/60">page {field.page}</span>
          <button type="button" onClick={() => onRemoveNew(field.id)} className="link text-red">
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
