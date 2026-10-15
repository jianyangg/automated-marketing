import { element, recordLink } from "./dom.mjs";
import { lineChart, dataTable, dayLabel } from "./charts.mjs";
import { dateLabel } from "./text.mjs";

const number = (value) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

export function periodLabel(value) {
  const dates = value?.match(/\d{4}-\d{2}-\d{2}/g);
  if (
    dates?.length === 2 &&
    dates.every((date) => Number.isFinite(Date.parse(date)))
  ) {
    return `${dayLabel(dates[0])} – ${dayLabel(dates[1])}`;
  }
  return value || "Not yet measured";
}

export function renderMetrics(metrics, selected) {
  const container = document.querySelector("#metrics");
  container.replaceChildren();
  if (!metrics.length) {
    container.append(
      element("p", "empty-state", "No goal metrics defined yet."),
    );
    return;
  }
  for (const metric of metrics) {
    const card = element(
      "article",
      `metric-card ${metric.role === "outcome" ? "outcome-card" : ""}`,
    );
    const button = element("button", "metric-select");
    button.type = "button";
    button.dataset.metric = metric.id;
    button.setAttribute("aria-pressed", String(selected === metric.id));
    button.append(
      element("span", "metric-label", metric.label),
      element(
        "span",
        "metric-value",
        metric.value === null ? "—" : number(metric.value),
      ),
    );
    const sparkline = lineChart(metric, true);
    if (sparkline) {
      sparkline.setAttribute("aria-hidden", "true");
      button.append(sparkline);
    }
    button.append(element("span", "metric-period", periodLabel(metric.period)));
    card.append(button);
    const details = element("details", "metric-details");
    details.append(
      element(
        "summary",
        metric.stale ? "stale-label" : "",
        metric.value === null
          ? "Measurement needed"
          : metric.stale
            ? "Older observation"
            : "Definition & source",
      ),
    );
    details.append(
      element(
        "p",
        "",
        metric.error || metric.note || "Saved numeric observation.",
      ),
    );
    details.append(
      element(
        "p",
        "muted",
        `${metric.period || "Window unknown"} · Saved ${dateLabel(metric.observedAt)}`,
      ),
    );
    if (metric.source) details.append(recordLink(metric.source));
    if (metric.seriesSource && metric.seriesSource !== metric.source) {
      details.append(
        element(
          "p",
          "muted",
          `Trend saved ${dateLabel(metric.seriesObservedAt)}`,
        ),
      );
      details.append(recordLink(metric.seriesSource, "Trend evidence ↗"));
    }
    card.append(details);
    container.append(card);
  }
}

export function renderTrend(data, selected) {
  const container = document.querySelector("#trend");
  container.replaceChildren();
  const metric = data.metrics.find((item) => item.id === selected);
  if (!metric) {
    container.append(element("p", "chart-empty", "No dated measurements yet."));
    return;
  }
  const chart = lineChart(metric);
  if (!chart) {
    const empty = element("div", "chart-empty");
    empty.append(
      element("span", "empty-symbol", "—"),
      element("h3", "", "Trend not yet measurable"),
      element(
        "p",
        "",
        metric.seriesError ||
          metric.note ||
          "A saved total does not establish a trend.",
      ),
    );
    container.append(empty);
    return;
  }
  const outcome = data.metrics.find((item) => item.role === "outcome");
  if (
    outcome &&
    metric.role !== "outcome" &&
    !outcome.series.some((point) => Number.isFinite(point.value))
  )
    container.append(
      element(
        "p",
        "chart-context",
        `${outcome.label}: trend unavailable. Showing ${metric.label.toLowerCase()}.`,
      ),
    );
  container.append(chart);
  const caption = element("div", "chart-caption");
  const range = metric.series;
  caption.append(
    element(
      "span",
      "",
      `${dayLabel(range[0].date)} – ${dayLabel(range.at(-1).date)} · daily observations`,
    ),
  );
  if (metric.seriesSource || metric.source)
    caption.append(
      recordLink(metric.seriesSource || metric.source, "Source ↗"),
    );
  container.append(caption);
  if (metric.note) container.append(element("p", "chart-note", metric.note));
  container.append(dataTable(metric));
}
