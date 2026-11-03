import { createInterface } from "node:readline/promises";
import { EngineError, localDate, assertPrintable } from "./store.mjs";
import { getAction } from "./actions.mjs";

// Authority comes from the owner typing at a real terminal, never from a flag
// the agent can pass. The agent runs commands without a TTY, so it cannot grant
// itself permission. This is a guard against the agent's own mistakes, not a
// security boundary against hostile software on the same machine.
export async function terminalConfirm(summary, word) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new EngineError(
      "owner_terminal_required",
      "Only the owner can do this, from an interactive terminal.",
    );
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.stdout.write(`${summary}\n`);
    return (await prompt.question(`Type "${word}" to confirm: `)).trim() === word;
  } finally {
    prompt.close();
  }
}

async function confirmed(confirm, summary, word) {
  if (!(await confirm(summary, word)))
    throw new EngineError("not_confirmed", "Not confirmed; nothing changed.");
}

function positiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1)
    throw new EngineError("invalid_grant", `${name} must be a whole number of at least 1.`);
  return number;
}

export async function addGrant(db, spec, { confirm = terminalConfirm, now = new Date() } = {}) {
  for (const field of ["channel", "account", "timezone", "statement", "expiresAt"]) {
    if (typeof spec[field] !== "string" || !spec[field].trim())
      throw new EngineError("invalid_grant", `${field} is required.`);
    assertPrintable(spec[field], field, "invalid_grant");
  }
  try {
    localDate(now, spec.timezone);
  } catch {
    throw new EngineError("invalid_grant", `Unknown time zone ${spec.timezone}.`);
  }
  // Grants must expire: standing permission with no end date is easy to forget about.
  const expires = new Date(spec.expiresAt);
  if (Number.isNaN(expires.getTime()) || expires <= now)
    throw new EngineError("invalid_grant", "expiresAt must be a future date.");
  const grant = {
    channel: spec.channel.trim(),
    account: spec.account.trim(),
    maxPerDay: positiveInteger(spec.maxPerDay, "maxPerDay"),
    timezone: spec.timezone,
    pauseAfterFailures: positiveInteger(spec.pauseAfterFailures, "pauseAfterFailures"),
    expiresAt: expires.toISOString(),
    statement: spec.statement.trim(),
  };
  await confirmed(
    confirm,
    [
      `Standing permission for ${grant.channel} @${grant.account}:`,
      `  "${grant.statement}"`,
      `  At most ${grant.maxPerDay} post(s) per day (${grant.timezone}).`,
      `  Pauses after ${grant.pauseAfterFailures} consecutive failure(s).`,
      `  Expires ${grant.expiresAt}. No replies, spending or settings changes.`,
    ].join("\n"),
    "grant",
  );
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO grants (channel, account, max_per_day, timezone, pause_after_failures,
         expires_at, statement, authorized_via, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'owner-terminal', ?)`,
    )
    .run(
      grant.channel,
      grant.account,
      grant.maxPerDay,
      grant.timezone,
      grant.pauseAfterFailures,
      grant.expiresAt,
      grant.statement,
      now.toISOString(),
    );
  return { id: Number(lastInsertRowid), ...grant };
}

export async function revokeGrant(db, id, { confirm = terminalConfirm, now = new Date() } = {}) {
  const grant = db.prepare("SELECT * FROM grants WHERE id = ? AND revoked_at IS NULL").get(id);
  if (!grant) throw new EngineError("not_found", `No active grant ${id}.`);
  await confirmed(confirm, `Revoke grant ${id}: "${grant.statement}"`, "revoke");
  db.prepare("UPDATE grants SET revoked_at = ? WHERE id = ?").run(now.toISOString(), id);
}

export function activeGrant(db, channel, account, now) {
  return db
    .prepare(
      `SELECT * FROM grants
       WHERE channel = ? AND account = ? AND revoked_at IS NULL AND expires_at > ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(channel, account, now.toISOString());
}

// Approves one exact action. The approval stores the content hash it was
// shown, so it covers that content only, not later edits or other posts.
export async function approveAction(db, id, { confirm = terminalConfirm, now = new Date() } = {}) {
  const action = getAction(db, id);
  const assets = action.assets.map((asset) => `  ${asset.path} (sha256 ${asset.sha256.slice(0, 12)})`);
  await confirmed(
    confirm,
    [`Publish once to ${action.channel} @${action.account}:`, "", action.text, "", ...assets].join("\n"),
    "approve",
  );
  db.prepare(
    "UPDATE actions SET approved_hash = ?, approved_at = ?, approved_via = 'owner-terminal' WHERE id = ?",
  ).run(action.contentHash, now.toISOString(), id);
  return getAction(db, id);
}
