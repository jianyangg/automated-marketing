import { join } from "node:path";
import { EngineError, transaction, localDate } from "./store.mjs";
import { getAction, assertCurrent } from "./actions.mjs";
import { activeGrant } from "./authority.mjs";

// Adapters throw this only when the provider definitely rejected the request
// and nothing went public (e.g. a validation error). Any other error, such as
// a timeout or dropped connection, might have happened after the post went
// live, so the engine records the outcome as "unknown", never "failed".
export class DefiniteFailure extends Error {}

// States where the post may be live but has no receipt yet. While one exists
// for an account, nothing else is sent there until reconcile or a receipt.
const UNRESOLVED = ["attempting", "unknown", "handoff"];
const unresolvedSql = UNRESOLVED.map((s) => `'${s}'`).join(", ");

function view(row) {
  return {
    id: row.id,
    actionId: row.action_id,
    status: row.status,
    channel: row.channel,
    account: row.account,
    localDate: row.local_date,
    attemptedAt: row.attempted_at,
    settledAt: row.settled_at,
    providerId: row.provider_id,
    url: row.url,
    error: row.error,
  };
}

const deliveryById = (db, id) => view(db.prepare("SELECT * FROM deliveries WHERE id = ?").get(id));

function settle(db, id, status, { providerId = null, url = null, error = null }, now) {
  db.prepare(
    `UPDATE deliveries SET status = ?, provider_id = ?, url = ?, error = ?, settled_at = ?
     WHERE id = ?`,
  ).run(status, providerId, url, error, now.toISOString(), id);
  return deliveryById(db, id);
}

