export function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    // Blush track, hot-pink fill — the two colours that can't carry text
    // doing real work as pure graphic.
    <div className="h-3 w-full overflow-hidden bg-blush">
      <div className="h-full bg-pink transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
