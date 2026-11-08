import test from "node:test";
import assert from "node:assert/strict";
import { addGrant } from "../authority.mjs";
import { propose } from "../actions.mjs";
import { publish, recordReceipt } from "../delivery.mjs";
import { observe } from "../learning.mjs";
import { status } from "../status.mjs";
import { renderBrief, BRIEF_LIMIT } from "../brief.mjs";
import { proposeBet, startBet, closeBet, addTask, closeTask, recordCost } from "../bets.mjs";
import { recordCheck } from "../funnel.mjs";
import { scorecard, tacticResults, rankTactics } from "../scorecard.mjs";
import { manualAdapter } from "../adapters/index.mjs";
import { parseIndex } from "../../dashboard/index-model.mjs";
import { config, readings, market, day } from "./funnel-fixture.mjs";
import { fixture, yes } from "./fixture.mjs";

// Replay evals: frozen situations the engine has met (or will meet) where the
// right call is known. Each asserts what the engine puts first. When the
// engine gets a judgment wrong in real use, the situation is added here so the
// mistake cannot come back. Data is synthetic and brand-neutral.

const bet = (over = {}) => ({
  title: "Directory listings",
  hypothesis: "Alternative-search pages send visits.",
  risk: "No one browses these directories.",
  lever: "listing",
  funnelStage: "visit",
  threshold: 20,
  minKnownDays: 5,
  capMoneyUsd: 0,
  capAgentUsd: 5,
  capOwnerMinutes: 30,
  situation: "long-list",
  by: "cmo",
  ...over,
});

const kinds = (view) => view.agenda.map((item) => item.kind);

test("replay: weeks of posts into the void with an unchecked north star -> verify the number, no post suggested", async (t) => {
  const { db, brand } = await fixture(t);
  const start = "2026-10-20T13:00:00Z";
  await addGrant(db, { channel: "threads", account: "sample", maxPerDay: 1, timezone: "UTC", pauseAfterFailures: 2, expiresAt: "2027-01-01", statement: "Posts" }, { confirm: yes, now: new Date(start) });
  for (let i = 0; i < 14; i++) {
    const now = day(start, i);
    const action = await propose(db, brand, { channel: "threads", account: "sample", hypothesis: `Hook ${i}`, text: `Post ${i}` }, { now });
    await publish(db, brand, action.id, { adapters: { threads: manualAdapter }, now });
    recordReceipt(db, action.id, { url: `https://threads.test/post/${i}`, now });
    observe(db, { metric: "threads_views", value: 3, unit: "count", from: now.toISOString(), to: day(start, i + 1).toISOString(), source: "threads-insights", actionId: action.id });
  }
  readings(db, "visits", "2026-10-27T00:00:00Z", [4, 3, 5, 2, 4, 3, 4]);
  readings(db, "starters", "2026-10-27T00:00:00Z", [0, 0, 1, 0, 0, 0, 0]);
  const view = status(db, { config, now: new Date("2026-11-03T12:00:00Z") });
  assert.equal(kinds(view)[0], "verify");
  assert.match(view.agenda[0].text, /starters|visits/);
  // Fourteen posts at three views each: the agenda does not ask for a fifteenth.
  assert.ok(!kinds(view).includes("publish"));
  assert.ok(kinds(view).includes("bet"));
  assert.match(view.agenda.find((i) => i.kind === "bet").text, /constraint: (visit|first_use)/);
  assert.ok(kinds(view).includes("research"));
});

test("replay: a broken metric outranks everything except reconciling a possible live post", async (t) => {
  const { db } = await fixture(t);
  const now = new Date("2026-11-08T00:00:00Z");
  recordCheck(db, { metric: "starters", state: "broken", note: "Consent banner blocks the event for most visitors.", by: "analyst" }, { now });
  const view = status(db, { config, now });
  assert.equal(view.agenda[0].kind, "measure");
  assert.equal(view.funnel.constraint.reason, "broken_metric");
});

