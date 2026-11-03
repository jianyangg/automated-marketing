import { localDate, addDays, startOfDay } from "./store.mjs";
import { observe } from "./learning.mjs";

const POST_WINDOW_DAYS = 14;

// Saves a provider re-read. Providers revise recent numbers as late data
// arrives, so a new number supersedes the old one (history is kept). A failed
// read (null) never replaces a number that was actually measured.
function save(db, reading, now) {
  try {
    return observe(db, { ...reading, correct: reading.value !== null }, { now });
  } catch (error) {
    if (error.code === "conflicting_observation") return null;
    throw error;
  }
}

// One pass over every configured source. Each source fails on its own:
// an expired Threads token must not stop the Mixpanel read, and vice versa.
// Errors are returned to the caller, not hidden.
export async function pull(db, { config, adapters, readers, now = new Date(), days = 7 }) {
  const saved = [];
  const errors = [];

  const since = new Date(now.getTime() - POST_WINDOW_DAYS * 86_400_000).toISOString();
  const posts = db
    .prepare(
      `SELECT action_id, channel, provider_id, attempted_at FROM deliveries
       WHERE status = 'delivered' AND provider_id IS NOT NULL AND attempted_at >= ?`,
    )
    .all(since);
  for (const post of posts) {
    const adapter = adapters[post.channel];
    if (!adapter?.postInsights) continue;
    try {
      const values = await adapter.postInsights(post.provider_id);
      for (const [name, value] of Object.entries(values))
        saved.push(
          save(
            db,
            {
              metric: `${post.channel}_${name}`,
              value,
              unit: "count",
              from: post.attempted_at,
              to: now.toISOString(),
              source: `${post.channel}-insights`,
              actionId: post.action_id,
              note: "Lifetime count from publish to read time.",
            },
            now,
          ),
        );
    } catch (error) {
      errors.push({ source: `${post.channel}-insights`, actionId: post.action_id, message: error.message });
    }
  }

  for (const channel of Object.keys(config.channels)) {
    const adapter = adapters[channel];
    if (!adapter?.followers) continue;
    try {
      const value = await adapter.followers();
      saved.push(
        save(
          db,
          {
            metric: `${channel}_followers`,
            value,
            unit: "accounts",
            from: now.toISOString(),
            to: now.toISOString(),
            source: `${channel}-insights`,
          },
          now,
        ),
      );
    } catch (error) {
      errors.push({ source: `${channel}-insights`, message: error.message });
    }
  }

  for (const metric of config.metrics) {
    const reader = readers[metric.provider];
    if (!reader) {
      errors.push({ source: metric.provider, message: `No reader for ${metric.provider}.` });
      continue;
    }
    // Only complete days: today is still accumulating in the project's zone.
    const last = addDays(localDate(now, metric.timezone), -1);
    const first = addDays(last, 1 - days);
    try {
      const counts = await reader.daily(metric, first, last);
      for (let date = first; date <= last; date = addDays(date, 1))
        saved.push(
          save(
            db,
            {
              metric: metric.name,
              value: counts[date] ?? null,
              unit: metric.type === "unique" ? "users" : "events",
              from: startOfDay(date, metric.timezone).toISOString(),
              to: startOfDay(addDays(date, 1), metric.timezone).toISOString(),
              source: `${metric.provider}:${metric.event}:${metric.type}`,
              note: counts[date] === undefined ? `${metric.provider} returned no value for ${date}.` : undefined,
            },
            now,
          ),
        );
    } catch (error) {
      errors.push({ source: metric.provider, metric: metric.name, message: error.message });
    }
  }

  return { saved: saved.filter(Boolean).length, errors };
}
