/**
 * Faint ruled grid behind a section — an SVG <pattern> of hairlines rather
 * than the usual repeating-linear-gradient, because gradients are banned
 * site-wide. Purely decorative, so it's hidden from assistive tech.
 */
export function GridBackdrop({ size = 56, className = "" }: { size?: number; className?: string }) {
  const id = `grid-${size}`;
  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke="var(--rule)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.5" />
    </svg>
  );
}
