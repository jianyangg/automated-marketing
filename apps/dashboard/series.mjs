import { pointerValue } from "./metrics.mjs";

// No implicit aggregation: duplicate dates may represent overlapping identities.
export function selectSeries(data, definition) {
  if (!definition) return [];
  const rows = pointerValue(data, definition.pointer);
  if (!Array.isArray(rows) || rows.length > 730)
    throw Error("Invalid time series");
  const days = new Set();
  return rows
    .map((row) => {
      const raw = pointerValue(row, definition.datePointer);
      const date = typeof raw === "string" ? raw.slice(0, 10) : "";
      const time = Date.parse(date);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(time) ||
        new Date(time).toISOString().slice(0, 10) !== date ||
        days.has(date)
      ) {
        throw Error("Dates must be valid and unique");
      }
      days.add(date);
      const value = pointerValue(row, definition.valuePointer);
      return {
        date,
        value:
          typeof value === "number" && Number.isFinite(value) ? value : null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
