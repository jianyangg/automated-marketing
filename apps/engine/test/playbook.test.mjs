import test from "node:test";
import assert from "node:assert/strict";
import { loadPlaybook, validatePlaybook } from "../playbook.mjs";

test("the shipped playbook is valid: unique ids, sourced cases, known execution routes", async () => {
  const cards = await loadPlaybook();
  assert.ok(cards.length >= 5);
  for (const card of cards) assert.match(card.id, /^[a-z0-9-]+$/);
  assert.ok(cards.every((card) => typeof card.lever === "string"));
});

test("an unsourced or duplicate tactic is rejected", () => {
  const card = { id: "x", lever: "community", execution: "handoff", cases: [{ source: "https://example.test" }] };
  assert.throws(() => validatePlaybook({ schemaVersion: 1, tactics: [card, card] }, "f"), /duplicate/);
  assert.throws(
    () => validatePlaybook({ schemaVersion: 1, tactics: [{ ...card, cases: [{ source: "a blog" }] }] }, "f"),
    /https source/,
  );
  assert.throws(() => validatePlaybook({ schemaVersion: 1, tactics: [{ ...card, execution: "magic" }] }, "f"), /execution/);
  // Without a lever a tactic cannot be matched to the bets that use it.
  assert.throws(() => validatePlaybook({ schemaVersion: 1, tactics: [{ ...card, lever: "vibes" }] }, "f"), /lever/);
});
