import { readBrandFile, readableRecord } from "./files.mjs";

const text = (value, max = 500) =>
  typeof value === "string" ? value.slice(0, max) : "";
const source = (value) => (readableRecord(value) ? value : null);

// Curated, evidence-linked summaries are display context, never execution state.
export async function readInsights(directory, path) {
  if (!path) return { nextMove: null, lessons: [] };
  if (!source(path) || !path.endsWith(".json"))
    throw Error("Invalid summary source");
  const { content } = await readBrandFile(directory, path, 128_000);
  const data = JSON.parse(content);
  const next = data.nextMove;
  return {
    nextMove:
      next && typeof next === "object" && text(next.title)
        ? {
            title: text(next.title, 200),
            reason: text(next.reason),
            status: text(next.status, 80),
            source: source(next.source),
            reviewAt: text(next.reviewAt, 80),
          }
        : null,
    lessons: Array.isArray(data.lessons)
      ? data.lessons
          .slice(0, 6)
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            title: text(item.title, 150),
            kind: text(item.kind, 80),
            result: text(item.result),
            change: text(item.change),
            source: source(item.source),
          }))
      : [],
  };
}
