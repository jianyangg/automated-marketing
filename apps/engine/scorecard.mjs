import { readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { openStore } from "./store.mjs";
import { loadConfig } from "./config.mjs";
import { listBets, stageGate } from "./bets.mjs";
import { funnelView, currentStage, dailyAverage, DAY_MS } from "./funnel.mjs";
import { inbox, OWNER_SLA_DAYS } from "./agenda.mjs";

// The engine's own performance review. Marketing activity is easy to inflate
// (posts sent, drafts written); these numbers are about whether the brand
// moved and what it cost, so a change to the engine can be judged by them.

const round = (value) => (value === null ? null : Math.round(value * 100) / 100);
const share = (part, whole) => (whole ? round(part / whole) : null);

// For a closed or running bet: how many metric units were measured during it
// and what each cost. Units are counted, not attributed: a bet running while
// numbers rose did not necessarily cause the rise, and daily unique users
// summed over days are person-days, not distinct people.
export function betEconomics(db, bet, config, now = new Date()) {
  if (bet.criterion !== "average_at_least" || !bet.startedAt) return null;
  const end = new Date(Math.min(Date.parse(bet.closedAt ?? now.toISOString()), Date.parse(bet.killAt), now.getTime()));
  const window = dailyAverage(db, bet.metric, bet.startedAt, end.toISOString(), { wholeDays: true });
  const units = window.averagePerDay === null ? null : round(window.averagePerDay * window.knownDays);
  const cost = round(bet.spent.money_usd + bet.spent.agent_usd);
  const value = config.economics.valuePerUnitUsd;
  return {
    metric: bet.metric,
    unitsMeasured: units,
    knownDays: window.knownDays,
    costUsd: cost,
    costPerUnitUsd: units ? round(cost / units) : null,
    valuePerCostUsd: value !== null && units !== null && cost > 0 ? round((value * units) / cost) : null,
    note: "Units measured during the bet, not units caused by it.",
  };
}

export function scorecard(db, config, now = new Date()) {
  const since28 = new Date(now.getTime() - 28 * DAY_MS).toISOString();
  const firstRecord = db
    .prepare(
      `SELECT min(at) AS at FROM (
         SELECT min(created_at) AS at FROM actions UNION ALL
         SELECT min(created_at) FROM bets UNION ALL
         SELECT min(observed_at) FROM observations)`,
    )
    .get().at;
  const bets = listBets(db, { now });
  const closed = bets.filter((b) => ["kept", "stopped", "changed"].includes(b.status));
  const overridden = db.prepare("SELECT count(*) AS n FROM decisions WHERE bet_id IS NOT NULL AND overridden = 1").get().n;
  const costs = Object.fromEntries(
    db
      .prepare("SELECT kind, sum(amount) AS total FROM costs WHERE at >= ? GROUP BY kind")
      .all(since28)
      .map((row) => [row.kind, round(row.total)]),
  );
  // Owner responsiveness: how long approvals and owner tasks waited, for the
  // ones resolved in the last 28 days.
  const waits = [
    ...db
      .prepare("SELECT created_at AS start, approved_at AS end FROM actions WHERE approved_at >= ?")
      .all(since28),
    ...db
      .prepare("SELECT created_at AS start, closed_at AS end FROM tasks WHERE executor = 'owner' AND status = 'done' AND closed_at >= ?")
      .all(since28),
  ].map((row) => (Date.parse(row.end) - Date.parse(row.start)) / DAY_MS);
  const funnel = funnelView(db, config, now);
  const north = config.northStar
    ? {
        metric: config.northStar,
        last7: dailyAverage(db, config.northStar, new Date(now - 7 * DAY_MS).toISOString(), now.toISOString()),
        prior7: dailyAverage(db, config.northStar, new Date(now - 14 * DAY_MS).toISOString(), new Date(now - 7 * DAY_MS).toISOString()),
      }
    : null;
  return {
    at: now.toISOString(),
    daysActive: firstRecord ? Math.floor((now - Date.parse(firstRecord)) / DAY_MS) : 0,
    stage: currentStage(db).stage,
    northStar: north,
    constraint: funnel.constraint,
    untrustedMetrics: funnel.stages.filter((s) => s.trust !== "verified").map((s) => `${s.metric}:${s.trust}`),
    bets: {
      running: bets.filter((b) => b.status === "running").length,
      closed: closed.length,
      kept: closed.filter((b) => b.status === "kept").length,
      hitRate: share(closed.filter((b) => b.status === "kept").length, closed.length),
      overridden,
      dropped: bets.filter((b) => b.status === "dropped").length,
    },
    last28Days: {
      moneyUsd: costs.money_usd ?? 0,
      agentUsd: costs.agent_usd ?? 0,
      ownerMinutesPerWeek: round((costs.owner_minutes ?? 0) / 4),
      postsDelivered: db.prepare("SELECT count(*) AS n FROM deliveries WHERE status = 'delivered' AND settled_at >= ?").get(since28).n,
      tasksDone: db.prepare("SELECT count(*) AS n FROM tasks WHERE status = 'done' AND closed_at >= ?").get(since28).n,
    },
    owner: {
      resolved: waits.length,
      // Same boundary as the inbox: an ask is overdue once it is 2 days old.
      withinSlaShare: share(waits.filter((days) => days < OWNER_SLA_DAYS).length, waits.length),
      overdueNow: inbox(db, now).filter((item) => item.stale).length,
    },
    closedBets: closed.map((b) => ({
      id: b.id,
      title: b.title,
      lever: b.lever,
      tactic: b.tactic,
      status: b.status,
      economics: betEconomics(db, b, config, now),
    })),
  };
}

// Every brand under <root>/brands with engine state, for cross-brand views.
export async function eachBrand(root, work) {
  const dir = join(root, "brands");
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const brandDir = join(dir, entry.name);
    const state = join(brandDir, ".state", "engine.sqlite");
    if (!(await access(state).then(() => true, () => false))) continue;
    const config = await loadConfig(brandDir);
    const db = openStore(state);
    try {
      results.push(await work({ brand: entry.name, db, config }));
    } finally {
      db.close();
    }
  }
  return results;
}

