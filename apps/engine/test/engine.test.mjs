import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { addGrant, revokeGrant, approveAction } from "../authority.mjs";
import { propose } from "../actions.mjs";
import {
  publish,
  reconcile,
  recordReceipt,
  DefiniteFailure,
} from "../delivery.mjs";
import { observe, decide } from "../learning.mjs";
import { status } from "../status.mjs";
import { manualAdapter } from "../adapters/manual.mjs";
import { fixture, fakeAdapter, yes, no, standingGrant } from "./fixture.mjs";

const at = (iso) => ({ now: new Date(iso) });
const delivered = (_request, n) => ({
  state: "delivered",
  providerId: `p${n}`,
  url: `https://example.test/p${n}`,
});

async function draft(ctx, text = "Pick one task.", extra = {}) {
  return propose(ctx.db, ctx.brand, {
    channel: "threads",
    account: "sample",
    text,
    assets: ["work/post.png"],
    hypothesis: "A concrete first step earns more replies than a feature list.",
    ...extra,
  });
}

test("nothing publishes without owner authority, and the agent cannot mint it", async (t) => {
  const ctx = await fixture(t);
  const action = await draft(ctx);
  const adapter = fakeAdapter(delivered);
  await assert.rejects(
    publish(ctx.db, ctx.brand, action.id, { adapters: { threads: adapter } }),
    { code: "not_authorized" },
  );
  await assert.rejects(addGrant(ctx.db, standingGrant, { confirm: no }), {
    code: "not_confirmed",
  });
  await assert.rejects(approveAction(ctx.db, action.id, { confirm: no }), {
    code: "not_confirmed",
  });
  assert.equal(adapter.calls.length, 0);
});

test("a standing grant publishes exactly once, even when asked twice", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, standingGrant, { confirm: yes, ...at("2026-11-02T12:00:00Z") });
  const action = await draft(ctx);
  const adapter = fakeAdapter(delivered);
  const options = { adapters: { threads: adapter }, ...at("2026-11-02T14:00:00Z") };
  const first = await publish(ctx.db, ctx.brand, action.id, options);
  const second = await publish(ctx.db, ctx.brand, action.id, options);
  assert.equal(first.status, "delivered");
  assert.equal(first.url, "https://example.test/p1");
  assert.deepEqual(second, first);
  assert.equal(adapter.calls.length, 1);
  assert.equal(adapter.calls[0].text, "Pick one task.");
  assert.equal(adapter.calls[0].assets[0].path, "work/post.png");
});

test("the daily cap follows the owner's time zone, not UTC", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, standingGrant, { confirm: yes, ...at("2026-11-01T12:00:00Z") });
  const adapter = fakeAdapter(delivered);
  const send = async (iso, text) =>
    publish(ctx.db, ctx.brand, (await draft(ctx, text)).id, {
      adapters: { threads: adapter },
      ...at(iso),
    });
  // 23:30 on Nov 1 in New York, then 00:30 on Nov 2: same UTC day, two local days.
  await send("2026-11-02T04:30:00Z", "late");
  await send("2026-11-02T05:30:00Z", "early");
  await assert.rejects(send("2026-11-02T20:00:00Z", "third"), { code: "daily_cap" });
  assert.equal(adapter.calls.length, 2);
});

test("changed content after proposal or approval is stale and never sent", async (t) => {
  const ctx = await fixture(t);
  const action = await draft(ctx);
  await approveAction(ctx.db, action.id, { confirm: yes });
  await writeFile(join(ctx.brand, "work/post.png"), "edited bytes");
  const adapter = fakeAdapter(delivered);
  await assert.rejects(
    publish(ctx.db, ctx.brand, action.id, { adapters: { threads: adapter } }),
    { code: "stale_content" },
  );
  assert.equal(adapter.calls.length, 0);
});

test("a one-off approval covers only that exact action", async (t) => {
  const ctx = await fixture(t);
  const approved = await draft(ctx, "approved");
  const other = await draft(ctx, "not approved");
  await approveAction(ctx.db, approved.id, { confirm: yes });
  const adapter = fakeAdapter(delivered);
  const options = { adapters: { threads: adapter } };
  assert.equal((await publish(ctx.db, ctx.brand, approved.id, options)).status, "delivered");
  await assert.rejects(publish(ctx.db, ctx.brand, other.id, options), {
    code: "not_authorized",
  });
});

