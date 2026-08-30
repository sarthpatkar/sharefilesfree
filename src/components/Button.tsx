import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

// Square corners, flat fills, and a hard offset shadow on the primary — the
// house style. No pills (banned site-wide) and no soft blurred shadow, which
// is the tell of a default SaaS button.
//
// Secondary variants carry a *permanent* underline rather than one that only
// appears on hover: these are real actions ("Add a logo", "Cancel"), and an
// affordance that's invisible until hover doesn't exist at all on touch.
const VARIANTS: Record<Variant, string> = {
  primary: "sff-press bg-ink text-paper hover:bg-accent shadow-[4px_4px_0_var(--accent)] px-5 py-3",
  ghost: "py-1.5 text-ink underline underline-offset-[5px] decoration-rule-strong hover:decoration-accent hover:text-accent",
  danger: "py-1.5 text-danger underline underline-offset-[5px] decoration-danger/40 hover:decoration-danger",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 text-sm font-medium leading-none transition disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
