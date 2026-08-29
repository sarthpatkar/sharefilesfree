export function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
