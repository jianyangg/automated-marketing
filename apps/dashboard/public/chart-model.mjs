const DAY = 86_400_000;

// A missing calendar day or null observation breaks the line, rather than
// interpolating across absent evidence. The y-axis always includes zero.
export function chartGeometry(
  series,
  { width = 760, height = 250, compact = false } = {},
) {
  const valid = series.filter((p) => Number.isFinite(p.value));
  if (!valid.length) return null;
  const left = compact ? 2 : 42,
    right = width - (compact ? 2 : 16);
  const top = compact ? 3 : 16,
    bottom = height - (compact ? 3 : 32);
  const dates = series.map((p) => Date.parse(p.date));
  const first = Math.min(...dates),
    last = Math.max(...dates);
  const minimum = Math.min(0, ...valid.map((p) => p.value));
  const maximum = Math.max(1, ...valid.map((p) => p.value));
  const x = (date) =>
    last === first
      ? (left + right) / 2
      : left + ((date - first) / (last - first)) * (right - left);
  const y = (value) =>
    bottom - ((value - minimum) / (maximum - minimum)) * (bottom - top);
  const segments = [],
    points = [];
  let segment = [],
    previous = null;
  for (const p of series) {
    const date = Date.parse(p.date);
    if (
      !Number.isFinite(p.value) ||
      (previous !== null && date - previous > DAY)
    ) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (Number.isFinite(p.value)) {
      const point = { ...p, x: x(date), y: y(p.value) };
      segment.push(point);
      points.push(point);
    }
    previous = date;
  }
  if (segment.length) segments.push(segment);
  const ticks = [0, 0.5, 1].map((fraction) => {
    const value = minimum + (maximum - minimum) * fraction;
    return { value, y: y(value) };
  });
  return { width, height, left, right, bottom, top, points, segments, ticks };
}
