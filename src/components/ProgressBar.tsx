export function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    // Square ends, not a pill-shaped track — capsules are banned site-wide.
    <div className="h-[3px] w-full overflow-hidden bg-rule">
      <div className="h-full bg-accent transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