test("replay: a bet past its kill date is closed before new work starts", async (t) => {
  const { db } = await fixture(t);
  const start = "2026-10-20T00:00:00Z";
  const gap = market(db);
  const running = proposeBet(db, config, bet({ gap: gap.id, killAt: day(start, 10).toISOString() }), { now: new Date(start) });
  startBet(db, running.id, { now: new Date(start) });
  readings(db, "visits", start, [3, 4, 2, 5, 3, 4, 3]);
  recordCheck(db, { metric: "visits", state: "verified", note: "Matched host logs for three days.", by: "analyst" });
  recordCheck(db, { metric: "starters", state: "verified", note: "Fired a test event and saw it arrive.", by: "analyst" });
  const view = status(db, { config, now: day(start, 12) });
  assert.equal(view.agenda[0].kind, "close");
  assert.match(view.agenda[0].text, /Stop or change/);
  assert.ok(kinds(view).indexOf("close") < kinds(view).indexOf("bet"));
});

test("replay: owner asks age visibly, and the brief stays inside its budget however many there are", async (t) => {
  const { db, brand } = await fixture(t);
  const now = new Date("2026-11-08T00:00:00Z");
  for (let i = 0; i < 12; i++)
    await propose(db, brand, { channel: "alternativeto", account: "sample", hypothesis: "Listing", text: `Listing copy ${i} `.repeat(10) }, { now: day("2026-11-01T00:00:00Z", i % 3) });
  const view = status(db, { config, now });
  assert.equal(view.inbox.length, 12);
  assert.ok(view.inbox.every((item) => item.kind === "approve"));
  assert.equal(view.inbox[0].ageDays, 7);
  assert.ok(view.inbox[0].stale);
  const brief = renderBrief(view, { ...config }, []);
  assert.ok(Buffer.byteLength(brief) <= BRIEF_LIMIT);
  assert.match(brief, /\*\*Waiting on you:\*\* 12 item\(s\), oldest 7 day\(s\), 12 overdue\./);
  const parsed = parseIndex(brief, "sample");
  assert.ok(parsed.attention[0].startsWith("Overdue: "));
  assert.match(brief, /\*\*Funnel \(finding-fit, last 7 days\):\*\* visit unknown\/50 a day/);
});

test("replay: a running bet with no agent work is flagged; withdrawn proposals leave the inbox", async (t) => {
  const { db, brand } = await fixture(t);
  const now = new Date("2026-11-08T00:00:00Z");
  const gap = market(db);
  const b = proposeBet(db, config, bet({ gap: gap.id, killAt: day(now.toISOString(), 14).toISOString() }), { now });
  startBet(db, b.id, { now });
  let view = status(db, { config, now });
  assert.ok(view.agenda.some((i) => i.kind === "task" && i.text.includes(b.id)));
  const task = addTask(db, { betId: b.id, kind: "listing", title: "Submit to one directory", executor: "agent", by: "cmo" }, { now });
  const owner = addTask(db, { betId: b.id, kind: "other", title: "Approve the listing text", executor: "owner", by: "cmo" }, { now });
  view = status(db, { config, now });
  assert.ok(!view.agenda.some((i) => i.kind === "task"));
  assert.equal(view.inbox[0].kind, "task");
  closeTask(db, owner.id, { result: "Approved" }, { now: day(now.toISOString(), 1) });
  closeTask(db, task.id, { result: "https://directory.test/listing/1" }, { now: day(now.toISOString(), 1) });
  const action = await propose(db, brand, { channel: "saashub", account: "sample", hypothesis: "Listing", text: "Old copy" }, { now });
  assert.equal(status(db, { config, now }).inbox.length, 1);
  const { withdrawAction } = await import("../actions.mjs");
  withdrawAction(db, action.id, "Superseded by the approved copy.", { now });
  assert.equal(status(db, { config, now }).inbox.length, 0);
  assert.equal(status(db, { config, now }).proposed.length, 0);
  await assert.rejects(publish(db, brand, action.id, { adapters: { saashub: manualAdapter }, now }), { code: "withdrawn" });
});

