const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
const tableRule = (line) => /^\s*\|?\s*:?-{3,}:?\s*\|/.test(line || "");
const listItem = (line) => line.match(/^\s*(?:([-+*])|(\d+)\.)\s+(.+)/);
const boundary = (lines, i) =>
  /^(#{1,6}\s|```|~~~|>\s|\s*$)/.test(lines[i]) ||
  listItem(lines[i]) ||
  (lines[i].includes("|") && tableRule(lines[i + 1]));

// A deliberately limited, inert Markdown subset for workspace reports.
export function markdownBlocks(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^(```+|~~~+)(.*)/);
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (fence) {
      const content = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence[1]))
        content.push(lines[i++]);
      i++;
      blocks.push({ type: "code", text: content.join("\n") });
    } else if (heading) {
      blocks.push({
        type: "heading",
        level: Math.min(heading[1].length + 1, 6),
        text: heading[2],
      });
      i++;
    } else if (line.includes("|") && tableRule(lines[i + 1])) {
      const headers = cells(line),
        rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim())
        rows.push(cells(lines[i++]));
      blocks.push({ type: "table", headers, rows });
    } else if (listItem(line)) {
      const ordered = Boolean(listItem(line)[2]),
        items = [];
      while (i < lines.length) {
        const item = listItem(lines[i]);
        if (!item || Boolean(item[2]) !== ordered) break;
        items.push(item[3]);
        i++;
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i]) &&
          !listItem(lines[i])
        )
          items[items.length - 1] += ` ${lines[i++].trim()}`;
      }
      blocks.push({ type: "list", ordered, items });
    } else if (/^>\s?/.test(line)) {
      const content = [];
      while (i < lines.length && /^>\s?/.test(lines[i]))
        content.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", text: content.join("\n") });
    } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      i++;
    } else {
      const content = [line];
      i++;
      while (i < lines.length && !boundary(lines, i)) content.push(lines[i++]);
      blocks.push({ type: "paragraph", text: content.join("\n") });
    }
  }
  return blocks;
}
