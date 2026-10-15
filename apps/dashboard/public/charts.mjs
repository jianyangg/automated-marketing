import { chartGeometry } from "./chart-model.mjs";
import { element } from "./dom.mjs";

const number = (value) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
export const dayLabel = (date) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));

function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export function lineChart(metric, compact = false) {
  const chart = chartGeometry(
    metric.series,
    compact ? { width: 180, height: 38, compact: true } : undefined,
  );
  if (!chart) return null;
  const svg = svgNode("svg", {
    viewBox: `0 0 ${chart.width} ${chart.height}`,
    class: compact ? "sparkline" : "line-chart",
    role: "img",
    "aria-label": `${metric.label}, ${metric.series[0].date} to ${metric.series.at(-1).date}`,
  });
  svg.append(
    svgNode("title", {}, `${metric.label} · daily saved observations`),
  );
  if (!compact) {
    for (const tick of chart.ticks) {
      svg.append(
        svgNode("line", {
          x1: chart.left,
          x2: chart.right,
          y1: tick.y,
          y2: tick.y,
          class: "chart-grid",
        }),
      );
      svg.append(
        svgNode(
          "text",
          {
            x: chart.left - 10,
            y: tick.y + 4,
            "text-anchor": "end",
            class: "chart-label",
          },
          number(tick.value),
        ),
      );
    }
    for (const [point, anchor] of [
      [chart.points[0], "start"],
      [chart.points.at(-1), "end"],
    ]) {
      svg.append(
        svgNode(
          "text",
          {
            x: point.x,
            y: chart.height - 5,
            "text-anchor": anchor,
            class: "chart-label",
          },
          dayLabel(point.date),
        ),
      );
    }
  }
  for (const segment of chart.segments) {
    svg.append(
      svgNode("polyline", {
        points: segment.map((p) => `${p.x},${p.y}`).join(" "),
        fill: "none",
        class: "chart-line",
        "vector-effect": "non-scaling-stroke",
      }),
    );
  }
  for (const point of chart.points) {
    const circle = svgNode("circle", {
      cx: point.x,
      cy: point.y,
      r: compact ? 1.7 : 3.5,
      class: "chart-point",
    });
    circle.append(
      svgNode("title", {}, `${dayLabel(point.date)}: ${number(point.value)}`),
    );
    svg.append(circle);
  }
  return svg;
}

export function dataTable(metric) {
  const details = element("details", "chart-data");
  details.append(element("summary", "", "Daily values"));
  const table = element("table");
  const header = element("tr");
  header.append(element("th", "", "Date"), element("th", "", metric.label));
  const head = element("thead");
  head.append(header);
  table.append(head);
  const body = element("tbody");
  for (const point of metric.series) {
    const row = element("tr");
    row.append(
      element("td", "", point.date),
      element(
        "td",
        "",
        point.value === null ? "Not measured" : number(point.value),
      ),
    );
    body.append(row);
  }
  table.append(body);
  details.append(table);
  return details;
}
