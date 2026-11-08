import { parseConfig } from "../config.mjs";
import { observe } from "../learning.mjs";
import { addSituation, addSignal, addGap } from "../market.mjs";

// Shared setup for tests of the funnel, bets and agenda: a two-stage funnel
// on manual metrics, helpers for daily readings, and a minimal market record
// (one situation, one sourced signal, one gap) that channel bets can cite.

export const config = parseConfig({
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
});

const DAY = 86_400_000;
export const day = (start, n) => new Date(Date.parse(start) + n * DAY);

// Records one daily reading for each of `values`, starting on `from`.
export function readings(db, metric, from, values) {
  return values.map((value, index) => {
    const start = day(from, index);
    return observe(db, {
      metric,
      value,
      unit: "count",
      from: start.toISOString(),
      to: day(start.toISOString(), 1).toISOString(),
      source: "test",
    }).id;
  });
}

export function market(db) {
  addSituation(db, { id: "long-list", name: "Long list", trigger: "Too much to pick from", alternatives: "Paper list", by: "cmo" });
  const signal = addSignal(db, {
    kind: "public_complaint",
    text: "I have 200 tasks and cannot start any",
    sourceUrl: "https://example.test/thread",
    situation: "long-list",
    by: "customer-researcher",
  });
  return addGap(db, { kind: "channel", statement: "Rivals win roundups; we are absent", signals: [signal.id], by: "cmo" });
}

