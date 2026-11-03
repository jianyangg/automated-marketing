import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { addGrant } from "../authority.mjs";
import { propose } from "../actions.mjs";
import { publish } from "../delivery.mjs";
import { decide } from "../learning.mjs";
import { pull } from "../pull.mjs";
import { status } from "../status.mjs";
import { parseConfig } from "../config.mjs";
import { writeBrief, writeSnapshot, nextAction, BRIEF_LIMIT, GENERATED_MARK } from "../brief.mjs";
import { importReceipts } from "../imports.mjs";
import { startOfDay, addDays } from "../store.mjs";
import { parseIndex } from "../../dashboard/index-model.mjs";
import { fixture, fakeAdapter, yes, standingGrant } from "./fixture.mjs";

const config = parseConfig({
  name: "Sample",
  goal: "More active users",
  northStar: "active_users",
  channels: { threads: { account: "sample", secret: "sample/threads" } },
  metrics: [
    {
      name: "active_users",
      provider: "mixpanel",
      event: "task_started",
      type: "unique",
      projectId: 1,
      region: "us",
      timezone: "America/New_York",
      secret: "sample/mixpanel",
    },
  ],
});

const fakeReader = (counts) => ({ daily: async () => counts });

test("day windows follow the metric's time zone across daylight saving", () => {
  assert.equal(startOfDay("2026-11-01", "America/New_York").toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(startOfDay("2026-11-02", "America/New_York").toISOString(), "2026-11-02T05:00:00.000Z");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("config rejects guesses: unknown channels, missing time zones, a dangling north star", () => {
  assert.throws(() => parseConfig({ channels: { tiktok: { account: "a", secret: "s" } } }), { code: "invalid_config" });
  const metric = { ...config.metrics[0] };
  delete metric.timezone;
  assert.throws(() => parseConfig({ metrics: [metric] }), /timezone/);
  assert.throws(() => parseConfig({ northStar: "revenue" }), /northStar/);
  assert.deepEqual(parseConfig(undefined).channels, {});
  const borrowed = { channels: { threads: { account: "a", secret: "otherbrand/threads" } } };
  assert.throws(() => parseConfig(borrowed, { brand: "sample" }), /must start with "sample\/"/);
  assert.equal(parseConfig({ channels: { threads: { account: "a", secret: "sample/threads" } } }, { brand: "sample" }).channels.threads.account, "a");
});

test("pull saves daily readings, keeps unreported days unknown, and lets new numbers revise old ones", async (t) => {
  const ctx = await fixture(t);
  const now = new Date("2026-11-03T15:00:00Z");
  const first = await pull(ctx.db, {
    config,
    adapters: {},
    readers: { mixpanel: fakeReader({ "2026-11-01": 4 }) },
    now,
    days: 2,
  });
  assert.deepEqual(first, { saved: 2, errors: [] });
  const readings = () =>
    ctx.db.prepare("SELECT value, window_start FROM observations WHERE is_current = 1 ORDER BY window_start").all();
  assert.deepEqual(readings().map((row) => row.value), [4, null]);
  assert.equal(readings()[0].window_start, "2026-11-01T04:00:00.000Z");
  // Late data arrives: Nov 1 is revised and Nov 2 becomes known. A later
  // failed read (missing day) must not wipe out the measured value.
  await pull(ctx.db, { config, adapters: {}, readers: { mixpanel: fakeReader({ "2026-11-01": 5, "2026-11-02": 0 }) }, now, days: 2 });
  await pull(ctx.db, { config, adapters: {}, readers: { mixpanel: fakeReader({}) }, now, days: 2 });
  assert.deepEqual(readings().map((row) => row.value), [5, 0]);
});

test("one failing source does not stop the others, and the failure is reported", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, standingGrant, { confirm: yes });
  const action = await propose(ctx.db, ctx.brand, { channel: "threads", account: "sample", hypothesis: "h", text: "t" });
  const threads = fakeAdapter(() => ({ state: "delivered", providerId: "m1", url: "https://p" }));
  threads.postInsights = async () => {
    throw new Error("token expired");
  };
  await publish(ctx.db, ctx.brand, action.id, { adapters: { threads } });
  const result = await pull(ctx.db, {
    config,
    adapters: { threads },
    readers: { mixpanel: fakeReader({ "2026-11-02": 2 }) },
    now: new Date("2026-11-03T15:00:00Z"),
    days: 1,
  });
  assert.equal(result.saved, 1);
  assert.equal(result.errors[0].message, "token expired");
});

test("status compares average daily north star, and groups results by tagged variable", async (t) => {
  const ctx = await fixture(t);
  const now = new Date("2026-11-15T15:00:00Z");
  const counts = {};
  for (let day = 1; day <= 14; day++) counts[`2026-11-${String(day).padStart(2, "0")}`] = day <= 7 ? 2 : 4;
  delete counts["2026-11-10"];
  await pull(ctx.db, { config, adapters: {}, readers: { mixpanel: fakeReader(counts) }, now, days: 14 });

  await addGrant(ctx.db, { ...standingGrant, maxPerDay: 5 }, { confirm: yes, now: new Date("2026-11-01T00:00:00Z") });
  let n = 0;
  const threads = fakeAdapter(() => ({ state: "delivered", providerId: `m${++n}`, url: `https://p/${n}` }));
  const views = { m1: 10, m2: 30, m3: 3 };
  threads.postInsights = async (id) => ({ views: views[id] });
  for (const variable of ["hook=question", "hook=question", "hook=statement"]) {
    const action = await propose(ctx.db, ctx.brand, { channel: "threads", account: "sample", hypothesis: "h", text: variable + n, variable });
    await publish(ctx.db, ctx.brand, action.id, { adapters: { threads }, now: new Date("2026-11-14T15:00:00Z") });
  }
  await pull(ctx.db, { config: { ...config, metrics: [] }, adapters: { threads }, readers: {}, now });

  const view = status(ctx.db, { now, config });
  assert.deepEqual(view.northStar.last7, { averagePerDay: 4, knownDays: 6 });
  assert.deepEqual(view.northStar.prior7, { averagePerDay: 2, knownDays: 7 });
  const question = view.experiments.find((group) => group.variable === "hook=question");
  assert.deepEqual(question, { channel: "threads", variable: "hook=question", posts: 2, postsWithViews: 2, medianViews: 20 });
  await assert.rejects(
    propose(ctx.db, ctx.brand, { channel: "threads", account: "sample", hypothesis: "h", text: "x", variable: "two words" }),
    { code: "invalid_action" },
  );
});

test("next action follows a fixed order of urgency", () => {
  const base = { unresolved: [], grants: [], proposed: [] };
  assert.match(nextAction({ ...base, unresolved: [{ id: 1, status: "unknown" }] }, config), /Reconcile delivery 1/);
  assert.match(nextAction(base, { ...config, channels: {} }), /configure a publishing channel/);
  assert.match(nextAction(base, config), /Owner: grant/);
  const open = [{ channel: "threads", usedToday: 0, maxPerDay: 1 }];
  assert.match(nextAction({ ...base, grants: open }, config), /Propose today's threads post/);
  assert.match(nextAction({ ...base, grants: open, proposed: [{ id: "a1", channel: "threads" }] }, config), /Publish a1/);
  assert.match(nextAction({ ...base, grants: [{ ...open[0], usedToday: 1 }] }, config), /Pull results/);
});

test("the generated brief stays small, archives a hand-written one, and still parses in the dashboard", async (t) => {
  const ctx = await fixture(t);
  await writeFile(join(ctx.brand, "index.md"), "# Old brief\n\n" + "history ".repeat(5000));
  const view = status(ctx.db, { now: new Date("2026-11-03T15:00:00Z"), config });
  await assert.rejects(writeBrief(ctx.brand, view, config), { code: "manual_brief" });
  const written = await writeBrief(ctx.brand, view, config, { replaceManual: true });
  assert.equal(written.archived, "reports/archive/index-2026-11-03.md");
  assert.match(await readFile(join(ctx.brand, written.archived), "utf8"), /^# Old brief/);
  const brief = await readFile(join(ctx.brand, "index.md"), "utf8");
  assert.ok(brief.includes(GENERATED_MARK));
  assert.ok(Buffer.byteLength(brief) <= BRIEF_LIMIT);
  const parsed = parseIndex(brief, "sample");
  assert.equal(parsed.goal, "More active users");
  assert.match(parsed.nextAction, /Owner: grant/);
  assert.ok(parsed.attention.some((item) => /No publishing grant|No active publishing grant/.test(item)));
  assert.equal(parsed.work[0].source, written.archived);
  // Regenerating over a generated brief needs no flag and archives nothing.
  assert.equal((await writeBrief(ctx.brand, view, config)).archived, null);
});

test("the dashboard snapshot keeps unknown days as gaps", async (t) => {
  const ctx = await fixture(t);
  const now = new Date("2026-11-03T15:00:00Z");
  await pull(ctx.db, { config, adapters: {}, readers: { mixpanel: fakeReader({ "2026-11-01": 3 }) }, now, days: 2 });
  await writeSnapshot(ctx.db, ctx.brand, config, now);
  const snapshot = JSON.parse(await readFile(join(ctx.brand, "reports/engine-snapshot.json"), "utf8"));
  assert.deepEqual(snapshot.metrics.active_users.daily, [
    { date: "2026-11-01", value: 3 },
    { date: "2026-11-02", value: null },
  ]);
  assert.equal(snapshot.metrics.active_users.latest, 3);
});

test("imports use the provider's exact time, never a guess, and are idempotent", async (t) => {
  const ctx = await fixture(t);
  const threads = {
    media: async (id) => ({ providerId: id, url: `https://www.threads.com/p/${id}`, publishedAt: "2026-10-29T23:42:54.000Z" }),
  };
  const entries = [
    { channel: "threads", account: "sample", text: "Book post", hypothesis: "h", assets: ["work/post.png"], providerId: "181" },
  ];
  const options = { adapters: { threads }, timezone: "America/New_York" };
  const [imported] = await importReceipts(ctx.db, ctx.brand, entries, options);
  assert.equal(imported.deliveredAt, "2026-10-29T23:42:54.000Z");
  const row = ctx.db.prepare("SELECT status, local_date, url FROM deliveries").get();
  assert.deepEqual({ ...row }, { status: "delivered", local_date: "2026-10-29", url: "https://www.threads.com/p/181" });
  assert.equal((await importReceipts(ctx.db, ctx.brand, entries, options))[0].skipped, "already imported");
  assert.equal(status(ctx.db).proposed.length, 0);
  await assert.rejects(
    importReceipts(ctx.db, ctx.brand, [{ ...entries[0], providerId: "182", deliveredAt: "2026-10-29 19:42:54" }], options),
    { code: "invalid_import" },
  );
  await assert.rejects(importReceipts(ctx.db, ctx.brand, [{ ...entries[0], providerId: "183" }], { ...options, adapters: {} }), {
    code: "invalid_import",
  });
  assert.equal(ctx.db.prepare("SELECT count(*) AS n FROM actions").get().n, 1);
});

test("a URL-only import is resolved through the account feed, and the live text wins", async (t) => {
  const ctx = await fixture(t);
  const threads = {
    findByPermalink: async (url) =>
      url.endsWith("/Deo9") ? { providerId: "171", url, text: "What went live", publishedAt: "2026-10-18T13:00:00.000Z" } : null,
  };
  const options = { adapters: { threads }, timezone: "America/New_York" };
  const base = { channel: "threads", account: "sample", hypothesis: "Imported historical post" };
  const results = await importReceipts(
    ctx.db,
    ctx.brand,
    [
      { ...base, url: "https://www.threads.com/@sample/post/Deo9", text: "Draft copy" },
      { ...base, url: "https://www.threads.com/@sample/post/gone" },
    ],
    options,
  );
  assert.equal(results[0].providerId, "171");
  assert.match(results[0].textMismatch, /live text was recorded/);
  assert.deepEqual(results[1], { url: "https://www.threads.com/@sample/post/gone", skipped: "not found on the account" });
  const action = ctx.db.prepare("SELECT payload FROM actions").get();
  assert.equal(JSON.parse(action.payload).text, "What went live");
  await assert.rejects(importReceipts(ctx.db, ctx.brand, [{ ...base }], options), /providerId or url/);
});

test("decisions can be recorded with no evidence only as an explicit wait", async (t) => {
  const ctx = await fixture(t);
  assert.equal(decide(ctx.db, { verdict: "wait", rationale: "Metric not connected yet." }).evidence.length, 0);
  assert.throws(() => decide(ctx.db, { verdict: "change", rationale: "Feels stale." }), { code: "invalid_decision" });
});
