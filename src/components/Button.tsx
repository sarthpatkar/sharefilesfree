import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[0_1px_2px_rgba(11,110,79,0.25)] active:scale-[0.98]",
  ghost: "text-muted hover:text-foreground underline-offset-4 hover:underline",
  danger: "text-danger hover:text-danger-hover underline-offset-4 hover:underline",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

// One button component instead of a rounded-full pill copy-pasted with a
// different color each time — rounded-xl (not full) reads as a deliberate
// shape choice rather than Tailwind's most common default.
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const shape = variant === "primary" ? "rounded-xl px-5 py-2.5" : "";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 ${shape} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
