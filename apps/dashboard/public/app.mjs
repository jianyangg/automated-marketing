import { renderBrand, renderRecord, selectTrend } from "./view.mjs";

const select = document.querySelector("#business");
const message = document.querySelector("#message");
const loading = document.querySelector("#loading");
const content = document.querySelector("#content");
const dialog = document.querySelector("#record-dialog");
let current = null;
let selected = null;
let revision = 0;
let recordRevision = 0;
let demo = false;

async function api(path) {
  const response = await fetch(`./api/${path}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "The workspace could not be read.");
  return data;
}

function notice(text) {
  message.textContent = text;
  message.hidden = !text;
}

async function loadBrand() {
  const request = ++revision;
  const id = select.value;
  current = null;
  content.hidden = true;
  loading.hidden = !id;
  dialog.close();
  recordRevision++;
  notice(
    demo
      ? "Fictional example workspace. These are not real business results."
      : "",
  );
  if (!id) {
    document.querySelector("#refresh").disabled = true;
    if (select.options.length <= 1)
      notice(
        "Add a business with Codex. Its private workspace will appear here.",
      );
    return;
  }
  document.querySelector("#refresh").disabled = true;
  try {
    const data = await api(`brands/${encodeURIComponent(id)}`);
    if (request !== revision) return;
    current = data;
    selected =
      data.metrics.find(
        (metric) =>
          metric.role === "outcome" &&
          metric.series.some((point) => point.value !== null),
      )?.id ||
      data.metrics.find((metric) =>
        metric.series.some((point) => point.value !== null),
      )?.id ||
      data.metrics[0]?.id;
    renderBrand(current, selected);
    content.hidden = false;
  } catch (error) {
    if (request === revision) notice(error.message);
  } finally {
    if (request === revision) {
      loading.hidden = true;
      document.querySelector("#refresh").disabled = false;
    }
  }
}

async function openRecord(path) {
  if (!current) return;
  const request = ++recordRevision;
  const brand = current.id;
  document.querySelector("#record-title").textContent = "Reading record…";
  document.querySelector("#record-meta").textContent = "";
  document.querySelector("#record-content").textContent = "";
  if (!dialog.open) dialog.showModal();
  try {
    const record = await api(
      `brands/${encodeURIComponent(brand)}/record?path=${encodeURIComponent(path)}`,
    );
    if (request === recordRevision && current?.id === brand && dialog.open)
      renderRecord(record);
  } catch (error) {
    if (request === recordRevision && dialog.open) {
      document.querySelector("#record-title").textContent =
        "Record unavailable";
      document.querySelector("#record-content").textContent = error.message;
    }
  }
}

document.addEventListener("click", (event) => {
  const metric = event.target.closest("[data-metric]");
  if (metric && current) {
    selected = metric.dataset.metric;
    selectTrend(current, selected);
  }
  const button = event.target.closest("[data-record]");
  if (button) void openRecord(button.dataset.record);
});
document
  .querySelector("#close-record")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => recordRevision++);
document.querySelector("#refresh").addEventListener("click", loadBrand);
select.addEventListener("change", loadBrand);
document.querySelector("#trend-metric").addEventListener("change", (event) => {
  if (!current) return;
  selected = event.target.value;
  selectTrend(current, selected);
});

try {
  const data = await api("brands");
  demo = data.demo;
  select.replaceChildren(
    new Option(
      data.brands.length ? "Choose a business" : "No business folders yet",
      "",
    ),
  );
  for (const brand of data.brands)
    select.add(new Option(brand.id.replaceAll("-", " "), brand.id));
  const requested = new URLSearchParams(location.search).get("brand");
  if (data.brands.some((brand) => brand.id === requested))
    select.value = requested;
  else if (data.brands.length === 1) select.value = data.brands[0].id;
  if (!data.brands.length)
    notice(
      "Add a business with Codex. Its private workspace will appear here.",
    );
  await loadBrand();
} catch (error) {
  select.replaceChildren(new Option("Workspace unavailable", ""));
  notice(error.message);
}
