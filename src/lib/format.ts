export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

/**
 * A duration a person would say out loud. "47s", "2m 14s", "1h 3m".
 *
 * Deliberately never shows milliseconds or a bare decimal: this is read at the
 * end of a transfer to answer "how long did that take", and a number like
 * "46.83s" answers it worse than "47s" does.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

/**
 * Throughput, in the unit people actually compare against their connection.
 *
 * Bits, not bytes, and that is the whole reason this exists rather than reusing
 * formatBytes: every speed test and every ISP quotes megabits, so reporting
 * "5.9 MB/s" invites someone to compare it against a "50 Mbps" line and
 * conclude the transfer is eight times slower than it is.
 */
export function formatRate(bytes: number, ms: number): string {
  if (!Number.isFinite(bytes) || !Number.isFinite(ms) || bytes <= 0 || ms <= 0) return "—";
  const megabitsPerSecond = (bytes * 8) / (ms / 1000) / 1_000_000;
  if (megabitsPerSecond < 1) return `${(megabitsPerSecond * 1000).toFixed(0)} Kbps`;
  return `${megabitsPerSecond.toFixed(1)} Mbps`;
}
