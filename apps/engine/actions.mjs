import { createHash, randomBytes } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import { EngineError, assertPrintable } from "./store.mjs";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function required(value, name) {
  if (typeof value !== "string" || !value.trim())
    throw new EngineError("invalid_action", `${name} is required.`);
  return assertPrintable(value.trim(), name, "invalid_action");
}

// Paths are resolved through symlinks and must stay inside the brand folder,
// so a proposal can never attach another brand's (or the system's) files.
export async function brandFile(brandDir, path) {
  const base = await realpath(brandDir);
  let resolved;
  try {
    resolved = await realpath(join(base, path));
  } catch {
    throw new EngineError("invalid_asset", `File not found in the brand folder: ${path}`);
  }
  const inside = relative(base, resolved);
  if (!inside || inside.startsWith("..") || isAbsolute(inside))
    throw new EngineError("invalid_asset", `File is outside the brand folder: ${path}`);
  return { path: inside, content: await readFile(resolved) };
}

// Reads every asset and records its hash. An asset is a brand-folder path,
// optionally paired with the public https URL where the same bytes are hosted.
// Some providers, Threads among them, fetch media from a URL instead of
// accepting an upload.
export async function hashAssets(brandDir, entries) {
  return Promise.all(
    entries.map(async (entry) => {
      const { path, publicUrl } = typeof entry === "string" ? { path: entry } : entry;
      assertPrintable(path, "Asset path", "invalid_asset");
      assertPrintable(publicUrl, "Public URL", "invalid_asset");
      if (publicUrl !== undefined && !/^https:\/\/\S+$/.test(publicUrl))
        throw new EngineError("invalid_asset", `Public URL must be https: ${publicUrl}`);
      const file = await brandFile(brandDir, path);
      return { path: file.path, sha256: sha256(file.content), ...(publicUrl && { publicUrl }) };
    }),
  );
}

// The hash covers where it goes and exactly what it says and shows. Approvals
// and deliveries point at this hash, so they can't silently drift to edited copy.
function contentHash({ channel, account, text, assets }) {
  return sha256(JSON.stringify({ channel, account, text, assets }));
}

export async function propose(db, brandDir, spec, options) {
  const insert = await prepareAction(brandDir, spec, options);
  insert(db);
  return getAction(db, insert.id);
}

// Validates and hashes everything (the slow, async part) and returns a
// synchronous insert. Callers can then run the insert inside a transaction
// alongside other writes, so an action never exists without its companions.
export async function prepareAction(brandDir, spec, { now = new Date() } = {}) {
  const channel = required(spec.channel, "channel");
  const account = required(spec.account, "account");
  const hypothesis = required(spec.hypothesis, "hypothesis");
  const text = required(spec.text, "text");
  // "name=value", e.g. "hook=question". One variable per post keeps the comparison readable.
  const variable =
    spec.variable === undefined ? null : assertPrintable(spec.variable.trim(), "variable", "invalid_action");
  if (variable !== null && !/^[a-z0-9_-]+=[^=\s][^=]*$/i.test(variable))
    throw new EngineError("invalid_action", 'variable must look like "hook=question".');
  const assets = await hashAssets(brandDir, spec.assets ?? []);
  const payload = { text, assets };
  const id = `act_${now.toISOString().slice(0, 10).replaceAll("-", "")}_${randomBytes(3).toString("hex")}`;
  const insert = (db) =>
    db
      .prepare(
        `INSERT INTO actions (id, channel, account, hypothesis, variable, payload, content_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        channel,
        account,
        hypothesis,
        variable,
        JSON.stringify(payload),
        contentHash({ channel, account, ...payload }),
        now.toISOString(),
      );
  insert.id = id;
  return insert;
}

export function getAction(db, id) {
  const row = db.prepare("SELECT * FROM actions WHERE id = ?").get(id);
  if (!row) throw new EngineError("not_found", `No action ${id}.`);
  return {
    id: row.id,
    channel: row.channel,
    account: row.account,
    hypothesis: row.hypothesis,
    variable: row.variable,
    ...JSON.parse(row.payload),
    contentHash: row.content_hash,
    createdAt: row.created_at,
    approved: row.approved_hash === row.content_hash,
  };
}

// Re-reads the assets right before sending. If a file changed since the
// proposal, what would go out is no longer what was proposed or approved.
export async function assertCurrent(brandDir, action) {
  const current = await hashAssets(brandDir, action.assets);
  if (contentHash({ ...action, assets: current }) !== action.contentHash)
    throw new EngineError(
      "stale_content",
      `Assets for ${action.id} changed after it was proposed. Propose a new action with the current files.`,
    );
}
