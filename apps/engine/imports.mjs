import { EngineError, transaction, localDate } from "./store.mjs";
import { prepareAction } from "./actions.mjs";

// Brings posts that were published outside the engine (by hand, or through an
// older relay) into state, so their results can be pulled and compared.
// Each entry: { channel, account, hypothesis, text?, variable?, assets?, providerId?, url?, deliveredAt? }
// with at least a providerId or a url. Anything missing (ID, exact time, text)
// is read from the provider's own record of the post, never guessed. When
// the provider returns the text, it wins over the entry's copy because it is
// what actually went out. Re-running is safe: posts already known by provider
// ID are skipped, and a URL the account no longer shows is reported, not invented.
export async function importReceipts(db, brandDir, entries, { adapters, timezone, now = new Date() }) {
  if (!Array.isArray(entries)) throw new EngineError("invalid_import", "Import file must hold a JSON array.");
  try {
    localDate(now, timezone);
  } catch {
    throw new EngineError("invalid_import", `--timezone must be a known time zone, got ${timezone}.`);
  }
  const results = [];
  for (const [index, entry] of entries.entries()) {
    const where = `entry ${index}`;
    const adapter = adapters[entry?.channel];
    const needAdapter = (method, reason) => {
      if (!adapter?.[method])
        throw new EngineError("invalid_import", `${where}: ${reason}, and no ${entry.channel} adapter can look the post up.`);
    };
    let { providerId, deliveredAt, url } = entry ?? {};
    let record = null;
    if (!providerId) {
      if (typeof url !== "string" || !url) throw new EngineError("invalid_import", `${where}: providerId or url is required.`);
      needAdapter("findByPermalink", "no providerId");
      record = await adapter.findByPermalink(url);
      if (!record) {
        results.push({ url, skipped: "not found on the account" });
        continue;
      }
      providerId = record.providerId;
    }
    const known = db
      .prepare("SELECT action_id FROM deliveries WHERE channel = ? AND provider_id = ?")
      .get(entry.channel, providerId);
    if (known) {
      results.push({ providerId, skipped: "already imported", actionId: known.action_id });
      continue;
    }
    if (deliveredAt === undefined && !record) {
      needAdapter("media", "no exact deliveredAt");
      record = await adapter.media(providerId);
    }
    deliveredAt ??= record?.publishedAt;
    url = record?.url ?? url;
    const text = record?.text ?? entry.text;
    const textMismatch =
      typeof record?.text === "string" && typeof entry.text === "string" && record.text.trim() !== entry.text.trim();
    const at = new Date(deliveredAt);
    if (Number.isNaN(at.getTime()) || !/(Z|[+-]\d{2}:?\d{2})$/.test(deliveredAt))
      throw new EngineError("invalid_import", `${where}: deliveredAt needs a time zone, got ${deliveredAt}.`);
    // Action and delivery are written together: an imported post must never
    // linger as an unsent proposal that a later run could publish again.
    const insertAction = await prepareAction(brandDir, { ...entry, text }, { now: at });
    transaction(db, () => {
      insertAction(db);
      db.prepare(
        `INSERT INTO deliveries (action_id, channel, account, status, local_date, attempted_at,
           settled_at, provider_id, url)
         VALUES (?, ?, ?, 'delivered', ?, ?, ?, ?, ?)`,
      ).run(
        insertAction.id,
        entry.channel.trim(),
        entry.account.trim(),
        localDate(at, timezone),
        at.toISOString(),
        now.toISOString(),
        providerId,
        url ?? null,
      );
    });
    results.push({
      providerId,
      actionId: insertAction.id,
      deliveredAt: at.toISOString(),
      url: url ?? null,
      ...(textMismatch && { textMismatch: "The live text differs from the stored copy; the live text was recorded." }),
    });
  }
  return results;
}
