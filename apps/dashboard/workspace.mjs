import { readdir } from "node:fs/promises";
import {
  brandDirectory,
  brandsDirectory,
  readBrandFile,
  readableRecord,
  validBrandId,
  problem,
} from "./files.mjs";
import { parseIndex } from "./index-model.mjs";
import { metricSnapshot } from "./snapshot.mjs";
import { readInsights } from "./insights.mjs";

export async function listBrands(root) {
  try {
    const entries = await readdir(await brandsDirectory(root), {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory() && validBrandId(entry.name))
      .map((entry) => ({ id: entry.name }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function readBrand(root, id, { now = Date.now() } = {}) {
  const directory = await brandDirectory(root, id);
  const warnings = [];
  let index = { content: "", modifiedAt: null };
  try {
    index = await readBrandFile(directory, "index.md", 512_000);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    warnings.push(
      "No operating brief yet. Ask Codex to prepare index.md for this business.",
    );
  }
  let definitions = [];
  let config = {};
  try {
    const file = await readBrandFile(directory, "dashboard.json", 128_000);
    config = JSON.parse(file.content);
    if (
      config.schemaVersion !== 1 ||
      !Array.isArray(config.metrics) ||
      config.metrics.length > 12
    )
      throw Error("Invalid view definition");
    definitions = config.metrics;
  } catch (error) {
    config = {};
    if (error.code !== "ENOENT")
      warnings.push(
        "Result definitions need attention; the operating brief is still available.",
      );
  }
  let insights = { nextMove: null, lessons: [] };
  try {
    insights = await readInsights(directory, config.summarySource);
  } catch {
    warnings.push("Decision summary unavailable; consult the operating brief.");
  }
  return {
    goalLabel:
      typeof config.goalLabel === "string"
        ? config.goalLabel.slice(0, 200)
        : null,
    ...insights,
    id,
    mode: "read-only",
    ...parseIndex(index.content, id),
    indexModifiedAt: index.modifiedAt,
    loadedAt: new Date(now).toISOString(),
    metrics: await Promise.all(
      definitions.map((definition, index) =>
        metricSnapshot(directory, definition, now, index),
      ),
    ),
    warnings,
  };
}

export async function readRecord(root, id, path) {
  if (!readableRecord(path))
    throw problem(403, "This record is outside the readable workspace.");
  const directory = await brandDirectory(root, id);
  const file = await readBrandFile(directory, path);
  return { path, ...file };
}
