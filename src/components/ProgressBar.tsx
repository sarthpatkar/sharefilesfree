export function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <div
        className="h-full rounded-full bg-emerald-500 transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
