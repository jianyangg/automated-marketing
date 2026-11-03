import test from "node:test";
import assert from "node:assert/strict";
import { loadPlaybook, validatePlaybook } from "../playbook.mjs";

test("the shipped playbook is valid: unique ids, sourced cases, known execution routes", async () => {
  const cards = await loadPlaybook();
  assert.ok(cards.length >= 5);
  for (const card of cards) assert.match(card.id, /^[a-z0-9-]+$/);
});

test("an unsourced or duplicate tactic is rejected", () => {
  const card = { id: "x", execution: "handoff", cases: [{ source: "https://example.test" }] };
  assert.throws(() => validatePlaybook({ schemaVersion: 1, tactics: [card, card] }, "f"), /duplicate/);
  assert.throws(
    () => validatePlaybook({ schemaVersion: 1, tactics: [{ ...card, cases: [{ source: "a blog" }] }] }, "f"),
    /https source/,
  );
  assert.throws(() => validatePlaybook({ schemaVersion: 1, tactics: [{ ...card, execution: "magic" }] }, "f"), /execution/);
});
