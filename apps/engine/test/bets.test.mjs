import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../config.mjs";
import { addGrant } from "../authority.mjs";
import { propose } from "../actions.mjs";
import {
  proposeBet, startBet, closeBet, extendBet, getBet, addTask, closeTask, recordCost, MAX_RUNNING,
} from "../bets.mjs";
import { recordCheck, setStage, funnelView, currentStage } from "../funnel.mjs";
import { fixture, yes } from "./fixture.mjs";
import { config, day, readings, market } from "./funnel-fixture.mjs";

const base = {
  title: "Get listed on two directories",
  hypothesis: "Directory pages send people searching for alternatives.",
  risk: "Listings may get no traffic at all.",
  lever: "listing",
  funnelStage: "visit",
  threshold: 20,
  minKnownDays: 5,
  capMoneyUsd: 0,
  capAgentUsd: 5,
  capOwnerMinutes: 30,
  situation: "long-list",
  by: "cmo",
};

test("config: funnel stages need a known metric and a stated target; manual metrics need no API", () => {
  assert.deepEqual(config.funnel.map((s) => s.stage), ["visit", "first_use"]);
  const metrics = [{ name: "m", provider: "manual", unit: "u", timezone: "UTC" }];
  assert.throws(() => parseConfig({ metrics, funnel: [{ stage: "a", metric: "m" }] }), /target/);
  assert.throws(() => parseConfig({ metrics, funnel: [{ stage: "a", metric: "nope", target: 1 }] }), /not one of/);
  assert.throws(() => parseConfig({ metrics: [{ name: "m", provider: "manual", unit: "u" }] }), /timezone/);
  assert.equal(parseConfig({ metrics }).economics.valuePerUnitUsd, null);
});

test("a bet must state its threshold, kill date, caps, risk, situation and gap before it exists", async (t) => {
  const { db } = await fixture(t);
  const now = new Date("2026-11-08T00:00:00Z");
  const killAt = day(now.toISOString(), 14).toISOString();
  assert.throws(() => proposeBet(db, config, { ...base, killAt }, { now }), /No situation long-list/);
  const gap = market(db);
  assert.throws(() => proposeBet(db, config, { ...base, killAt }, { now }), /market gap/);
  for (const missing of ["threshold", "risk", "capAgentUsd", "minKnownDays"])
    assert.throws(() => proposeBet(db, config, { ...base, gap: gap.id, killAt, [missing]: undefined }, { now }), { code: "invalid_bet" });
  assert.throws(() => proposeBet(db, config, { ...base, gap: gap.id, killAt: day(now.toISOString(), 90).toISOString() }, { now }), /at most 56 days/);
  assert.throws(() => proposeBet(db, config, { ...base, gap: gap.id, killAt: day(now.toISOString(), 3).toISOString() }, { now }), /too soon/);
  assert.throws(() => proposeBet(db, config, { ...base, gap: gap.id, killAt, funnelStage: "pay" }, { now }), /not in engine.json/);
  assert.throws(() => proposeBet(db, config, { ...base, gap: gap.id, killAt, by: "Some Agent" }, { now }), { code: "invalid_author" });
  const bet = proposeBet(db, config, { ...base, gap: gap.id, killAt }, { now });
  assert.equal(bet.status, "proposed");
  assert.equal(bet.metric, "visits");
  // Measurement and research bets learn rather than reach; they need no gap.
  const measure = proposeBet(db, config, { ...base, lever: "measurement", funnelStage: "first_use", threshold: undefined, situation: undefined, killAt }, { now });
  assert.equal(measure.criterion, "verified");
});

