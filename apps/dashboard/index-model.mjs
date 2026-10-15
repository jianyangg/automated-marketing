import { readableRecord } from "./files.mjs";

export function parseIndex(markdown, id) {
  const lines = markdown.split(/\r?\n/);
  const field = (names) => {
    const match = lines.find((line) =>
      names.some((name) => line.toLowerCase().startsWith(`**${name}:**`)),
    );
    return match ? match.replace(/^\*\*[^*]+\*\*\s*/, "").trim() : null;
  };
  let attentionSection = false;
  const attention = [];
  const records = [];
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      attentionSection =
        /^##\s+(current dependencies|needs your attention|blockers|inputs that change the next decision)\s*$/i.test(
          line,
        );
    } else if (attentionSection && /^-\s+/.test(line)) {
      attention.push(line.replace(/^-\s+/, "").slice(0, 3000));
    }
    const cells = line.split("|").map((cell) => cell.trim());
    if (!line.startsWith("|") || cells.length < 4) continue;
    const link = cells[1].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!link || !readableRecord(link[2].split("#")[0])) continue;
    records.push({
      title: link[1].slice(0, 200),
      source: link[2].split("#")[0],
      status: cells[2].slice(0, 1500),
    });
  }
  return {
    name:
      lines
        .find((line) => /^#\s+/.test(line))
        ?.replace(/^#\s+/, "")
        .trim()
        .slice(0, 200) || id,
    goal: field(["confirmed goal", "goal", "desired outcome"]),
    nextAction: field(["next action", "next recommendation"]),
    recordedDate:
      markdown.match(/^Updated:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] || null,
    attention: attention.slice(0, 20),
    work: records
      .filter(
        (record) =>
          !/^(strategy\/decisions|reports\/learning)\.md$/.test(record.source),
      )
      .slice(0, 50),
    history: records.filter((record) =>
      /^(strategy\/decisions|reports\/learning)\.md$/.test(record.source),
    ),
  };
}
