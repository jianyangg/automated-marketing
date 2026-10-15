import { inlineParts } from "./text.mjs";

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function inline(node, text, base = "") {
  node.replaceChildren();
  for (const part of inlineParts(text)) {
    if (part.type === "text") node.append(document.createTextNode(part.text));
    else if (["strong", "em", "code"].includes(part.type)) {
      const span = element(part.type);
      if (part.type === "code") span.textContent = part.text;
      else inline(span, part.text, base);
      node.append(span);
    } else if (part.type === "external") {
      const link = element("a", "", part.text);
      link.href = part.target;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      node.append(link);
    } else if (part.target) {
      const button = element("button", "inline-link", part.text);
      button.type = "button";
      button.dataset.record = new URL(
        part.target,
        `http://record.local/${base}`,
      ).pathname.slice(1);
      node.append(button);
    } else node.append(document.createTextNode(part.text));
  }
}

export function recordLink(source, label = "Evidence ↗") {
  const button = element("button", "text-button", label);
  button.type = "button";
  button.dataset.record = source;
  return button;
}
