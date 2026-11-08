import { EngineError } from "./store.mjs";

// The funnel answers "where is this business stuck?" from numbers alone.
// Each stage has one daily metric and a target daily average (engine.json).
// A metric's numbers count only as far as they can be trusted, so every
// metric also carries a trust state recorded by whoever checked it.

export const STAGES = ["finding-fit", "early-traction", "scaling"];
const TRUST = ["verified", "unverified", "broken"];

export const DAY_MS = 86_400_000;

const author = (value) => {
  if (typeof value !== "string" || !/^[a-z0-9-]{1,40}$/.test(value))
    throw new EngineError("invalid_author", "--by must name the role that wrote this, e.g. cmo or competitor-watcher.");
  return value;
};
export { author as validAuthor };

// Average of the known daily readings in a window. Unknown days are counted
// separately and never treated as zero.
//
// Only day-long readings count (23 to 25 hours, which allows for daylight
// saving), so a weekly total can never pass for one day. If two sources
// recorded the same day, the most recently observed reading is used, so one
// day is never counted twice.
//
// By default a day belongs to the window when it ends inside it, which makes
// consecutive windows tile exactly. With `wholeDays`, a day must also start
// inside the window: a bet started at 22:00 must not be credited with the
// day that was almost over before it began.
export function dailyAverage(db, metric, fromIso, toIso, { wholeDays = false } = {}) {
  const rows = db
    .prepare(
      `SELECT value, window_start, window_end FROM observations
       WHERE metric = ? AND action_id IS NULL AND is_current = 1 AND window_end > ? AND window_end <= ?
         ${wholeDays ? "AND window_start >= ?" : ""}
       ORDER BY observed_at, id`,
    )
    .all(metric, fromIso, toIso, ...(wholeDays ? [fromIso] : []))
    .filter((row) => {
      const hours = (Date.parse(row.window_end) - Date.parse(row.window_start)) / 3_600_000;
      return hours >= 23 && hours <= 25;
    });
  const byDay = new Map();
  for (const row of rows) byDay.set(row.window_start, row);
  const days = [...byDay.values()];
  const known = days.map((row) => row.value).filter((value) => value !== null);
  return {
    averagePerDay: known.length ? round(known.reduce((a, b) => a + b, 0) / known.length) : null,
    exactAverage: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null,
    knownDays: known.length,
    unknownDays: days.length - known.length,
  };
}

const round = (value) => Math.round(value * 100) / 100;

export function recordCheck(db, spec, { now = new Date() } = {}) {
  if (!TRUST.includes(spec.state))
    throw new EngineError("invalid_check", `state must be one of ${TRUST.join(", ")}.`);
  if (typeof spec.metric !== "string" || !spec.metric.trim())
    throw new EngineError("invalid_check", "metric is required.");
  // "Verified" is a claim someone has to be able to repeat, so it needs the
  // how: which test event, which report, which comparison.
  if (typeof spec.note !== "string" || spec.note.trim().length < 10)
    throw new EngineError("invalid_check", "note must say how the metric was checked (at least 10 characters).");
  const { lastInsertRowid } = db
    .prepare("INSERT INTO metric_checks (metric, state, note, recorded_by, checked_at) VALUES (?, ?, ?, ?, ?)")
    .run(spec.metric.trim(), spec.state, spec.note.trim(), author(spec.by), now.toISOString());
  return { id: Number(lastInsertRowid), metric: spec.metric.trim(), state: spec.state, checkedAt: now.toISOString() };
}

export function trustOf(db, metric) {
  const row = db
    .prepare("SELECT state, note, checked_at FROM metric_checks WHERE metric = ? ORDER BY id DESC LIMIT 1")
    .get(metric);
  // Nobody has checked it: that is "unverified", not "verified by default".
  return row ? { state: row.state, note: row.note, checkedAt: row.checked_at } : { state: "unverified", note: null, checkedAt: null };
}

export function currentStage(db) {
  const row = db.prepare("SELECT stage, changed_at FROM stage_changes ORDER BY id DESC LIMIT 1").get();
  // Every brand starts by finding fit until evidence moves it on.
  return row ? { stage: row.stage, since: row.changed_at } : { stage: "finding-fit", since: null };
}

// Moving forward a stage is a claim about the business and must cite readings.
// Moving back (the numbers fell away) needs only a reason.
export function setStage(db, spec, { now = new Date() } = {}) {
  if (!STAGES.includes(spec.stage))
    throw new EngineError("invalid_stage", `stage must be one of ${STAGES.join(", ")}.`);
  if (typeof spec.rationale !== "string" || !spec.rationale.trim())
    throw new EngineError("invalid_stage", "rationale is required.");
  const from = currentStage(db).stage;
  if (from === spec.stage) throw new EngineError("invalid_stage", `Already in ${from}.`);
  const evidence = [...new Set(spec.evidence ?? [])];
  if (STAGES.indexOf(spec.stage) > STAGES.indexOf(from)) {
    if (!evidence.length)
      throw new EngineError("invalid_stage", `Moving from ${from} to ${spec.stage} must cite observations.`);
    for (const id of evidence)
      if (!db.prepare("SELECT 1 FROM observations WHERE id = ?").get(id))
        throw new EngineError("invalid_stage", `Observation ${id} does not exist.`);
  }
  db.prepare(
    "INSERT INTO stage_changes (stage, rationale, evidence, recorded_by, changed_at) VALUES (?, ?, ?, ?, ?)",
  ).run(spec.stage, spec.rationale.trim(), JSON.stringify(evidence), author(spec.by), now.toISOString());
  return { stage: spec.stage, from, evidence };
}

// Each stage's last-7-day average against its target, plus its trust state.
// The constraint is the stage that most needs work:
//   1. a stage whose metric is broken (nothing else can be judged through it);
//   2. otherwise the trusted-or-unverified stage with the lowest share of
//      target, earlier stages winning ties;
//   3. a stage with no known days in the window is "unknown", and if every
//      stage is unknown the constraint is measurement itself.
export function funnelView(db, config, now = new Date()) {
  const to = now.toISOString();
  const from = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const stages = config.funnel.map(({ stage, metric, target }) => {
    const window = dailyAverage(db, metric, from, to);
    const trust = trustOf(db, metric);
    return {
      stage,
      metric,
      target,
      last7: window.averagePerDay,
      knownDays: window.knownDays,
      share: window.averagePerDay === null ? null : round(window.averagePerDay / target),
      // Kept unrounded for the comparison: 99.6% of target is not on target.
      onTarget: window.exactAverage === null ? null : window.exactAverage >= target,
      trust: trust.state,
    };
  });
  return { stage: currentStage(db).stage, stages, constraint: constraint(stages) };
}

function constraint(stages) {
  if (!stages.length) return null;
  const broken = stages.find((s) => s.trust === "broken");
  if (broken) return { stage: broken.stage, reason: "broken_metric", metric: broken.metric };
  const measured = stages.filter((s) => s.share !== null);
  if (!measured.length) return { stage: stages[0].stage, reason: "no_readings", metric: stages[0].metric };
  if (measured.every((s) => s.onTarget)) return { stage: null, reason: "all_on_target", metric: null };
  const lowest = measured.filter((s) => !s.onTarget).reduce((low, s) => (s.share < low.share ? s : low));
  return { stage: lowest.stage, reason: "lowest_share_of_target", metric: lowest.metric, share: lowest.share };
}
