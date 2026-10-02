export function formatBigInt(value: bigint | null): string {
  if (value === null) return 'n/a';
  const abs = value < 0n ? -value : value;
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return value < 0n ? `-${grouped}` : grouped;
}

export function formatRelativeTime(timestampMs: number): string {
  if (!timestampMs) return 'n/a';
  const delta = Math.max(0, Date.now() - timestampMs);
  if (delta < 1000) return 'just now';
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  return `${Math.floor(delta / 60_000)}m ago`;
}

export function formatTransformValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Object.is(value, -0) ? '0' : String(value);
}
