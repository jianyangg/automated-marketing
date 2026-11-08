import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../store.mjs";
import { parseConfig } from "../config.mjs";
import { addGrant } from "../authority.mjs";
import { observe } from "../learning.mjs";
import { proposeBet, startBet, closeBet, extendBet, getBet, addTask, recordCost } from "../bets.mjs";
import { dailyAverage, funnelView, recordCheck } from "../funnel.mjs";
import { addSignal, recordVisibility, addCompetitor, watchCompetitors } from "../market.mjs";
import { isPublicAddress, fetchPublicPage, publicGet } from "../public-fetch.mjs";
import { inbox } from "../agenda.mjs";
import { config, readings, market, day } from "./funnel-fixture.mjs";
import { fixture, yes } from "./fixture.mjs";

// One test per defect found in review, so each stays fixed.

const bet = (gap, over = {}) => ({
  title: "Listings",
  hypothesis: "h",
  risk: "r",
  lever: "listing",
  funnelStage: "visit",
  threshold: 20,
  minKnownDays: 1,
  capMoneyUsd: 0,
  capAgentUsd: 5,
  capOwnerMinutes: 30,
  situation: "long-list",
  gap: gap.id,
  by: "cmo",
  ...over,
});

test("a v2 state file upgrades in place, keeping its rows, even when two processes open it at once", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "engine-migrate-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "engine.sqlite");
  // Build a file exactly as schema v2 left it: v1 tables plus actions.variable.
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE grants (id INTEGER PRIMARY KEY, channel TEXT NOT NULL, account TEXT NOT NULL,
      max_per_day INTEGER NOT NULL, timezone TEXT NOT NULL, pause_after_failures INTEGER NOT NULL,
      expires_at TEXT NOT NULL, statement TEXT NOT NULL, authorized_via TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);
    CREATE TABLE actions (id TEXT PRIMARY KEY, channel TEXT NOT NULL, account TEXT NOT NULL, hypothesis TEXT NOT NULL,
      payload TEXT NOT NULL, content_hash TEXT NOT NULL, created_at TEXT NOT NULL, approved_hash TEXT, approved_at TEXT,
      approved_via TEXT, variable TEXT);
    CREATE TABLE deliveries (id INTEGER PRIMARY KEY, action_id TEXT NOT NULL REFERENCES actions(id), grant_id INTEGER,
      channel TEXT NOT NULL, account TEXT NOT NULL, status TEXT NOT NULL, local_date TEXT NOT NULL, attempted_at TEXT NOT NULL,
      settled_at TEXT, provider_id TEXT, url TEXT, error TEXT);
    CREATE TABLE observations (id INTEGER PRIMARY KEY, metric TEXT NOT NULL, value REAL, unit TEXT NOT NULL,
      window_start TEXT NOT NULL, window_end TEXT NOT NULL, source TEXT NOT NULL, action_id TEXT, note TEXT,
      observed_at TEXT NOT NULL, supersedes INTEGER, is_current INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE decisions (id INTEGER PRIMARY KEY, action_id TEXT, verdict TEXT NOT NULL, rationale TEXT NOT NULL,
      evidence TEXT NOT NULL, review_at TEXT, decided_at TEXT NOT NULL);
    INSERT INTO grants VALUES (1, 'threads', 'a', 1, 'UTC', 1, '2099-01-01', 's', 'owner-terminal', '2026-11-01', NULL);
    INSERT INTO decisions VALUES (1, NULL, 'wait', 'old', '[]', NULL, '2026-11-01');
    PRAGMA user_version = 2;`);
  old.close();
  // Two processes racing to open the same old file must both succeed.
  const script = `import { openStore } from ${JSON.stringify(new URL("../store.mjs", import.meta.url).href)};
    openStore(${JSON.stringify(path)}).close();`;
  const run = () => promisify(execFile)(process.execPath, ["--disable-warning=ExperimentalWarning", "--input-type=module", "-e", script]);
  await Promise.all([run(), run(), run()]);
  const db = openStore(path);
  t.after(() => db.close());
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 3);
  assert.equal(db.prepare("SELECT kind FROM grants WHERE id = 1").get().kind, "post");
  assert.equal(db.prepare("SELECT overridden FROM decisions WHERE id = 1").get().overridden, 0);
});

test("a bet is credited only with whole days after it started; weekly and duplicate readings are not days", async (t) => {
  const { db } = await fixture(t);
  const gap = market(db);
  // The day of Nov 1 hit the threshold, but the bet only started at 22:00.
  readings(db, "visits", "2026-11-01T00:00:00Z", [50]);
  const late = new Date("2026-11-01T22:00:00Z");
  const b = proposeBet(db, config, bet(gap, { killAt: day(late.toISOString(), 7).toISOString() }), { now: late });
  startBet(db, b.id, { now: late });
  assert.equal(getBet(db, b.id, new Date("2026-11-02T09:00:00Z")).score.knownDays, 0);
  // A week-long manual total is not a day, and a second source for the same
  // day is not a second day.
  observe(db, { metric: "visits", value: 140, unit: "visits", from: "2026-11-02T00:00:00Z", to: "2026-11-09T00:00:00Z", source: "weekly" });
  readings(db, "visits", "2026-11-02T00:00:00Z", [10]);
  observe(db, { metric: "visits", value: 12, unit: "visits", from: "2026-11-02T00:00:00Z", to: "2026-11-03T00:00:00Z", source: "second-source" });
  const window = dailyAverage(db, "visits", "2026-11-02T00:00:00Z", "2026-11-09T00:00:00Z");
  assert.deepEqual([window.knownDays, window.averagePerDay], [1, 12]);
});

test("closing a bet drops its open tasks, so they leave the owner's inbox", async (t) => {
  const { db } = await fixture(t);
  const gap = market(db);
  const now = new Date("2026-11-01T00:00:00Z");
  const b = proposeBet(db, config, bet(gap, { killAt: day(now.toISOString(), 7).toISOString() }), { now });
  startBet(db, b.id, { now });
  addTask(db, { betId: b.id, kind: "other", title: "Send five emails", executor: "owner", by: "cmo" }, { now });
  assert.equal(inbox(db, now).length, 1);
  const evidence = readings(db, "visits", "2026-11-01T00:00:00Z", [3, 4, 3, 2, 3, 4, 3]);
  closeBet(db, b.id, { verdict: "stop", rationale: "3 a day against 20.", evidence, by: "cmo" }, { now: day(now.toISOString(), 8) });
  assert.equal(inbox(db, day(now.toISOString(), 8)).length, 0);
  assert.equal(db.prepare("SELECT status FROM tasks").get().status, "dropped");
});

test("an extension must land in the future", async (t) => {
  const { db } = await fixture(t);
  const gap = market(db);
  const start = new Date("2026-09-01T00:00:00Z");
  const b = proposeBet(db, config, bet(gap, { minKnownDays: 5, killAt: day(start.toISOString(), 10).toISOString() }), { now: start });
  startBet(db, b.id, { now: start });
  const later = day(start.toISOString(), 60);
  assert.throws(() => extendBet(db, b.id, { to: day(start.toISOString(), 30).toISOString(), reason: "Late data." }, { now: later }), /in the future/);
});

test("spend caps compare whole cents", async (t) => {
  const { db } = await fixture(t);
  const gap = market(db);
  const now = new Date("2026-11-08T00:00:00Z");
  const b = proposeBet(db, config, bet(gap, { lever: "paid", learning: true, capMoneyUsd: 0.3, killAt: day(now.toISOString(), 7).toISOString() }), { now });
  startBet(db, b.id, { now });
  await addGrant(db, { kind: "spend", capUsd: 0.3, channel: "ads", account: "a", maxPerDay: 5, timezone: "UTC", pauseAfterFailures: 1, expiresAt: "2027-01-01", statement: "s" }, { confirm: yes, now });
  const spend = (amount) => recordCost(db, { betId: b.id, kind: "money_usd", amount, note: "n", channel: "ads", account: "a", by: "cmo" }, { now });
  spend(0.1);
  assert.equal(spend(0.2).spent.money_usd, 0.3);
  assert.throws(() => spend(0.01), { code: "spend_cap" });
});

test("links are parsed on entry, so a stored link can always be read back", async (t) => {
  const { db } = await fixture(t);
  assert.throws(() => addSignal(db, { kind: "public_complaint", text: "x", sourceUrl: "https://[", by: "r" }), /https link/);
  assert.throws(() => recordVisibility(db, { prompt: "p", assistant: "a", mentioned: "no", citations: ["https://["], by: "r" }), /https link/);
});

test("config accepts an empty economics block; 99.6% of target is not on target", async (t) => {
  assert.equal(parseConfig({ economics: {} }).economics.valuePerUnitUsd, null);
  const { db } = await fixture(t);
  readings(db, "visits", "2026-11-01T00:00:00Z", Array(7).fill(49.8));
  readings(db, "starters", "2026-11-01T00:00:00Z", Array(7).fill(12));
  recordCheck(db, { metric: "visits", state: "verified", note: "Matched server logs." , by: "analyst" });
  const view = funnelView(db, config, new Date("2026-11-08T00:00:00Z"));
  assert.equal(view.stages[0].share, 1);
  assert.equal(view.constraint.stage, "visit");
});

test("a broken engine.json does not block revoking, withdrawing or reading", async (t) => {
  const { root, brand } = await fixture(t);
  await writeFile(join(brand, "engine.json"), "{ not json");
  const cli = fileURLToPath(new URL("../cli.mjs", import.meta.url));
  const run = async (...args) => {
    try {
      const { stdout } = await promisify(execFile)(process.execPath, ["--disable-warning=ExperimentalWarning", cli, ...args, "--root", root, "--brand", "sample"]);
      return JSON.parse(stdout);
    } catch (failure) {
      return JSON.parse(failure.stderr);
    }
  };
  const action = await run("propose", "--channel", "threads", "--account", "sample", "--hypothesis", "h", "--text", "hi");
  assert.equal((await run("withdraw", action.id, "--reason", "Not needed.")).withdrawn, true);
  assert.equal((await run("show", action.id)).id, action.id);
  assert.deepEqual(await run("inbox"), []);
  assert.equal((await run("status")).error.code, "invalid_config");
});

test("two processes adding agent replies at once cannot both take the last slot", async (t) => {
  const { db, brand } = await fixture(t);
  const gap = market(db);
  const now = new Date();
  const b = proposeBet(db, config, bet(gap, { lever: "community", killAt: day(now.toISOString(), 7).toISOString() }), { now });
  startBet(db, b.id, { now });
  await addGrant(db, { kind: "reply", channel: "threads", account: "sample", maxPerDay: 1, timezone: "UTC", pauseAfterFailures: 1, expiresAt: "2099-01-01", statement: "Replies" }, { confirm: yes, now });
  const script = `import { openStore } from ${JSON.stringify(new URL("../store.mjs", import.meta.url).href)};
    import { addTask } from ${JSON.stringify(new URL("../bets.mjs", import.meta.url).href)};
    const db = openStore(${JSON.stringify(join(brand, ".state", "engine.sqlite"))});
    try {
      addTask(db, { betId: ${JSON.stringify(b.id)}, kind: "reply", title: "Answer", executor: "agent", channel: "threads", account: "sample", by: "community-scout" });
      console.log("reserved");
    } catch (error) {
      console.log(error.code);
    } finally {
      db.close();
    }`;
  const run = () => promisify(execFile)(process.execPath, ["--disable-warning=ExperimentalWarning", "--input-type=module", "-e", script]);
  const outcomes = (await Promise.all([run(), run(), run(), run()])).map((r) => r.stdout.trim()).sort();
  assert.deepEqual(outcomes, ["daily_cap", "daily_cap", "daily_cap", "reserved"]);
});

test("competitor pages are fetched only from public https hosts, on every redirect hop", async (t) => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
    assert.equal(isPublicAddress(address), false, address);
  for (const address of ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]) assert.equal(isPublicAddress(address), true, address);

  const { db, brand } = await fixture(t);
  for (const url of ["https://127.0.0.1/", "https://[::1]/admin", "https://169.254.169.254/latest/meta-data/"])
    assert.throws(() => addCompetitor(db, { id: "bad", name: "Bad", urls: [url], by: "cmo" }), { code: "invalid_market" });

  // A public page that redirects somewhere unsafe is refused at that hop.
  const redirectTo = (location) => async (url) =>
    url === "https://rival.test/" ? { ok: false, status: 302, headers: { get: () => location }, text: async () => "" } : { ok: true, status: 200, text: async () => "secret" };
  for (const location of ["http://rival.test/", "https://127.0.0.1/", "https://[::1]/", "https://169.254.169.254/latest/meta-data/"])
    await assert.rejects(fetchPublicPage("https://rival.test/", { get: redirectTo(location) }), { code: "unsafe_url" }, location);
  // A relative redirect on the same public host is fine.
  assert.equal((await fetchPublicPage("https://rival.test/", { get: redirectTo("/pricing") })).status, 200);
  // The real socket path checks the resolved address: localhost never connects.
  await assert.rejects(publicGet("https://localhost/"), { code: "unsafe_url" });

  // And watch records the refusal as a failed check, saving nothing.
  addCompetitor(db, { id: "rival", name: "Rival", urls: ["https://rival.test/"], by: "cmo" });
  const [result] = await watchCompetitors(db, brand, { by: "competitor-watcher", get: redirectTo("https://192.168.1.1/") });
  assert.match(result.error, /not a public address/);
  assert.equal(result.path, undefined);
});
