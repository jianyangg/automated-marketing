export function pointerValue(data, pointer) {
  if (
    typeof pointer !== "string" ||
    !pointer.startsWith("/") ||
    pointer.length > 1500
  )
    return undefined;
  let value = data;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      value === null ||
      typeof value !== "object" ||
      !Object.hasOwn(value, key)
    )
      return undefined;
    value = value[key];
  }
  return value;
}

export function selectMetric(data, selector) {
  if (!selector || typeof selector !== "object") return null;
  const value = pointerValue(data, selector.pointer);
  const numeric = (item) => typeof item === "number" && Number.isFinite(item);
  if (!selector.sum) return numeric(value) ? value : null;
  if (
    typeof selector.sum !== "string" ||
    !Array.isArray(value) ||
    !value.length
  )
    return null;
  const values = value.map((row) =>
    row && Object.hasOwn(row, selector.sum) ? row[selector.sum] : undefined,
  );
  if (!values.every(numeric)) return null;
  const sum = values.reduce((total, item) => total + item, 0);
  return numeric(sum) ? sum : null;
}

export function observationTime(data, pointer, now) {
  const raw = pointerValue(data, pointer);
  const time = typeof raw === "string" ? Date.parse(raw) : NaN;
  if (!Number.isFinite(time) || time > now + 300_000)
    return { observedAt: null, stale: null };
  return {
    observedAt: new Date(time).toISOString(),
    stale: now - time > 36 * 3_600_000,
  };
}