test("scorecard: hit rate, overrides, owner response time and costs come from records, not activity", async (t) => {
  const { db } = await fixture(t);
  const start = "2026-10-20T00:00:00Z";
  const gap = market(db);
  const kept = proposeBet(db, config, bet({ gap: gap.id, tactic: "directory-listings", killAt: day(start, 10).toISOString() }), { now: new Date(start) });
  startBet(db, kept.id, { now: new Date(start) });
  const evidence = readings(db, "visits", start, [25, 30, 22, 28, 26]);
  recordCost(db, { betId: kept.id, kind: "agent_usd", amount: 4, note: "Research and drafts", by: "cmo" }, { now: day(start, 1) });
  closeBet(db, kept.id, { verdict: "keep", rationale: "26 a day against 20.", evidence, by: "cmo" }, { now: day(start, 6) });
  const missed = proposeBet(db, config, bet({ gap: gap.id, tactic: "directory-listings", funnelStage: "first_use", threshold: 5, killAt: day(start, 10).toISOString() }), { now: new Date(start) });
  startBet(db, missed.id, { now: new Date(start) });
  const low = readings(db, "starters", start, [1, 1, 1, 1, 1, 1, 1, 1]);
  closeBet(db, missed.id, { verdict: "keep", rationale: "Owner saw sign-ups in email.", evidence: low, override: "Events were blocked; email shows 9 sign-ups.", by: "cmo" }, { now: day(start, 11) });
  const owner = addTask(db, { betId: (proposeBet(db, config, bet({ gap: gap.id, killAt: day(start, 20).toISOString() }), { now: day(start, 1) })).id, kind: "other", title: "Approve", executor: "owner", by: "cmo" }, { now: day(start, 1) });
  closeTask(db, owner.id, { result: "Done" }, { now: day(start, 2) });
  const card = scorecard(db, config, day(start, 12));
  assert.deepEqual(card.bets, { running: 0, closed: 2, kept: 2, hitRate: 1, overridden: 1, dropped: 0 });
  assert.equal(card.owner.withinSlaShare, 1);
  assert.equal(card.last28Days.agentUsd, 4);
  const economics = card.closedBets.find((b) => b.id === kept.id).economics;
  assert.equal(economics.unitsMeasured, 131);
  assert.equal(economics.costPerUnitUsd, 0.03);
  assert.equal(economics.valuePerCostUsd, null);
  assert.match(economics.note, /not units caused by it/);
});

test("tactic ranking: the owner's own results lead once there are enough of them", () => {
  const cards = [
    { id: "a", lever: "community", tactic: "A", fits: "", cases: [1, 2, 3] },
    { id: "b", lever: "listing", tactic: "B", fits: "", cases: [1] },
    { id: "c", lever: "paid", tactic: "C", fits: "", cases: [1, 2, 3, 4] },
  ];
  const bets = (tactic, statuses) => statuses.map((status) => ({ tactic, status }));
  const results = tacticResults([
    { brand: "one", bets: [...bets("b", ["kept", "kept", "stopped"]), ...bets("a", ["stopped"])] },
    { brand: "two", bets: [...bets("b", ["running"]), ...bets("c", ["kept"])] },
  ]);
  assert.deepEqual(results.find((r) => r.tactic === "b"), { tactic: "b", closed: 3, kept: 2, hitRate: 0.67, brands: 1 });
  const ranked = rankTactics(cards, results, { stage: "finding-fit" });
  assert.deepEqual(ranked.map((r) => r.id), ["b", "c", "a"]);
  assert.equal(ranked.find((r) => r.id === "c").gated, true);
  assert.deepEqual(rankTactics(cards, results, { stage: "scaling", lever: "paid" }).map((r) => [r.id, r.gated]), [["c", false]]);
});
