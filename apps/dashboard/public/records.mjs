import { element, inline } from "./dom.mjs";
import { dateLabel } from "./text.mjs";
import { markdownBlocks } from "./markdown-model.mjs";

export function renderRecord(record) {
  const container = document.querySelector("#record-content");
  document.querySelector("#record-title").textContent = record.path
    .split("/")
    .at(-1);
  document.querySelector("#record-meta").textContent =
    `${record.path} · ${dateLabel(record.modifiedAt)}`;
  container.replaceChildren();
  if (!record.path.endsWith(".md")) {
    let text = record.content;
    if (record.path.endsWith(".json")) {
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* Preserve invalid originals. */
      }
    }
    container.append(element("pre", "", text));
    return;
  }
  const base = record.path.includes("/")
    ? record.path.slice(0, record.path.lastIndexOf("/") + 1)
    : "";
  for (const block of markdownBlocks(record.content)) {
    if (block.type === "table") {
      const wrap = element("div", "table-scroll"),
        table = element("table");
      const head = element("thead"),
        row = element("tr");
      for (const cell of block.headers) {
        const th = element("th");
        inline(th, cell, base);
        row.append(th);
      }
      head.append(row);
      table.append(head);
      const body = element("tbody");
      for (const cells of block.rows) {
        const tr = element("tr");
        for (const cell of cells) {
          const td = element("td");
          inline(td, cell, base);
          tr.append(td);
        }
        body.append(tr);
      }
      table.append(body);
      wrap.append(table);
      container.append(wrap);
    } else if (block.type === "list") {
      const list = element(block.ordered ? "ol" : "ul");
      for (const text of block.items) {
        const li = element("li");
        inline(li, text, base);
        list.append(li);
      }
      container.append(list);
    } else if (block.type === "code") {
      const pre = element("pre");
      pre.append(element("code", "", block.text));
      container.append(pre);
    } else {
      const tag = {
        heading: `h${block.level}`,
        quote: "blockquote",
        rule: "hr",
        paragraph: "p",
      }[block.type];
      const node = element(tag);
      if (block.text) inline(node, block.text, base);
      container.append(node);
    }
  }
}
