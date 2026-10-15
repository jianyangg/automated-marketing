import { readBrandFile, readableRecord } from "./files.mjs";
import { selectMetric, observationTime, pointerValue } from "./metrics.mjs";
import { selectSeries } from "./series.mjs";

const text = (value, max = 1000) =>
  typeof value === "string" ? value.slice(0, max) : "";

export async function metricSnapshot(directory, definition, now, index) {
  const metric = {
    id: text(definition?.id, 100) || `metric-${index}`,
    role: definition?.role === "outcome" ? "outcome" : "supporting",
    label: text(definition?.label, 100) || "Untitled metric",
    source: readableRecord(definition?.source) ? definition.source : null,
    period: text(definition?.period, 200),
    note: text(definition?.note) || text(definition?.unavailableReason),
    value: null,
    observedAt: null,
    stale: null,
    series: [],
    seriesSource: null,
    seriesObservedAt: null,
  };
  if (!metric.source) return metric;
  try {
    if (!metric.source.endsWith(".json")) throw Error("Not a JSON observation");
    const file = await readBrandFile(directory, metric.source);
    const data = JSON.parse(file.content);
    const period = pointerValue(data, definition.periodPointer);
    const bounds = Array.isArray(period)
      ? period
      : period && typeof period === "object"
        ? [period.from ?? period.since, period.to ?? period.until]
        : null;
    if (
      bounds?.length === 2 &&
      bounds.every((value) => typeof value === "string")
    )
      metric.period = bounds.join(" → ").slice(0, 200);
    metric.value = selectMetric(data, definition.selector);
    Object.assign(
      metric,
      observationTime(data, definition.observedAtPointer, now),
    );
    if (metric.value === null)
      metric.error = "No numeric observation at the saved source.";
    try {
      let seriesData = data;
      if (definition.series?.source) {
        if (
          !readableRecord(definition.series.source) ||
          !definition.series.source.endsWith(".json")
        )
          throw Error("Invalid series source");
        seriesData = JSON.parse(
          (await readBrandFile(directory, definition.series.source)).content,
        );
      }
      metric.series = selectSeries(seriesData, definition.series);
      if (definition.series) {
        metric.seriesSource = definition.series.source || metric.source;
        metric.seriesObservedAt = observationTime(
          seriesData,
          definition.series.observedAtPointer || definition.observedAtPointer,
          now,
        ).observedAt;
      }
    } catch {
      metric.seriesError = "Dated evidence is missing or invalid.";
    }
  } catch {
    metric.error = "Saved observation unavailable.";
  }
  return metric;
}
