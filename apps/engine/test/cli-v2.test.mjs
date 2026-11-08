import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fixture } from "./fixture.mjs";

const cli = fileURLToPath(new URL("../cli.mjs", import.meta.url));

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

const engineJson = {
  name: "Sample",
  goal: "More active users",
  northStar: "starters",
  metrics: [
    { name: "visits", provider: "manual", unit: "visits", timezone: "UTC" },
    { name: "starters", provider: "manual", unit: "users", timezone: "UTC" },
  ],
  funnel: [
    { stage: "visit", metric: "visits", target: 50 },
    { stage: "first_use", metric: "starters", target: 10 },
  ],
};

test("the bet loop runs end to end through the CLI, and owner-only grants stay owner-only", async (t) => {
  const { root, brand } = await fixture(t);
  await writeFile(join(brand, "engine.json"), JSON.stringify(engineJson));
  const by = ["--by", "cmo"];

  let agenda = await engine(root, "agenda");
  assert.equal(agenda.data[0].kind, "verify");

  const trust = await engine(root, "trust", "--metric", "visits", "--state", "verified", "--note", "Matched server logs for a week.", ...by);
  assert.equal(trust.data.state, "verified");
  assert.equal((await engine(root, "situation", "add", "--id", "long-list", "--name", "Long list", "--trigger", "Too much to pick", "--alternatives", "Paper", ...by)).ok, true);
  const signal = await engine(root, "signal", "add", "--kind", "public_complaint", "--text", "Too many tasks", "--source-url", "https://forum.test/t/1", "--situation", "long-list", ...by);
  const gap = await engine(root, "gap", "add", "--kind", "channel", "--statement", "Absent from roundups", "--signals", String(signal.data.id), ...by);
  assert.equal((await engine(root, "gap", "add", "--kind", "channel", "--statement", "x", "--signals", "1,two", ...by)).error.code, "usage");

  const killAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const bet = await engine(
    root, "bet", "propose", "--title", "Two directory listings", "--hypothesis", "Alternative searches send visits.",
    "--risk", "Directories send nobody.", "--lever", "listing", "--funnel-stage", "visit", "--threshold", "20",
    "--min-known-days", "5", "--kill-at", killAt, "--cap-money-usd", "0", "--cap-agent-usd", "5",
    "--cap-owner-minutes", "30", "--situation", "long-list", "--gap", String(gap.data.id), "--tactic", "directory-listings", ...by,
  );
  assert.equal(bet.ok, true, JSON.stringify(bet.error));
  assert.equal((await engine(root, "bet", "start", bet.data.id)).data.status, "running");
  const task = await engine(root, "task", "add", "--bet", bet.data.id, "--kind", "listing", "--title", "Submit listing", "--executor", "agent", ...by);
  assert.equal((await engine(root, "task", "done", String(task.data.id), "--result", "https://directory.test/listing/42")).data.status, "done");
  assert.equal((await engine(root, "cost", "--bet", bet.data.id, "--kind", "agent_usd", "--amount", "1.5", "--note", "Drafting", ...by)).data.spent.agent_usd, 1.5);
  // Money needs a spend grant, which only the owner can create at a terminal.
  assert.equal((await engine(root, "cost", "--bet", bet.data.id, "--kind", "money_usd", "--amount", "5", "--note", "Ad", "--channel", "meta-ads", "--account", "x", ...by)).error.code, "not_authorized");
  const grant = await engine(root, "grant", "--kind", "spend", "--cap-usd", "100", "--channel", "meta-ads", "--account", "x", "--max-per-day", "1", "--timezone", "UTC", "--pause-after-failures", "1", "--expires", "2099-01-01", "--statement", "agent-written");
  assert.equal(grant.error.code, "owner_terminal_required");

  const status = await engine(root, "status");
  assert.equal(status.data.bets[0].id, bet.data.id);
  assert.equal(status.data.funnel.stages[0].trust, "verified");
  const card = await engine(root, "scorecard");
  assert.equal(card.data.bets.running, 1);
  const all = await engine(root, "scorecard", "--all");
  assert.deepEqual(all.data.map((row) => row.brand), ["sample"]);
  const ranked = await engine(root, "playbook", "--rank", "--lever", "listing");
  assert.ok(ranked.data.length > 0 && ranked.data.every((row) => row.lever === "listing"));
  assert.equal((await engine(root, "stage")).data.stage, "finding-fit");
  assert.equal((await engine(root, "bet", "close", bet.data.id, "--verdict", "keep", "--rationale", "Early.", ...by)).error.code, "invalid_close");
  const brief = await engine(root, "brief");
  assert.equal(brief.ok, true, JSON.stringify(brief.error));
});
