import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { fixture } from "./fixture.mjs";

const cli = fileURLToPath(new URL("../cli.mjs", import.meta.url));

// Runs the real CLI the way a scheduled agent does: as a subprocess with no
// terminal attached.
async function engine(root, ...args) {
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", cli, ...args, "--root", root, "--brand", "sample"],
      { stdio: "pipe" },
    );
    return { ok: true, data: JSON.parse(stdout) };
  } catch (failure) {
    return { ok: false, error: JSON.parse(failure.stderr).error };
  }
}

test("an agent without a terminal cannot grant or approve", async (t) => {
  const { root } = await fixture(t);
  const grant = await engine(
    root, "grant", "--channel", "threads", "--account", "sample", "--max-per-day", "1",
    "--timezone", "UTC", "--pause-after-failures", "2", "--expires", "2099-01-01",
    "--statement", "agent-written",
  );
  assert.equal(grant.error.code, "owner_terminal_required");
  const action = await engine(
    root, "propose", "--channel", "threads", "--account", "sample",
    "--hypothesis", "h", "--text", "hello",
  );
  assert.equal((await engine(root, "approve", action.data.id)).error.code, "owner_terminal_required");
  assert.equal((await engine(root, "publish", action.data.id)).error.code, "no_adapter");
});

test("manual handoff, receipt, observation and decision round-trip through the CLI", async (t) => {
  const { root } = await fixture(t);
  // Stands in for a grant the owner typed at a terminal: the CLI rightly
  // refuses to create one without a TTY, so the test writes it directly.
  const { openStore } = await import("../store.mjs");
  const { join } = await import("node:path");
  const db = openStore(join(root, "brands/sample/.state/engine.sqlite"));
  db.prepare(
    `INSERT INTO grants (channel, account, max_per_day, timezone, pause_after_failures,
       expires_at, statement, authorized_via, created_at)
     VALUES ('threads', 'sample', 1, 'UTC', 2, '2099-01-01T00:00:00.000Z', 'test', 'test', ?)`,
  ).run(new Date().toISOString());
  db.close();

  const action = await engine(
    root, "propose", "--channel", "threads", "--account", "sample",
    "--hypothesis", "A first-step hook earns replies.", "--text", "Start with one task.",
    "--asset", "work/post.png",
  );
  assert.equal(action.data.assets[0].path, "work/post.png");
  assert.equal((await engine(root, "publish", action.data.id, "--via", "manual")).data.status, "handoff");
  assert.equal((await engine(root, "status")).data.unresolved[0].status, "handoff");
  const receipt = await engine(
    root, "receipt", action.data.id, "--url", "https://www.threads.com/@sample/post/x1",
  );
  assert.equal(receipt.data.status, "delivered");

  const reading = await engine(
    root, "observe", "--metric", "active_users", "--value", "unavailable", "--unit", "users",
    "--from", "2026-11-01T00:00:00Z", "--to", "2026-11-02T00:00:00Z", "--source", "mixpanel",
  );
  assert.equal(reading.data.value, null);
  const empty = await engine(
    root, "observe", "--metric", "views", "--value", "", "--unit", "count",
    "--from", "2026-11-01T00:00:00Z", "--to", "2026-11-02T00:00:00Z", "--source", "threads",
  );
  assert.equal(empty.error.code, "invalid_observation");
  const decision = await engine(
    root, "decide", "--verdict", "wait", "--rationale", "No usable metric yet.",
    "--evidence", String(reading.data.id),
  );
  assert.equal(decision.data.verdict, "wait");

  const view = (await engine(root, "status")).data;
  assert.equal(view.unresolved.length, 0);
  assert.equal(view.recentDeliveries[0].url, "https://www.threads.com/@sample/post/x1");
  assert.equal(view.grants[0].usedToday, 1);
});
