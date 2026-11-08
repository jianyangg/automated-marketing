import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { EngineError } from "./store.mjs";
import { LEVERS } from "./bets.mjs";

// The shared playbook: public, sourced tactics that worked for comparable
// companies. A brand tags each test with `tactic=<id>` so its own results
// can be compared against what the public record suggests.
export const PLAYBOOK_DIR = fileURLToPath(new URL("../../playbooks/", import.meta.url));
const ROUTES = ["engine-api", "site-branch", "handoff"];

export function validatePlaybook(data, file) {
  const fail = (message) => {
    throw new EngineError("invalid_playbook", `${file}: ${message}`);
  };
  if (data?.schemaVersion !== 1 || !Array.isArray(data.tactics)) fail("needs schemaVersion 1 and a tactics array.");
  const ids = new Set();
  for (const card of data.tactics) {
    if (!/^[a-z0-9-]+$/.test(card.id ?? "")) fail(`bad id ${card.id}.`);
    if (ids.has(card.id)) fail(`duplicate id ${card.id}.`);
    ids.add(card.id);
    // The lever ties a public tactic to the bets that use it, so a brand's
    // own results can be compared with the public record.
    if (!LEVERS.includes(card.lever)) fail(`${card.id}: lever must be one of ${LEVERS.join(", ")}.`);
    if (!ROUTES.includes(card.execution)) fail(`${card.id}: execution must be one of ${ROUTES.join(", ")}.`);
    if (!card.cases?.length) fail(`${card.id}: at least one case is required.`);
    for (const item of card.cases)
      if (!/^https:\/\/\S+$/.test(item.source ?? "")) fail(`${card.id}: every case needs an https source.`);
  }
  return data.tactics;
}

export async function loadPlaybook(dir = PLAYBOOK_DIR) {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  const cards = [];
  for (const file of files)
    cards.push(...validatePlaybook(JSON.parse(await readFile(join(dir, file), "utf8")), file));
  const ids = cards.map((card) => card.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new EngineError("invalid_playbook", `Tactic id ${duplicate} appears in more than one file.`);
  return cards;
}