// Checks every rule and reserves the send as one atomic step, so a crash or
// an overlapping run can never leave two attempts that both believe they may go.
// `byPerson` marks a manual handoff: the engine only packages the content and
// holds the account. A person decides whether and when to post, so no grant or
// approval is needed for the handoff itself; duplicate protection still applies.
function reserve(db, action, now, { byPerson = false } = {}) {
  return transaction(db, () => {
    // Re-checked under the write lock, so a withdrawal that lands while a send
    // is being prepared still stops it.
    if (db.prepare("SELECT withdrawn_at FROM actions WHERE id = ?").get(action.id)?.withdrawn_at)
      throw new EngineError("withdrawn", `${action.id} was withdrawn and will not be sent.`);
    const live = db
      .prepare("SELECT * FROM deliveries WHERE action_id = ? AND status != 'failed'")
      .get(action.id);
    if (live?.status === "delivered") return { done: view(live) };
    const blocking = db
      .prepare(
        `SELECT id, action_id, status FROM deliveries
         WHERE channel = ? AND account = ? AND status IN (${unresolvedSql})
         ORDER BY id LIMIT 1`,
      )
      .get(action.channel, action.account);
    if (blocking)
      throw new EngineError(
        "reconcile_required",
        `Delivery ${blocking.id} (${blocking.action_id}) is ${blocking.status}. Run reconcile or record a receipt before sending anything else to @${action.account}.`,
        { deliveryId: blocking.id },
      );

    const grant = activeGrant(db, action.channel, action.account, now);
    const date = localDate(now, grant?.timezone ?? "UTC");
    let grantId = null;
    if (!action.approved && !byPerson) {
      if (!grant)
        throw new EngineError(
          "not_authorized",
          `No owner approval for ${action.id} and no active grant for ${action.channel} @${action.account}.`,
        );
      const { used } = db
        .prepare(
          `SELECT count(*) AS used FROM deliveries
           WHERE channel = ? AND account = ? AND status != 'failed' AND local_date = ?`,
        )
        .get(action.channel, action.account, date);
      if (used >= grant.max_per_day)
        throw new EngineError(
          "daily_cap",
          `Already ${used} of ${grant.max_per_day} allowed post(s) on ${date} (${grant.timezone}).`,
        );
      // Failures count per grant, so a fresh owner grant resets the pause.
      const recent = db
        .prepare("SELECT status FROM deliveries WHERE grant_id = ? ORDER BY id DESC LIMIT ?")
        .all(grant.id, grant.pause_after_failures);
      if (
        recent.length === grant.pause_after_failures &&
        recent.every((row) => row.status === "failed")
      )
        throw new EngineError(
          "paused",
          `Grant ${grant.id} is paused after ${recent.length} consecutive failures. Fix the cause; the owner can then issue a new grant.`,
        );
      grantId = grant.id;
    }
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO deliveries (action_id, grant_id, channel, account, status, local_date, attempted_at)
         VALUES (?, ?, ?, ?, 'attempting', ?, ?)`,
      )
      .run(action.id, grantId, action.channel, action.account, date, now.toISOString());
    return { id: Number(lastInsertRowid) };
  });
}

export async function publish(db, brandDir, actionId, { adapters, now = new Date() }) {
  const action = getAction(db, actionId);
  if (action.withdrawn) throw new EngineError("withdrawn", `${actionId} was withdrawn and will not be sent.`);
  const adapter = adapters[action.channel];
  if (!adapter)
    throw new EngineError("no_adapter", `No adapter is configured for ${action.channel}.`);
  const existing = db
    .prepare("SELECT * FROM deliveries WHERE action_id = ? AND status = 'delivered'")
    .get(actionId);
  if (existing) return view(existing);
  await assertCurrent(brandDir, action);

  const reservation = reserve(db, action, now, { byPerson: adapter.byPerson === true });
  if (reservation.done) return reservation.done;

  let result;
  try {
    result = await adapter.publish({
      actionId: action.id,
      // Lets an adapter pass a provider-side dedupe key where one is supported.
      idempotencyKey: `${action.id}:${reservation.id}`,
      channel: action.channel,
      account: action.account,
      text: action.text,
      assets: action.assets.map((asset) => ({ ...asset, absolutePath: join(brandDir, asset.path) })),
    });
  } catch (error) {
    const status = error instanceof DefiniteFailure ? "failed" : "unknown";
    return settle(db, reservation.id, status, { error: error.message }, now);
  }
  if (result?.state === "delivered" && (result.providerId || result.url))
    return settle(db, reservation.id, "delivered", result, now);
  if (result?.state === "handoff") return settle(db, reservation.id, "handoff", {}, now);
  return settle(
    db,
    reservation.id,
    "unknown",
    { error: `Adapter returned an unrecognised result: ${JSON.stringify(result)}` },
    now,
  );
}

// Asks each provider what actually happened to sends with no receipt.
// "absent" means the provider confirms the post does not exist; anything
// it cannot confirm stays unresolved instead of being guessed.
export async function reconcile(db, { adapters, now = new Date() }) {
  const pending = db
    .prepare(`SELECT * FROM deliveries WHERE status IN (${unresolvedSql}) ORDER BY id`)
    .all();
  const results = [];
  for (const row of pending) {
    const adapter = adapters[row.channel];
    if (!adapter?.lookup) {
      results.push(view(row));
      continue;
    }
    // Providers are searched by what was actually sent, so lookup gets the text too.
    const { text } = getAction(db, row.action_id);
    const found = await adapter.lookup({ ...view(row), text });
    if (found?.state === "delivered" && (found.providerId || found.url))
      results.push(settle(db, row.id, "delivered", found, now));
    // For a manual handoff, "not on the account yet" only means the person has
    // not posted it yet. Marking it failed would reopen the action for a second
    // send, so only a recorded `receipt --absent` can close a handoff.
    else if (found?.state === "absent" && row.status !== "handoff")
      results.push(settle(db, row.id, "failed", { error: "Provider confirmed the post is absent." }, now));
    else results.push(view(row));
  }
  return results;
}

// Records the result of a manual or otherwise unresolved send after someone
// has checked the live post (or confirmed it never went out).
export function recordReceipt(db, actionId, { url, providerId, absent = false, now = new Date() }) {
  const row = db
    .prepare(`SELECT * FROM deliveries WHERE action_id = ? AND status IN (${unresolvedSql})`)
    .get(actionId);
  if (!row) throw new EngineError("not_found", `No unresolved delivery for ${actionId}.`);
  // Only a person can know a handoff was never posted. An API send in an
  // unknown state may be live, and closing it as failed would free the action
  // and the daily allowance for a duplicate; only `reconcile` can rule it out.
  if (absent) {
    if (row.status !== "handoff")
      throw new EngineError(
        "reconcile_required",
        `Delivery ${row.id} is ${row.status}; only reconcile can confirm an API send is absent.`,
      );
    return settle(db, row.id, "failed", { error: "Recorded as not published." }, now);
  }
  if (typeof url !== "string" || !/^https:\/\/\S+$/.test(url))
    throw new EngineError("invalid_receipt", "A receipt needs the live https URL of the post.");
  return settle(db, row.id, "delivered", { url, providerId: providerId ?? null }, now);
}
