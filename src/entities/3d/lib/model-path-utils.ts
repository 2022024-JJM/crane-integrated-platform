export function humanizeModelPath(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  const stem = fileName.replace(/\.glb$/i, '');

  return stem
    .split(/[_-]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export function normalizeModelLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