test("an ambiguous provider error blocks the account until reconciled, without a blind retry", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, { ...standingGrant, maxPerDay: 5 }, { confirm: yes });
  const adapter = fakeAdapter(
    () => {
      throw new Error("socket hang up");
    },
    async () => ({ state: "delivered", providerId: "late", url: "https://example.test/late" }),
  );
  const options = { adapters: { threads: adapter } };
  const first = await draft(ctx, "first");
  assert.equal((await publish(ctx.db, ctx.brand, first.id, options)).status, "unknown");
  await assert.rejects(publish(ctx.db, ctx.brand, first.id, options), {
    code: "reconcile_required",
  });
  const next = await draft(ctx, "next");
  await assert.rejects(publish(ctx.db, ctx.brand, next.id, options), {
    code: "reconcile_required",
  });
  const settled = await reconcile(ctx.db, options);
  assert.equal(settled[0].status, "delivered");
  assert.equal(settled[0].url, "https://example.test/late");
  assert.equal(adapter.calls.length, 1);
});

test("definite failures allow a retry, and repeated failures pause the grant", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, { ...standingGrant, maxPerDay: 5 }, { confirm: yes });
  const adapter = fakeAdapter(() => {
    throw new DefiniteFailure("Media rejected: unsupported format");
  });
  const options = { adapters: { threads: adapter } };
  const action = await draft(ctx);
  const failed = await publish(ctx.db, ctx.brand, action.id, options);
  assert.equal(failed.status, "failed");
  assert.match(failed.error, /unsupported format/);
  assert.equal((await publish(ctx.db, ctx.brand, action.id, options)).status, "failed");
  await assert.rejects(publish(ctx.db, ctx.brand, action.id, options), { code: "paused" });
  assert.equal(adapter.calls.length, 2);
});

test("expired or revoked grants stop publishing", async (t) => {
  const ctx = await fixture(t);
  const grant = await addGrant(ctx.db, standingGrant, { confirm: yes });
  const adapter = fakeAdapter(delivered);
  await assert.rejects(
    publish(ctx.db, ctx.brand, (await draft(ctx)).id, {
      adapters: { threads: adapter },
      ...at("2027-02-01T00:00:00Z"),
    }),
    { code: "not_authorized" },
  );
  await revokeGrant(ctx.db, grant.id, { confirm: yes });
  await assert.rejects(
    publish(ctx.db, ctx.brand, (await draft(ctx, "again")).id, {
      adapters: { threads: adapter },
    }),
    { code: "not_authorized" },
  );
  assert.equal(adapter.calls.length, 0);
});

test("text that could disguise itself at the owner's approval prompt is rejected", async (t) => {
  const ctx = await fixture(t);
  for (const sneaky of ["Hello\u001b[2K\rOther text", "Pay ‮redro‬ now", "a\u0000b"])
    await assert.rejects(draft(ctx, sneaky), { code: "invalid_action" });
  await assert.rejects(draft(ctx, "ok", { variable: "hook=‮question" }), { code: "invalid_action" });
  await assert.rejects(
    addGrant(ctx.db, { ...standingGrant, statement: "One post\u001b[1A\u001b[2KUnlimited posts" }, { confirm: yes }),
    { code: "invalid_grant" },
  );
  assert.equal((await draft(ctx, "Line one\n\tLine two 🙂")).text, "Line one\n\tLine two 🙂");
});

test("an unknown API send cannot be closed by hand to free a resend", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, standingGrant, { confirm: yes });
  const action = await draft(ctx);
  const adapter = fakeAdapter(() => {
    throw new Error("timeout");
  });
  await publish(ctx.db, ctx.brand, action.id, { adapters: { threads: adapter } });
  assert.throws(() => recordReceipt(ctx.db, action.id, { absent: true }), { code: "reconcile_required" });
  await assert.rejects(publish(ctx.db, ctx.brand, action.id, { adapters: { threads: adapter } }), {
    code: "reconcile_required",
  });
  assert.equal(adapter.calls.length, 1);
});

test("assets must stay inside the brand folder", async (t) => {
  const ctx = await fixture(t);
  await assert.rejects(draft(ctx, "x", { assets: ["../../../etc/hosts"] }), {
    code: "invalid_asset",
  });
});

