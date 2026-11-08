import { EngineError, transaction } from "./store.mjs";
import { RATIONALE_LIMIT } from "./bets.mjs";
import { validAuthor } from "./funnel.mjs";

function readingView(row) {
  return {
    id: row.id,
    metric: row.metric,
    value: row.value,
    unit: row.unit,
    from: row.window_start,
    to: row.window_end,
    source: row.source,
    actionId: row.action_id,
    note: row.note,
    observedAt: row.observed_at,
    supersedes: row.supersedes,
  };
}

function isoInstant(value, name) {
  const date = new Date(value);
  if (typeof value !== "string" || Number.isNaN(date.getTime()))
    throw new EngineError("invalid_observation", `${name} must be an ISO date-time.`);
  return date.toISOString();
}

// Records one reading. `value: null` means "could not be measured" and is
// stored as such. It is never turned into 0, because a missing number and a
// measured zero lead to very different decisions.
export function observe(db, spec, { now = new Date() } = {}) {
  for (const field of ["metric", "unit", "source"])
    if (typeof spec[field] !== "string" || !spec[field].trim())
      throw new EngineError("invalid_observation", `${field} is required.`);
  if (spec.value !== null && !Number.isFinite(spec.value))
    throw new EngineError("invalid_observation", "value must be a finite number or null (unavailable).");
  const from = isoInstant(spec.from, "from");
  const to = isoInstant(spec.to, "to");
  // from === to is a point-in-time reading, such as a follower count.
  if (from > to) throw new EngineError("invalid_observation", "from must not be after to.");
  const actionId = spec.actionId ?? null;

  return transaction(db, () => {
    const current = db
      .prepare(
        `SELECT * FROM observations
         WHERE metric = ? AND source = ? AND window_start = ? AND window_end = ?
           AND ifnull(action_id, '') = ? AND is_current = 1`,
      )
      .get(spec.metric, spec.source, from, to, actionId ?? "");
    // Re-importing the same reading is a no-op, so imports are safe to repeat.
    if (current && current.value === spec.value) return readingView(current);
    if (current && !spec.correct)
      throw new EngineError(
        "conflicting_observation",
        `Reading ${current.id} already says ${current.value} for this window. Pass correct to supersede it.`,
        { observationId: current.id },
      );
    // Retire the old reading first so the "one current reading" index holds
    // throughout; the transaction undoes this if the insert fails.
    if (current) db.prepare("UPDATE observations SET is_current = 0 WHERE id = ?").run(current.id);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO observations (metric, value, unit, window_start, window_end, source,
           action_id, note, observed_at, supersedes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        spec.metric,
        spec.value,
        spec.unit,
        from,
        to,
        spec.source,
        actionId,
        spec.note ?? null,
        now.toISOString(),
        current?.id ?? null,
      );
    return readingView(db.prepare("SELECT * FROM observations WHERE id = ?").get(lastInsertRowid));
  });
}

const VERDICTS = ["keep", "change", "stop", "wait"];

// A decision must cite readings that exist, which keeps "what we learned"
// tied to evidence rather than to an agent's impression.
export function decide(db, spec, { now = new Date() } = {}) {
  if (!VERDICTS.includes(spec.verdict))
    throw new EngineError("invalid_decision", `verdict must be one of ${VERDICTS.join(", ")}.`);
  if (typeof spec.rationale !== "string" || !spec.rationale.trim())
    throw new EngineError("invalid_decision", "rationale is required.");
  // Short on purpose: the evidence ids carry the detail. Long rationales were
  // where hedging and retelling piled up.
  if (spec.rationale.trim().length > RATIONALE_LIMIT)
    throw new EngineError("invalid_decision", `rationale must fit in ${RATIONALE_LIMIT} characters; cite evidence ids for the detail.`);
  const by = spec.by === undefined ? null : validAuthor(spec.by);
  const evidence = [...new Set(spec.evidence ?? [])];
  // Waiting needs no proof; changing course does.
  if (spec.verdict !== "wait" && !evidence.length)
    throw new EngineError("invalid_decision", `A "${spec.verdict}" decision must cite at least one observation.`);
  for (const id of evidence)
    if (!db.prepare("SELECT 1 FROM observations WHERE id = ?").get(id))
      throw new EngineError("invalid_decision", `Observation ${id} does not exist.`);
  const reviewAt = spec.reviewAt ? new Date(spec.reviewAt) : null;
  if (reviewAt && Number.isNaN(reviewAt.getTime()))
    throw new EngineError("invalid_decision", "reviewAt must be an ISO date-time.");
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO decisions (action_id, verdict, rationale, evidence, review_at, decided_at, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      spec.actionId ?? null,
      spec.verdict,
      spec.rationale.trim(),
      JSON.stringify(evidence),
      reviewAt?.toISOString() ?? null,
      now.toISOString(),
      by,
    );
  return {
    id: Number(lastInsertRowid),
    actionId: spec.actionId ?? null,
    verdict: spec.verdict,
    rationale: spec.rationale.trim(),
    evidence,
    reviewAt: reviewAt?.toISOString() ?? null,
  };
}
