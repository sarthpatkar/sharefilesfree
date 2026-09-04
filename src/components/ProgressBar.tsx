export function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    // Pale track, red fill. The bar is information, not decoration, so it
    // doing real work as pure graphic.
    <div className="h-3 w-full overflow-hidden bg-y-mid">
      <div className="h-full bg-red transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
