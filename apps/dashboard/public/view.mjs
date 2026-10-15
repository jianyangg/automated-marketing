import { element, inline, recordLink } from "./dom.mjs";
import { dateLabel } from "./text.mjs";
import { renderMetrics, renderTrend } from "./metric-view.mjs";
export { renderRecord } from "./records.mjs";

function recordRow(record) {
  const row = element("button", "record-row");
  row.type = "button";
  row.dataset.record = record.source;
  const copy = element("span", "record-copy");
  copy.append(
    element("span", "record-name", record.title),
    element("span", "record-status", record.status),
  );
  row.append(copy, element("span", "record-arrow", "↗"));
  return row;
}

function renderNext(data) {
  const next = data.nextMove;
  inline(
    document.querySelector("#next-title"),
    next?.title || data.nextAction || "Choose the next move in Codex.",
  );
  inline(
    document.querySelector("#next-reason"),
    next?.reason || "No evidence-linked decision summary yet.",
  );
  document.querySelector("#next-status").textContent = next?.status || "";
  const source = document.querySelector("#next-source");
  source.replaceChildren();
  source.append(recordLink(next?.source || "index.md", "Plan & evidence ↗"));
  const review = document.querySelector("#next-review");
  const reviewTime = Date.parse(next?.reviewAt);
  const due =
    Number.isFinite(reviewTime) && reviewTime <= Date.parse(data.loadedAt);
  review.hidden = !Number.isFinite(reviewTime);
  review.textContent = due
    ? `Review due · ${dateLabel(next.reviewAt)}. Check actual results before continuing.`
    : `Review ${dateLabel(next?.reviewAt)}`;
  if (due) document.querySelector("#next-status").textContent = "Review due";
  document.querySelector("#attention-title").textContent =
    `Dependencies (${data.attention.length})`;
  document.querySelector("#attention-details").hidden = !data.attention.length;
  document.querySelector("#attention").replaceChildren(
    ...data.attention.map((text) => {
      const li = element("li");
      inline(li, text);
      return li;
    }),
  );
}

function renderLessons(data) {
  const container = document.querySelector("#lessons");
  container.replaceChildren();
  const source = document.querySelector("#learning-source");
  source.replaceChildren();
  const learning = data.history.find(
    (item) => item.source === "reports/learning.md",
  );
  if (learning) source.append(recordLink(learning.source, "All lessons ↗"));
  if (!data.lessons.length) {
    container.append(
      element("p", "empty-state", "No evidence-linked lessons recorded yet."),
    );
    return;
  }
  const table = element("table", "learning-table");
  const head = element("thead"),
    tr = element("tr");
  for (const title of [
    "Effort / evidence",
    "What we learned",
    "What changes next",
  ])
    tr.append(element("th", "", title));
  head.append(tr);
  table.append(head);
  const body = element("tbody");
  for (const lesson of data.lessons) {
    const row = element("tr");
    const context = element("td");
    context.dataset.label = "Effort / evidence";
    context.append(
      element("span", "lesson-kind", lesson.kind),
      element("strong", "", lesson.title),
    );
    if (lesson.source) context.append(recordLink(lesson.source));
    row.append(context);
    for (const [text, label] of [
      [lesson.result, "What we learned"],
      [lesson.change, "What changes next"],
    ]) {
      const cell = element("td");
      cell.dataset.label = label;
      inline(cell, text);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  container.append(table);
}

export function renderBrand(data, selected) {
  document.querySelector("#business-name").textContent = data.name.replace(
    /\s+marketing$/i,
    "",
  );
  document.title = `${data.name} · Progress`;
  inline(
    document.querySelector("#goal"),
    data.goalLabel || data.goal || "Not defined",
  );
  const dates = data.metrics
    .flatMap((metric) => [metric.observedAt, metric.seriesObservedAt])
    .filter(Boolean)
    .sort();
  document.querySelector("#observed-at").textContent = dates.length
    ? `Latest saved observation · ${dateLabel(dates.at(-1))}`
    : "No dated observations";
  renderMetrics(data.metrics, selected);
  const select = document.querySelector("#trend-metric");
  select.replaceChildren(
    ...data.metrics.map((metric) => new Option(metric.label, metric.id)),
  );
  select.value = selected || "";
  select.disabled = !data.metrics.length;
  renderTrend(data, selected);
  renderNext(data);
  renderLessons(data);
  document.querySelector("#work-count").textContent =
    `(${data.work.length + data.history.length})`;
  document
    .querySelector("#work")
    .replaceChildren(...[...data.work, ...data.history].map(recordRow));
  document
    .querySelector("#warnings")
    .replaceChildren(
      ...data.warnings.map((warning) => element("p", "notice", warning)),
    );
}

export function selectTrend(data, id) {
  document.querySelector("#trend-metric").value = id;
  for (const card of document.querySelectorAll("[data-metric]"))
    card.setAttribute("aria-pressed", String(card.dataset.metric === id));
  renderTrend(data, id);
}