test("at most three bets run at once, and a broken metric blocks every bet but its fix", async (t) => {
  const { db } = await fixture(t);
  const now = new Date("2026-11-08T00:00:00Z");
  const gap = market(db);
  const killAt = day(now.toISOString(), 14).toISOString();
  recordCheck(db, { metric: "visits", state: "broken", note: "Analytics script missing on the homepage.", by: "analyst" }, { now });
  const blocked = proposeBet(db, config, { ...base, gap: gap.id, killAt }, { now });
  assert.throws(() => startBet(db, blocked.id, { now }), { code: "metric_broken" });
  const fix = proposeBet(db, config, { ...base, lever: "measurement", threshold: undefined, situation: undefined, killAt }, { now });
  assert.equal(startBet(db, fix.id, { now }).status, "running");
  recordCheck(db, { metric: "visits", state: "verified", note: "Test visit appeared in the report within a minute.", by: "analyst" }, { now: day(now.toISOString(), 1) });
  // The fix is now scored as met, because the metric was verified after it started.
  assert.equal(getBet(db, fix.id, day(now.toISOString(), 1)).score.state, "keep");
  for (let i = 1; i < MAX_RUNNING; i++) startBet(db, proposeBet(db, config, { ...base, gap: gap.id, killAt }, { now }).id, { now });
  assert.throws(() => startBet(db, blocked.id, { now }), { code: "wip_limit" });
});

test("before the scaling stage, paid reach needs the learning flag or a stated override", async (t) => {
  const { db } = await fixture(t);
  const now = new Date("2026-11-08T00:00:00Z");
  const gap = market(db);
  const paid = { ...base, gap: gap.id, lever: "paid", capMoneyUsd: 100, killAt: day(now.toISOString(), 14).toISOString() };
  assert.throws(() => proposeBet(db, config, { ...paid, capMoneyUsd: 0 }, { now }), /money cap/);
  const reach = proposeBet(db, config, paid, { now });
  assert.equal(currentStage(db).stage, "finding-fit");
  assert.throws(() => startBet(db, reach.id, { now }), { code: "stage_gate" });
  assert.equal(startBet(db, reach.id, { now, overrideStage: "Owner asked for one week of reach to test the ad account." }).stageOverride !== null, true);
  const test = proposeBet(db, config, { ...paid, learning: true }, { now });
  assert.equal(startBet(db, test.id, { now }).status, "running");
  assert.throws(() => proposeBet(db, config, { ...base, gap: gap.id, learning: true, killAt: paid.killAt }, { now }), /only to paid/);
});

test("stage moves forward only on cited readings", async (t) => {
  const { db } = await fixture(t);
  assert.throws(() => setStage(db, { stage: "early-traction", rationale: "Feels like traction.", by: "cmo" }), /must cite/);
  const [id] = readings(db, "starters", "2026-11-01T00:00:00Z", [12]);
  assert.equal(setStage(db, { stage: "early-traction", rationale: "Return use held.", evidence: [id], by: "cmo" }).from, "finding-fit");
  assert.equal(setStage(db, { stage: "finding-fit", rationale: "Return use fell away.", by: "cmo" }).stage, "finding-fit");
});

test("the verdict comes from the numbers; closing against them needs a stated override", async (t) => {
  const { db } = await fixture(t);
  const start = "2026-11-01T00:00:00Z";
  const gap = market(db);
  const bet = proposeBet(db, config, { ...base, gap: gap.id, killAt: day(start, 10).toISOString() }, { now: new Date(start) });
  startBet(db, bet.id, { now: new Date(start) });
  const low = readings(db, "visits", start, [5, 6, 4, 7, 5, 6]);
  const during = day(start, 6);
  assert.equal(getBet(db, bet.id, during).score.state, "running");
  assert.throws(() => closeBet(db, bet.id, { verdict: "keep", rationale: "Looks promising.", evidence: low, by: "cmo" }, { now: during }), { code: "verdict_mismatch" });
  const after = day(start, 11);
  assert.equal(getBet(db, bet.id, after).score.state, "stop");
  assert.throws(() => closeBet(db, bet.id, { verdict: "stop", rationale: "Missed.", by: "cmo" }, { now: after }), /cite/);
  assert.throws(() => closeBet(db, bet.id, { verdict: "stop", rationale: "x".repeat(281), evidence: low, by: "cmo" }, { now: after }), /280/);
  const closed = closeBet(db, bet.id, { verdict: "stop", rationale: "Averaged 5.5 a day against 20.", evidence: low, by: "cmo" }, { now: after });
  assert.equal(closed.status, "stopped");
  assert.equal(closed.overridden, false);
  assert.throws(() => closeBet(db, bet.id, { verdict: "stop", rationale: "Again.", evidence: low, by: "cmo" }, { now: after }), /already stopped/);
});

