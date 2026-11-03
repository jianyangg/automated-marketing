import { localDate } from "./store.mjs";

// The one view a scheduled run reads first: what is blocked, what is
// queued, how much of today's allowance is left, the latest numbers, and
// recent decisions. Lists are capped so the view stays small however long the
// history grows (the old prose ledgers grew to tens of kilobytes).
export function status(db, { now = new Date(), limit = 5, config = null } = {}) {
  const grants = db
    .prepare(
      `SELECT * FROM grants WHERE revoked_at IS NULL AND expires_at > ? ORDER BY id DESC`,
    )
    .all(now.toISOString())
    .map((grant) => {
      const today = localDate(now, grant.timezone);
      const { used } = db
        .prepare(
          `SELECT count(*) AS used FROM deliveries
           WHERE channel = ? AND account = ? AND status != 'failed' AND local_date = ?`,
        )
        .get(grant.channel, grant.account, today);
      return {
        id: grant.id,
        channel: grant.channel,
        account: grant.account,
        today,
        usedToday: used,
        maxPerDay: grant.max_per_day,
        expiresAt: grant.expires_at,
      };
    });

  const unresolved = db
    .prepare(
      `SELECT id, action_id AS actionId, channel, account, status, attempted_at AS attemptedAt, error
       FROM deliveries WHERE status IN ('attempting', 'unknown', 'handoff') ORDER BY id`,
    )
    .all();

  // Proposed = no attempt that might have reached the audience yet.
  const proposed = db
    .prepare(
      `SELECT a.id, a.channel, a.account, a.hypothesis, a.approved_hash = a.content_hash AS approved
       FROM actions a
       WHERE NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.action_id = a.id AND d.status != 'failed')
       ORDER BY a.created_at DESC LIMIT ?`,
    )
    .all(limit)
    .map((row) => ({ ...row, approved: row.approved === 1 }));

  const recentDeliveries = db
    .prepare(
      `SELECT action_id AS actionId, channel, status, local_date AS localDate, url
       FROM deliveries WHERE status IN ('delivered', 'failed') ORDER BY id DESC LIMIT ?`,
    )
    .all(limit);

  // Latest current reading per metric and source.
  const latest = db
    .prepare(
      `SELECT metric, source, value, unit, window_start AS "from", window_end AS "to"
       FROM observations o
       WHERE is_current = 1 AND action_id IS NULL AND window_end = (
         SELECT max(window_end) FROM observations i
         WHERE i.metric = o.metric AND i.source = o.source AND i.action_id IS NULL
           AND i.is_current = 1)
       ORDER BY metric LIMIT ?`,
    )
    .all(limit * 2);

  const decisions = db
    .prepare(
      `SELECT verdict, rationale, review_at AS reviewAt, decided_at AS decidedAt
       FROM decisions ORDER BY id DESC LIMIT ?`,
    )
    .all(limit);

  return {
    at: now.toISOString(),
    northStar: config?.northStar ? northStar(db, config.northStar, now) : null,
    grants,
    unresolved,
    proposed,
    recentDeliveries,
    experiments: experiments(db, now),
    latest,
    decisions,
  };
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Compares the average daily value over the last 7 days with the 7 before.
// Daily unique users cannot be added up into weekly unique people (the same
// person appears on several days), so this uses averages, not sums. Days with
// no reading count as unknown and are reported in knownDays, never as zero.
function northStar(db, metric, now) {
  const rows = db
    .prepare(
      `SELECT value, window_end FROM observations
       WHERE metric = ? AND action_id IS NULL AND is_current = 1 AND window_end <= ? AND window_end > ?
       ORDER BY window_end DESC`,
    )
    .all(metric, now.toISOString(), new Date(now.getTime() - 14 * 86_400_000).toISOString());
  const cut = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const summarize = (subset) => {
    const known = subset.map((row) => row.value).filter((value) => value !== null);
    return {
      averagePerDay: known.length ? Math.round((known.reduce((a, b) => a + b, 0) / known.length) * 10) / 10 : null,
      knownDays: known.length,
    };
  };
  return {
    metric,
    last7: summarize(rows.filter((row) => row.window_end > cut)),
    prior7: summarize(rows.filter((row) => row.window_end <= cut)),
  };
}

// Groups the last 28 days of delivered posts by their tagged variable and
// reports how many there are plus the median of each post's latest view count.
// This only describes the data; the operating procedure decides when n is
// large enough to act on.
function experiments(db, now) {
  const since = new Date(now.getTime() - 28 * 86_400_000).toISOString();
  const rows = db
    .prepare(
      `SELECT a.variable, a.channel,
         (SELECT o.value FROM observations o
          WHERE o.action_id = a.id AND o.metric = a.channel || '_views' AND o.is_current = 1
          ORDER BY o.window_end DESC LIMIT 1) AS views
       FROM actions a JOIN deliveries d ON d.action_id = a.id
       WHERE d.status = 'delivered' AND d.attempted_at >= ? AND a.variable IS NOT NULL`,
    )
    .all(since);
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.channel} ${row.variable}`;
    const group = groups.get(key) ?? { channel: row.channel, variable: row.variable, posts: 0, views: [] };
    group.posts++;
    if (row.views !== null) group.views.push(row.views);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ views, ...group }) => ({
    ...group,
    postsWithViews: views.length,
    medianViews: median(views),
  }));
}
