import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  addSituation, addCompetitor, addSignal, addGap, listSituations, listCompetitors, watchCompetitors,
  pageText, recordVisibility, visibilityReport, listGaps,
} from "../market.mjs";
import { observe } from "../learning.mjs";
import { fixture } from "./fixture.mjs";

const page = (body) => async () => ({ ok: true, status: 200, text: async () => body });

test("signals carry their source: links for public ones, consent for users' words, a reading for behavior", async (t) => {
  const { db } = await fixture(t);
  addSituation(db, { id: "long-list", name: "Long list", trigger: "Too many tasks to choose", alternatives: "Paper", by: "cmo" });
  assert.throws(() => addSituation(db, { id: "Long List", name: "x", trigger: "x", alternatives: "x", by: "cmo" }), /slug/);
  assert.throws(() => addSignal(db, { kind: "public_complaint", text: "too busy", by: "researcher" }), /source-url/);
  assert.throws(() => addSignal(db, { kind: "public_complaint", text: "too busy", sourceUrl: "http://x.test", by: "researcher" }), /https/);
  assert.throws(() => addSignal(db, { kind: "user_words", text: "I gave up on lists", by: "cmo" }), /consent/);
  assert.throws(() => addSignal(db, { kind: "behavior", text: "Most users stop after day one", by: "analyst" }), /observation/);
  assert.throws(() => addSignal(db, { kind: "rumor", text: "x", by: "cmo" }), /kind must be/);
  const reading = observe(db, { metric: "day2_return", value: 0.1, unit: "share", from: "2026-11-01T00:00:00Z", to: "2026-11-08T00:00:00Z", source: "test" });
  addSignal(db, { kind: "behavior", text: "One in ten come back on day two", observation: reading.id, situation: "long-list", by: "analyst" });
  addSignal(db, { kind: "user_words", text: "I just need to pick three things", consent: true, situation: "long-list", by: "cmo" });
  const complaint = addSignal(db, { kind: "public_complaint", text: "Too many features", sourceUrl: "https://reviews.test/1", situation: "long-list", by: "researcher" });
  const [situation] = listSituations(db);
  assert.equal(situation.firsthand, 2);
  assert.deepEqual(situation.signals, { behavior: 1, user_words: 1, public_complaint: 1 });
  assert.throws(() => addGap(db, { kind: "positioning", statement: "Nobody owns calm for families", signals: [], by: "cmo" }), /cite/);
  assert.throws(() => addGap(db, { kind: "positioning", statement: "x", signals: [complaint.id], competitors: ["ghost"], by: "cmo" }), /No competitor/);
  const gap = addGap(db, { kind: "positioning", statement: "Nobody sells 'pick three'", signals: [complaint.id], by: "cmo" });
  assert.equal(listGaps(db)[0].id, gap.id);
});

test("pageText keeps visible words and drops scripts, styles and markup", () => {
  const html = `<html><head><style>.a{}</style><script>track()</script></head>
    <body><h1>Plan&nbsp;your day</h1><p>Free &amp; simple</p><!-- hidden --><p>Free &amp; simple</p><a href="/x">Pricing</a></body></html>`;
  assert.equal(pageText(html), "Plan your day\nFree & simple\nPricing");
});

test("watch saves each page's text, reports real changes, and records failures as failures", async (t) => {
  const { db, brand } = await fixture(t);
  addCompetitor(db, { id: "rival", name: "Rival", urls: ["https://rival.test/", "https://rival.test/pricing"], by: "cmo" });
  assert.throws(() => addCompetitor(db, { id: "x", name: "X", urls: [], by: "cmo" }), /url/);
  assert.equal(listCompetitors(db)[0].watchDue, true);
  const first = await watchCompetitors(db, brand, {
    by: "competitor-watcher",
    get: page("<h1>Rival</h1><p>Free forever</p>"),
    now: new Date("2026-11-01T00:00:00Z"),
  });
  assert.deepEqual(first.map((r) => r.first), [true, true]);
  assert.equal(await readFile(join(brand, first[0].path), "utf8"), "Rival\nFree forever\n");
  const second = await watchCompetitors(db, brand, {
    by: "competitor-watcher",
    // Only markup changed on the home page: not news. Pricing changed for real.
    get: async (url) =>
      url.endsWith("pricing")
        ? { ok: true, status: 200, text: async () => "<h1>Rival</h1><p>$8 a month</p>" }
        : { ok: true, status: 200, text: async () => "<div class='new'><h1>Rival</h1></div><p>Free forever</p><script>x()</script>" },
    now: new Date("2026-12-01T00:00:00Z"),
  });
  assert.equal(second[0].changed, false);
  assert.equal(second[1].changed, true);
  assert.deepEqual(second[1].added, ["$8 a month"]);
  assert.deepEqual(second[1].removed, ["Free forever"]);
  const failed = await watchCompetitors(db, brand, {
    by: "competitor-watcher",
    get: async () => ({ ok: false, status: 503, text: async () => "" }),
    now: new Date("2026-12-02T00:00:00Z"),
  });
  assert.deepEqual(failed.map((r) => r.error), ["HTTP 503", "HTTP 503"]);
  // A failed check does not count as a fresh look at the competitor.
  assert.equal(listCompetitors(db, new Date("2026-12-02T00:00:00Z"))[0].lastWatched, "2026-12-01T00:00:00.000Z");
  // A second check later the same day keeps the earlier file and diffs against it.
  const sameDay = await watchCompetitors(db, brand, {
    only: "rival",
    by: "competitor-watcher",
    get: page("<h1>Rival</h1><p>$10 a month</p>"),
    now: new Date("2026-12-01T05:00:00Z"),
  });
  assert.notEqual(sameDay[1].path, second[1].path);
  assert.deepEqual(sameDay[1].added, ["$10 a month"]);
  assert.deepEqual(sameDay[1].removed, ["$8 a month"]);
  assert.equal(await readFile(join(brand, second[1].path), "utf8"), "Rival\n$8 a month\n");
});

test("AI visibility is a mention rate over repeated runs, with the pages assistants cite", async (t) => {
  const { db } = await fixture(t);
  const now = new Date("2026-11-08T00:00:00Z");
  const run = (mentioned, citations) =>
    recordVisibility(db, {
      prompt: "app for a to-do list that is too long",
      assistant: "chatgpt",
      mentioned,
      mentions: mentioned === "yes" ? ["Sample", "Rival"] : ["Rival"],
      citations,
      by: "visibility-auditor",
    }, { now });
  run("no", ["https://www.zapier.test/best"]);
  run("no", ["https://zapier.test/best", "https://reddit.test/r/x"]);
  run("yes", ["https://zapier.test/best"]);
  assert.throws(() => run("maybe", []), /yes or no/);
  const report = visibilityReport(db, { now });
  assert.equal(report.runs, 3);
  assert.equal(report.prompts[0].mentionRate, 0.33);
  assert.deepEqual(report.citedDomains[0], { name: "zapier.test", count: 3 });
  assert.deepEqual(report.mentionedBrands[0], { name: "Rival", count: 3 });
});