test("a bet that hit its threshold is kept; an unmeasured one may be extended once", async (t) => {
  const { db } = await fixture(t);
  const start = "2026-11-01T00:00:00Z";
  const gap = market(db);
  const hit = proposeBet(db, config, { ...base, gap: gap.id, killAt: day(start, 10).toISOString() }, { now: new Date(start) });
  startBet(db, hit.id, { now: new Date(start) });
  const high = readings(db, "visits", start, [25, 30, 22, 28, 26]);
  assert.equal(getBet(db, hit.id, day(start, 5)).score.state, "keep");
  assert.equal(closeBet(db, hit.id, { verdict: "keep", rationale: "26 a day against 20.", evidence: high, by: "cmo" }, { now: day(start, 5) }).status, "kept");

  const quiet = proposeBet(db, config, { ...base, gap: gap.id, funnelStage: "first_use", killAt: day(start, 10).toISOString() }, { now: new Date(start) });
  startBet(db, quiet.id, { now: new Date(start) });
  const after = day(start, 11);
  assert.equal(getBet(db, quiet.id, after).score.state, "insufficient");
  assert.throws(() => extendBet(db, quiet.id, { to: day(start, 60).toISOString(), reason: "More time." }, { now: after }), /within 28 days/);
  extendBet(db, quiet.id, { to: day(start, 20).toISOString(), reason: "Metric connected late." }, { now: after });
  assert.throws(() => extendBet(db, quiet.id, { to: day(start, 25).toISOString(), reason: "Again." }, { now: after }), /already extended/);
});

test("money is recorded before spending, only under a spend grant, within both caps", async (t) => {
  const { db } = await fixture(t);
  const now = new Date("2026-11-08T12:00:00Z");
  const gap = market(db);
  const bet = proposeBet(db, config, { ...base, gap: gap.id, lever: "paid", learning: true, capMoneyUsd: 50, killAt: day(now.toISOString(), 14).toISOString() }, { now });
  startBet(db, bet.id, { now });
  const spend = { betId: bet.id, kind: "money_usd", amount: 20, note: "Day 1 budget", channel: "meta-ads", account: "brand", by: "cmo" };
  assert.throws(() => recordCost(db, spend, { now }), { code: "not_authorized" });
  await assert.rejects(
    addGrant(db, { kind: "spend", channel: "meta-ads", account: "brand", maxPerDay: 1, timezone: "UTC", pauseAfterFailures: 1, expiresAt: "2027-01-01", statement: "Ad test" }, { confirm: yes, now }),
    /cap-usd/,
  );
  await addGrant(db, { kind: "spend", capUsd: 30, channel: "meta-ads", account: "brand", maxPerDay: 1, timezone: "UTC", pauseAfterFailures: 1, expiresAt: "2027-01-01", statement: "Ad test" }, { confirm: yes, now });
  assert.deepEqual(recordCost(db, spend, { now }).spent.money_usd, 20);
  assert.throws(() => recordCost(db, spend, { now: day(now.toISOString(), 1) }), { code: "spend_cap" });
  assert.throws(() => recordCost(db, { ...spend, amount: 5 }, { now }), { code: "daily_cap" });
  // Time and agent spend are recorded after the fact and flagged, not refused.
  const over = recordCost(db, { betId: bet.id, kind: "owner_minutes", amount: 45, note: "Set up the ad account", by: "cmo" }, { now });
  assert.deepEqual(over.overCap, ["owner_minutes"]);
  // A posting grant never stands in for a spend grant.
  await addGrant(db, { channel: "meta-ads", account: "other", maxPerDay: 1, timezone: "UTC", pauseAfterFailures: 1, expiresAt: "2027-01-01", statement: "Posts" }, { confirm: yes, now });
  assert.throws(() => recordCost(db, { ...spend, account: "other" }, { now }), { code: "not_authorized" });
});