// How each playbook tactic has done in this owner's own brands. Only closed
// bets count; a tactic needs several of them before its rate means much.
export function tacticResults(perBrand) {
  const byTactic = new Map();
  for (const { brand, bets } of perBrand)
    for (const bet of bets) {
      if (!bet.tactic || !["kept", "stopped", "changed"].includes(bet.status)) continue;
      const row = byTactic.get(bet.tactic) ?? { tactic: bet.tactic, closed: 0, kept: 0, brands: new Set() };
      row.closed++;
      if (bet.status === "kept") row.kept++;
      row.brands.add(brand);
      byTactic.set(bet.tactic, row);
    }
  return [...byTactic.values()].map((row) => ({
    tactic: row.tactic,
    closed: row.closed,
    kept: row.kept,
    hitRate: share(row.kept, row.closed),
    brands: row.brands.size,
  }));
}

export const MIN_OWN_RESULTS = 3;

// Orders tactics for a brand's next bet: first those with enough of the
// owner's own results (best hit rate first), then the rest by how many
// public cases back them. Tactics the current stage does not allow are kept
// but marked, so the choice stays visible.
export function rankTactics(cards, results, { stage, lever } = {}) {
  const own = new Map(results.map((row) => [row.tactic, row]));
  return cards
    .filter((card) => !lever || card.lever === lever)
    .map((card) => {
      const result = own.get(card.id) ?? null;
      return {
        id: card.id,
        lever: card.lever,
        tactic: card.tactic,
        fits: card.fits,
        publicCases: card.cases.length,
        own: result,
        gated: stageGate(stage, { lever: card.lever, learning: false }) !== null,
      };
    })
    .sort((a, b) => {
      const aOwn = a.own?.closed >= MIN_OWN_RESULTS;
      const bOwn = b.own?.closed >= MIN_OWN_RESULTS;
      if (aOwn !== bOwn) return aOwn ? -1 : 1;
      if (aOwn && a.own.hitRate !== b.own.hitRate) return b.own.hitRate - a.own.hitRate;
      return b.publicCases - a.publicCases;
    });
}
