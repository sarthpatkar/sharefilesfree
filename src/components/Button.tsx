import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

// Flat colour blocks in Sigmar. Feedback is a nudge, never a recolour under
// the cursor — so it reads the same on touch, where there is no hover.
const VARIANTS: Record<Variant, string> = {
  primary: "sff-nudge bg-red px-6 py-3.5 font-display text-[16px] text-yellow",
  ghost: "sff-nudge bg-yellow px-5 py-3 font-display text-[15px] text-red",
  danger: "sff-nudge bg-red px-5 py-3 font-display text-[15px] text-yellow",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 leading-none disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