test("tasks belong to open bets; agent replies need a reply grant, a live link and the daily cap", async (t) => {
  const { db, brand } = await fixture(t);
  const now = new Date("2026-11-08T12:00:00Z");
  const gap = market(db);
  assert.throws(() => addTask(db, { betId: "bet_none", kind: "post", title: "x", executor: "agent", by: "cmo" }), /Every task belongs to a bet/);
  const bet = proposeBet(db, config, { ...base, lever: "community", gap: gap.id, killAt: day(now.toISOString(), 14).toISOString() }, { now });
  startBet(db, bet.id, { now });
  const reply = { betId: bet.id, kind: "reply", title: "Answer the thread", executor: "agent", channel: "threads", account: "sample", by: "community-scout" };
  assert.throws(() => addTask(db, reply, { now }), { code: "not_authorized" });
  // A post grant does not cover replies.
  await addGrant(db, { channel: "threads", account: "sample", maxPerDay: 1, timezone: "UTC", pauseAfterFailures: 1, expiresAt: "2027-01-01", statement: "Posts" }, { confirm: yes, now });
  assert.throws(() => addTask(db, reply, { now }), { code: "not_authorized" });
  await addGrant(db, { kind: "reply", channel: "threads", account: "sample", maxPerDay: 1, timezone: "UTC", pauseAfterFailures: 1, expiresAt: "2027-01-01", statement: "Replies" }, { confirm: yes, now });
  const first = addTask(db, reply, { now });
  // The cap is enforced when the slot is reserved, before anything is posted.
  assert.throws(() => addTask(db, reply, { now }), { code: "daily_cap" });
  assert.throws(() => closeTask(db, first.id, { result: "sent it" }, { now }), /live https link/);
  assert.throws(() => closeTask(db, first.id, { dropped: true }, { now }), /why/);
  assert.equal(closeTask(db, first.id, { dropped: true, result: "Thread was locked." }, { now }).status, "dropped");
  // A dropped reservation frees its slot.
  const second = addTask(db, reply, { now });
  assert.equal(closeTask(db, second.id, { result: "https://threads.test/post/2" }, { now }).status, "done");
  assert.throws(() => addTask(db, reply, { now }), { code: "daily_cap" });
  assert.equal(addTask(db, reply, { now: day(now.toISOString(), 1) }).status, "open");
  // The same public link cannot be counted as two shipped items.
  const listing = addTask(db, { betId: bet.id, kind: "listing", title: "Directory", executor: "agent", by: "cmo" }, { now });
  assert.throws(() => closeTask(db, listing.id, { result: "https://threads.test/post/2" }, { now }), /already recorded/);
  assert.throws(() => closeTask(db, listing.id, { result: "Drafted it" }, { now }), /live https link/);
  // Posts can be attached to an open bet, never to a closed one.
  const action = await propose(db, brand, { channel: "threads", account: "sample", hypothesis: "h", text: "hi", betId: bet.id });
  assert.equal(action.betId, bet.id);
});

test("the funnel finds the constraint from trust first, then share of target", async (t) => {
  const { db } = await fixture(t);
  const now = new Date("2026-11-08T00:00:00Z");
  readings(db, "visits", "2026-11-01T00:00:00Z", [40, 40, 40, 40, 40, 40, 40]);
  readings(db, "starters", "2026-11-01T00:00:00Z", [1, 1, 2, 1, 1, 1, 1]);
  let view = funnelView(db, config, now);
  assert.equal(view.constraint.stage, "first_use");
  assert.equal(view.stages[0].share, 0.8);
  assert.equal(view.stages[1].trust, "unverified");
  recordCheck(db, { metric: "visits", state: "broken", note: "Bot traffic inflates the count.", by: "analyst" }, { now });
  view = funnelView(db, config, now);
  assert.deepEqual([view.constraint.stage, view.constraint.reason], ["visit", "broken_metric"]);
  assert.throws(() => recordCheck(db, { metric: "visits", state: "verified", note: "ok", by: "analyst" }), /how the metric was checked/);
});
