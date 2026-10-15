// Parse only inline text and links. Imported HTML is always displayed as text.
export function inlineParts(value) {
  const parts = [];
  const text = String(value ?? "");
  const pattern =
    /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor)
      parts.push({ type: "text", text: text.slice(cursor, match.index) });
    if (match[3] || match[4] || match[5]) {
      parts.push({
        type: match[3] ? "strong" : match[4] ? "code" : "em",
        text: match[3] || match[4] || match[5],
      });
      cursor = match.index + match[0].length;
      continue;
    }
    const target = match[2];
    if (/^https?:\/\//i.test(target))
      parts.push({ type: "external", text: match[1], target });
    else if (
      !/^[a-z]+:/i.test(target) &&
      !target.startsWith("/") &&
      !target.includes("\\")
    )
      parts.push({
        type: "record",
        text: match[1],
        target: target.split("#")[0],
      });
    else parts.push({ type: "text", text: match[1] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length)
    parts.push({ type: "text", text: text.slice(cursor) });
  return parts;
}

export function dateLabel(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