test("a manual handoff holds the account until a verified receipt is recorded", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, { ...standingGrant, maxPerDay: 5 }, { confirm: yes });
  const options = { adapters: { threads: manualAdapter } };
  const action = await draft(ctx);
  assert.equal((await publish(ctx.db, ctx.brand, action.id, options)).status, "handoff");
  await assert.rejects(publish(ctx.db, ctx.brand, (await draft(ctx, "b")).id, options), {
    code: "reconcile_required",
  });
  // A provider that cannot see the post yet must not close the handoff: the
  // person may simply not have posted it, and "failed" would allow a resend.
  const notYet = { lookup: async () => ({ state: "absent" }) };
  assert.equal((await reconcile(ctx.db, { adapters: { threads: notYet } }))[0].status, "handoff");
  await assert.rejects(publish(ctx.db, ctx.brand, action.id, options), { code: "reconcile_required" });
  const receipt = recordReceipt(ctx.db, action.id, {
    url: "https://www.threads.com/@sample/post/abc",
    providerId: "abc",
  });
  assert.equal(receipt.status, "delivered");
});

test("reconcile closes a handoff once the provider shows the post live", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, standingGrant, { confirm: yes });
  const action = await draft(ctx);
  await publish(ctx.db, ctx.brand, action.id, { adapters: { threads: manualAdapter } });
  const live = { lookup: async () => ({ state: "delivered", providerId: "abc", url: "https://www.threads.com/@sample/post/abc" }) };
  const [settled] = await reconcile(ctx.db, { adapters: { threads: live } });
  assert.equal(settled.status, "delivered");
  assert.equal(settled.providerId, "abc");
});

test("observations keep unavailable distinct from zero and require explicit corrections", async (t) => {
  const ctx = await fixture(t);
  const base = {
    metric: "views",
    unit: "count",
    from: "2026-11-01T00:00:00Z",
    to: "2026-11-02T00:00:00Z",
    source: "threads-insights",
  };
  const missing = observe(ctx.db, { ...base, metric: "active_users", value: null });
  const zero = observe(ctx.db, { ...base, value: 0 });
  assert.equal(missing.value, null);
  assert.equal(zero.value, 0);
  assert.equal(observe(ctx.db, { ...base, value: 0 }).id, zero.id);
  assert.throws(() => observe(ctx.db, { ...base, value: 4 }), { code: "conflicting_observation" });
  const corrected = observe(ctx.db, { ...base, value: 4, correct: true });
  assert.equal(corrected.supersedes, zero.id);
  assert.throws(() => observe(ctx.db, { ...base, value: Number.NaN }), {
    code: "invalid_observation",
  });
});

test("decisions cite real evidence and use a fixed verdict vocabulary", async (t) => {
  const ctx = await fixture(t);
  const evidence = observe(ctx.db, {
    metric: "views",
    value: 1,
    unit: "count",
    from: "2026-11-01T00:00:00Z",
    to: "2026-11-02T00:00:00Z",
    source: "threads-insights",
  });
  assert.throws(() => decide(ctx.db, { verdict: "great", rationale: "x", evidence: [] }), {
    code: "invalid_decision",
  });
  assert.throws(() => decide(ctx.db, { verdict: "wait", rationale: "x", evidence: [999] }), {
    code: "invalid_decision",
  });
  const decision = decide(ctx.db, {
    verdict: "wait",
    rationale: "One view is too little exposure to judge the message.",
    evidence: [evidence.id],
  });
  assert.deepEqual(decision.evidence, [evidence.id]);
});

test("status is a compact view of what needs attention", async (t) => {
  const ctx = await fixture(t);
  await addGrant(ctx.db, standingGrant, { confirm: yes, ...at("2026-11-02T12:00:00Z") });
  await publish(ctx.db, ctx.brand, (await draft(ctx)).id, {
    adapters: { threads: fakeAdapter(() => { throw new Error("timeout"); }) },
    ...at("2026-11-02T14:00:00Z"),
  });
  await draft(ctx, "queued");
  const view = status(ctx.db, at("2026-11-02T15:00:00Z"));
  assert.equal(view.unresolved.length, 1);
  assert.equal(view.unresolved[0].status, "unknown");
  assert.equal(view.proposed.length, 1);
  assert.equal(view.grants[0].usedToday, 1);
  assert.ok(JSON.stringify(view).length < 4000);
});
