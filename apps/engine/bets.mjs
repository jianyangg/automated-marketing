import { randomBytes } from "node:crypto";
import { EngineError, transaction, localDate, assertPrintable } from "./store.mjs";
import { activeGrant } from "./authority.mjs";
import { DAY_MS, dailyAverage, trustOf, currentStage, validAuthor } from "./funnel.mjs";

// A bet is the unit of strategy: "doing X for situation Y should move funnel
// stage Z past threshold T by date D, for no more than these costs". Writing
// the threshold and kill date down before starting is what stops a test from
// running forever on "let's wait and see". Everything else (posts, pitches,
// page changes, conversations) is a task inside a bet.

export const LEVERS = [
  "measurement", // make a number trustworthy
  "research", // learn something a decision needs
  "conversation", // talk with real users
  "product", // onboarding, first-run, features that affect conversion
  "lifecycle", // email and in-product nudges to existing users
  "referral", // users bringing users
  "community", // helpful participation where the audience gathers
  "outreach", // pitches to writers, newsletters, roundups
  "listing", // directories and marketplaces
  "seo", // pages that answer specific searches
  "content", // the brand's own posts
  "paid", // ads
];
// Levers that spend attention on reaching new people must say which market
// gap they exploit; the rest exist to learn or to improve the product path.
const NEEDS_GAP = new Set(["community", "outreach", "listing", "seo", "content", "paid"]);
const NEEDS_SITUATION = new Set(LEVERS.filter((lever) => !["measurement", "research"].includes(lever)));

// A few bets done properly beat many done badly. Three is the most a small
// team (or one owner plus agents) can watch closely enough to learn from.
export const MAX_RUNNING = 3;
const MAX_RUN_DAYS = 56;
const MAX_EXTENSION_DAYS = 28;
export const RATIONALE_LIMIT = 280;

// Kinds whose "done" means something went public: they are recorded with the
// live link, so a draft can never count as shipped.
const PUBLIC_KINDS = new Set(["post", "reply", "listing", "pitch", "page", "email", "ad"]);

const TASK_KINDS = [
  "post", "reply", "listing", "pitch", "page", "product", "measurement",
  "research", "conversation", "email", "ad", "other",
];

function text(value, name, code = "invalid_bet") {
  if (typeof value !== "string" || !value.trim()) throw new EngineError(code, `${name} is required.`);
  return assertPrintable(value.trim(), name, code);
}

function amount(value, name) {
  const number = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(number) || number < 0)
    throw new EngineError("invalid_bet", `${name} is required and must be a number of at least 0.`);
  return number;
}

function instant(value, name, code = "invalid_bet") {
  const date = new Date(value);
  if (typeof value !== "string" || Number.isNaN(date.getTime()))
    throw new EngineError(code, `${name} must be an ISO date or date-time.`);
  return date;
}

export function rationale(value, code) {
  const clean = text(value, "rationale", code);
  if (clean.length > RATIONALE_LIMIT)
    throw new EngineError(code, `rationale must fit in ${RATIONALE_LIMIT} characters; cite evidence ids instead of retelling it.`);
  return clean;
}

function citedObservations(db, ids, code) {
  const evidence = [...new Set(ids ?? [])];
  for (const id of evidence)
    if (!Number.isInteger(id) || !db.prepare("SELECT 1 FROM observations WHERE id = ?").get(id))
      throw new EngineError(code, `Observation ${id} does not exist.`);
  return evidence;
}

export function proposeBet(db, config, spec, { now = new Date() } = {}) {
  const lever = text(spec.lever, "lever");
  if (!LEVERS.includes(lever)) throw new EngineError("invalid_bet", `lever must be one of ${LEVERS.join(", ")}.`);
  const stage = config.funnel.find((s) => s.stage === spec.funnelStage);
  if (!stage)
    throw new EngineError(
      "invalid_bet",
      `funnel stage "${spec.funnelStage}" is not in engine.json (${config.funnel.map((s) => s.stage).join(", ") || "no funnel configured"}).`,
    );
  // A measurement bet succeeds when its metric is verified; every other bet
  // succeeds when its stage's metric reaches the threshold.
  const criterion = lever === "measurement" ? "verified" : "average_at_least";
  let threshold = null;
  if (criterion === "average_at_least") {
    threshold = Number(spec.threshold);
    if (spec.threshold === undefined || !Number.isFinite(threshold) || threshold <= 0)
      throw new EngineError("invalid_bet", "threshold is required: the daily average that would count as success.");
  }
  const minKnownDays = Number(spec.minKnownDays);
  if (!Number.isInteger(minKnownDays) || minKnownDays < 1)
    throw new EngineError("invalid_bet", "min-known-days is required: how many measured days a verdict needs.");
  const killAt = instant(spec.killAt, "kill-at");
  if (killAt <= now) throw new EngineError("invalid_bet", "kill-at must be in the future.");
  if (killAt - now > MAX_RUN_DAYS * DAY_MS)
    throw new EngineError("invalid_bet", `A bet may run at most ${MAX_RUN_DAYS} days; split longer work into stages.`);
  if (killAt - now < minKnownDays * DAY_MS)
    throw new EngineError("invalid_bet", "kill-at is too soon to collect min-known-days of readings.");
  const situation = spec.situation ?? null;
  if (NEEDS_SITUATION.has(lever) && !situation)
    throw new EngineError("invalid_bet", `A ${lever} bet must name the customer situation it serves (--situation).`);
  if (situation && !db.prepare("SELECT 1 FROM situations WHERE id = ?").get(situation))
    throw new EngineError("invalid_bet", `No situation ${situation}. Record it with situation add.`);
  const gap = spec.gap === undefined || spec.gap === null ? null : Number(spec.gap);
  if (NEEDS_GAP.has(lever) && gap === null)
    throw new EngineError("invalid_bet", `A ${lever} bet must name the market gap it exploits (--gap).`);
  if (gap !== null && !db.prepare("SELECT 1 FROM gaps WHERE id = ?").get(gap))
    throw new EngineError("invalid_bet", `No gap ${spec.gap}. Record it with gap add.`);
  const bet = {
    id: `bet_${now.toISOString().slice(0, 10).replaceAll("-", "")}_${randomBytes(3).toString("hex")}`,
    title: text(spec.title, "title"),
    hypothesis: text(spec.hypothesis, "hypothesis"),
    // The strongest reason this will fail, written before it starts.
    risk: text(spec.risk, "risk"),
    lever,
    funnelStage: stage.stage,
    metric: stage.metric,
    criterion,
    threshold,
    minKnownDays,
    situation,
    gap,
    tactic: spec.tactic ? text(spec.tactic, "tactic") : null,
    capMoneyUsd: amount(spec.capMoneyUsd, "cap-money-usd"),
    capAgentUsd: amount(spec.capAgentUsd, "cap-agent-usd"),
    capOwnerMinutes: amount(spec.capOwnerMinutes, "cap-owner-minutes"),
    learning: spec.learning === true,
    killAt: killAt.toISOString(),
    by: validAuthor(spec.by),
  };
  if (lever === "paid" && bet.capMoneyUsd === 0)
    throw new EngineError("invalid_bet", "A paid bet needs a money cap above 0.");
  if (lever !== "paid" && bet.learning)
    throw new EngineError("invalid_bet", "--learning marks a small paid test; it applies only to paid bets.");
  db.prepare(
    `INSERT INTO bets (id, title, hypothesis, lever, funnel_stage, metric, criterion, threshold,
       min_known_days, situation_id, gap_id, tactic, risk, cap_money_usd, cap_agent_usd,
       cap_owner_minutes, learning, status, kill_at, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?, ?, ?)`,
  ).run(
    bet.id, bet.title, bet.hypothesis, bet.lever, bet.funnelStage, bet.metric, bet.criterion,
    bet.threshold, bet.minKnownDays, bet.situation, bet.gap, bet.tactic, bet.risk,
    bet.capMoneyUsd, bet.capAgentUsd, bet.capOwnerMinutes, bet.learning ? 1 : 0, bet.killAt, bet.by,
    now.toISOString(),
  );
  return getBet(db, bet.id, now);
}

// What each growth stage allows. Before fit, money should buy learning, not
// reach: a capped "learning" ad test is fine, scaling spend is not.
export function stageGate(stage, bet) {
  if (bet.lever === "paid" && !bet.learning && stage !== "scaling")
    return `Paid reach before the scaling stage burns money on a funnel not yet proven; mark it --learning with a small cap, or override.`;
  return null;
}

export function startBet(db, id, { overrideStage, now = new Date() } = {}) {
  return transaction(db, () => {
    const bet = getBet(db, id, now);
    if (bet.status !== "proposed") throw new EngineError("invalid_bet", `${id} is ${bet.status}, not proposed.`);
    const { running } = db.prepare("SELECT count(*) AS running FROM bets WHERE status = 'running'").get();
    if (running >= MAX_RUNNING)
      throw new EngineError("wip_limit", `${running} bets are already running. Close one before starting another.`);
    // A bet judged through a broken number can only produce a fake verdict.
    if (bet.lever !== "measurement" && trustOf(db, bet.metric).state === "broken")
      throw new EngineError("metric_broken", `${bet.metric} is marked broken. Fix it with a measurement bet first.`);
    const blocked = stageGate(currentStage(db).stage, bet);
    let override = null;
    if (blocked) {
      if (typeof overrideStage !== "string" || !overrideStage.trim())
        throw new EngineError("stage_gate", blocked);
      override = rationale(overrideStage, "stage_gate");
    }
    if (new Date(bet.killAt) - now < bet.minKnownDays * DAY_MS)
      throw new EngineError("invalid_bet", "Too little time is left before kill-at; propose it again with a later date.");
    db.prepare("UPDATE bets SET status = 'running', started_at = ?, stage_override = ? WHERE id = ?").run(
      now.toISOString(),
      override,
      id,
    );
    return getBet(db, id, now);
  });
}

// The verdict the numbers support right now. "keep" and "stop" are earned by
// data or by the kill date; "insufficient" means the kill date came before
// enough measured days did; "running" means it is too early to say.
export function score(db, row, now = new Date()) {
  if (row.status !== "running") return { state: row.status };
  const start = row.started_at;
  const end = new Date(Math.min(now.getTime(), Date.parse(row.kill_at))).toISOString();
  const pastKill = now >= new Date(row.kill_at);
  if (row.criterion === "verified") {
    const trust = trustOf(db, row.metric);
    if (trust.state === "verified" && trust.checkedAt >= start) return { state: "keep", trust: trust.state };
    return { state: pastKill ? "stop" : "running", trust: trust.state };
  }
  const { exactAverage, ...window } = dailyAverage(db, row.metric, start, end, { wholeDays: true });
  const enough = window.knownDays >= row.min_known_days;
  const hit = enough && exactAverage >= row.threshold;
  const state = hit ? "keep" : !pastKill ? "running" : enough ? "stop" : "insufficient";
  return { state, ...window, threshold: row.threshold };
}

// Spent so far per kind, and whether any cap is exceeded.
export function spent(db, betId) {
  const rows = db.prepare("SELECT kind, sum(amount) AS total FROM costs WHERE bet_id = ? GROUP BY kind").all(betId);
  const totals = { money_usd: 0, agent_usd: 0, owner_minutes: 0 };
  for (const row of rows) totals[row.kind] = Math.round(row.total * 100) / 100;
  return totals;
}

function view(db, row, now) {
  const costs = spent(db, row.id);
  const over = [];
  if (costs.money_usd > row.cap_money_usd) over.push("money_usd");
  if (costs.agent_usd > row.cap_agent_usd) over.push("agent_usd");
  if (costs.owner_minutes > row.cap_owner_minutes) over.push("owner_minutes");
  return {
    id: row.id,
    title: row.title,
    hypothesis: row.hypothesis,
    risk: row.risk,
    lever: row.lever,
    funnelStage: row.funnel_stage,
    metric: row.metric,
    criterion: row.criterion,
    threshold: row.threshold,
    minKnownDays: row.min_known_days,
    situation: row.situation_id,
    gap: row.gap_id,
    tactic: row.tactic,
    caps: { money_usd: row.cap_money_usd, agent_usd: row.cap_agent_usd, owner_minutes: row.cap_owner_minutes },
    spent: costs,
    overCap: over,
    learning: row.learning === 1,
    stageOverride: row.stage_override,
    status: row.status,
    killAt: row.kill_at,
    extended: row.extended === 1,
    startedAt: row.started_at,
    closedAt: row.closed_at,
    recordedBy: row.recorded_by,
    score: score(db, row, now),
  };
}

export function getBet(db, id, now = new Date()) {
  const row = db.prepare("SELECT * FROM bets WHERE id = ?").get(id);
  if (!row) throw new EngineError("not_found", `No bet ${id}.`);
  return view(db, row, now);
}

export function listBets(db, { status, now = new Date() } = {}) {
  const rows = status
    ? db.prepare("SELECT * FROM bets WHERE status = ? ORDER BY created_at").all(status)
    : db.prepare("SELECT * FROM bets ORDER BY created_at").all();
  return rows.map((row) => view(db, row, now));
}

// Closing is where learning happens, so the verdict must agree with the
// numbers unless the closer says, briefly, why the numbers mislead.
//   keep   - the threshold was met
//   stop   - the kill date passed without it (or too few days were measured)
//   change - same as stop, but a revised bet follows (name it in the rationale)
export function closeBet(db, id, spec, { now = new Date() } = {}) {
  return transaction(db, () => {
    const bet = getBet(db, id, now);
    if (bet.status === "proposed") {
      // Never started: nothing was learned, so it is dropped, not judged.
      if (spec.verdict !== "drop") throw new EngineError("invalid_close", `${id} never started; close it with --verdict drop.`);
      const reason = rationale(spec.rationale, "invalid_close");
      db.prepare("UPDATE bets SET status = 'dropped', closed_at = ? WHERE id = ?").run(now.toISOString(), id);
      dropOpenTasks(db, id, now);
      return { ...getBet(db, id, now), reason };
    }
    if (bet.status !== "running") throw new EngineError("invalid_close", `${id} is already ${bet.status}.`);
    if (!["keep", "stop", "change"].includes(spec.verdict))
      throw new EngineError("invalid_close", "verdict must be keep, stop or change.");
    const why = rationale(spec.rationale, "invalid_close");
    const evidence = citedObservations(db, spec.evidence, "invalid_close");
    if (bet.criterion === "average_at_least" && !evidence.length)
      throw new EngineError("invalid_close", "Closing a bet must cite the observations it was judged on.");
    const supported = { keep: ["keep"], stop: ["stop", "insufficient"], change: ["stop", "insufficient"] }[spec.verdict];
    let override = null;
    if (!supported.includes(bet.score.state)) {
      if (typeof spec.override !== "string" || !spec.override.trim())
        throw new EngineError(
          "verdict_mismatch",
          `The numbers say "${bet.score.state}", not "${spec.verdict}". Pass --override with the reason they mislead.`,
          { score: bet.score },
        );
      override = rationale(spec.override, "invalid_close");
    }
    const status = { keep: "kept", stop: "stopped", change: "changed" }[spec.verdict];
    db.prepare("UPDATE bets SET status = ?, closed_at = ? WHERE id = ?").run(status, now.toISOString(), id);
    dropOpenTasks(db, id, now);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO decisions (bet_id, verdict, rationale, evidence, decided_at, recorded_by, overridden)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        spec.verdict,
        override ? `${why} Override: ${override}` : why,
        JSON.stringify(evidence),
        now.toISOString(),
        validAuthor(spec.by),
        override ? 1 : 0,
      );
    return { ...getBet(db, id, now), decision: Number(lastInsertRowid), computed: bet.score.state, overridden: override !== null };
  });
}

// Work left open on a closed bet would sit in the owner's inbox forever and
// count against their response time, so it closes with the bet.
function dropOpenTasks(db, betId, now) {
  db.prepare("UPDATE tasks SET status = 'dropped', result = 'Bet closed.', closed_at = ? WHERE bet_id = ? AND status = 'open'").run(
    now.toISOString(),
    betId,
  );
}

// One extension, only when the data did not arrive in time. A bet that was
// measured and missed is stopped, not extended.
export function extendBet(db, id, spec, { now = new Date() } = {}) {
  const bet = getBet(db, id, now);
  if (bet.status !== "running") throw new EngineError("invalid_extend", `${id} is ${bet.status}.`);
  if (bet.extended) throw new EngineError("invalid_extend", `${id} was already extended once; close it.`);
  if (bet.criterion === "average_at_least" && bet.score.knownDays >= bet.minKnownDays)
    throw new EngineError("invalid_extend", `${id} has enough measured days for a verdict; close it instead.`);
  const reason = rationale(spec.reason, "invalid_extend");
  const to = instant(spec.to, "to", "invalid_extend");
  const from = new Date(bet.killAt);
  if (to <= from || to <= now || to - from > MAX_EXTENSION_DAYS * DAY_MS)
    throw new EngineError(
      "invalid_extend",
      `The new kill date must be in the future, after the old one, and within ${MAX_EXTENSION_DAYS} days of it.`,
    );
  db.prepare("UPDATE bets SET kill_at = ?, extended = 1 WHERE id = ?").run(to.toISOString(), id);
  return { ...getBet(db, id, now), reason };
}

// ---- tasks ---------------------------------------------------------------

function taskView(row, now) {
  return {
    id: row.id,
    betId: row.bet_id,
    kind: row.kind,
    title: row.title,
    executor: row.executor,
    channel: row.channel,
    account: row.account,
    actionId: row.action_id,
    status: row.status,
    dueAt: row.due_at,
    result: row.result,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    ageDays: Math.floor((now - Date.parse(row.created_at)) / DAY_MS),
  };
}

export function getTask(db, id, now = new Date()) {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!row) throw new EngineError("not_found", `No task ${id}.`);
  return taskView(row, now);
}

export function listTasks(db, { status, betId, executor, now = new Date() } = {}) {
  const filters = [
    ["status", status],
    ["bet_id", betId],
    ["executor", executor],
  ].filter(([, value]) => value !== undefined);
  const where = filters.map(([column]) => `${column} = ?`);
  const args = filters.map(([, value]) => value);
  return db
    .prepare(`SELECT * FROM tasks ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id`)
    .all(...args)
    .map((row) => taskView(row, now));
}

export function addTask(db, spec, { now = new Date() } = {}) {
  // One write transaction: the reply-cap count and the insert that reserves
  // the slot must happen under the same lock, or two processes adding a reply
  // at once could both see room under the cap and both reserve it.
  return transaction(db, () => insertTask(db, spec, now));
}

function insertTask(db, spec, now) {
  const bet = db.prepare("SELECT status FROM bets WHERE id = ?").get(spec.betId ?? "");
  if (!bet) throw new EngineError("invalid_task", `No bet ${spec.betId}. Every task belongs to a bet.`);
  if (!["proposed", "running"].includes(bet.status))
    throw new EngineError("invalid_task", `Bet ${spec.betId} is ${bet.status}; add work to an open bet.`);
  const kind = text(spec.kind, "kind", "invalid_task");
  if (!TASK_KINDS.includes(kind)) throw new EngineError("invalid_task", `kind must be one of ${TASK_KINDS.join(", ")}.`);
  if (!["agent", "owner"].includes(spec.executor))
    throw new EngineError("invalid_task", "executor must be agent or owner.");
  const channel = spec.channel ? text(spec.channel, "channel", "invalid_task") : null;
  const account = spec.account ? text(spec.account, "account", "invalid_task") : null;
  // An agent replying in public needs a standing reply grant for that exact
  // account. Without one, the reply is drafted as an owner task instead.
  // The reply's slot is reserved here, before anything is posted: open and
  // done agent replies created today both count against the daily cap, so
  // the cap can never be discovered only after a reply is already public.
  if (kind === "reply" && spec.executor === "agent") {
    if (!channel || !account) throw new EngineError("invalid_task", "A reply task needs --channel and --account.");
    const grant = activeGrant(db, channel, account, now, "reply");
    if (!grant)
      throw new EngineError("not_authorized", `No reply grant for ${channel} @${account}; make it an owner task with the drafted reply.`);
    const day = localDate(now, grant.timezone);
    const used = db
      .prepare(
        `SELECT created_at FROM tasks WHERE kind = 'reply' AND executor = 'agent' AND status != 'dropped'
           AND channel = ? AND account = ?`,
      )
      .all(channel, account)
      .filter((row) => localDate(new Date(row.created_at), grant.timezone) === day).length;
    if (used >= grant.max_per_day)
      throw new EngineError("daily_cap", `Already ${used} of ${grant.max_per_day} replies reserved on ${day}.`);
  }
  if (spec.actionId && !db.prepare("SELECT 1 FROM actions WHERE id = ?").get(spec.actionId))
    throw new EngineError("invalid_task", `No action ${spec.actionId}.`);
  const due = spec.dueAt ? instant(spec.dueAt, "due", "invalid_task").toISOString() : null;
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO tasks (bet_id, kind, title, executor, channel, account, action_id, status, due_at,
         recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
    )
    .run(
      spec.betId, kind, text(spec.title, "title", "invalid_task"), spec.executor, channel, account,
      spec.actionId ?? null, due, validAuthor(spec.by), now.toISOString(),
    );
  return getTask(db, Number(lastInsertRowid), now);
}

export function closeTask(db, id, spec, { now = new Date() } = {}) {
  return transaction(db, () => {
    const task = getTask(db, id, now);
    if (task.status !== "open") throw new EngineError("invalid_task", `Task ${id} is already ${task.status}.`);
    const status = spec.dropped ? "dropped" : "done";
    const result = spec.result ? text(spec.result, "result", "invalid_task") : null;
    if (status === "dropped" && !result) throw new EngineError("invalid_task", "Dropping a task needs --result saying why.");
    if (status === "done" && PUBLIC_KINDS.has(task.kind)) {
      if (!result || !/^https:\/\/\S+$/.test(result))
        throw new EngineError("invalid_task", `A finished ${task.kind} task is recorded with its live https link as --result.`);
      // The same public item recorded twice would count as two shipped.
      const twin = db.prepare("SELECT id FROM tasks WHERE result = ? AND status = 'done' AND id != ?").get(result, id);
      if (twin) throw new EngineError("invalid_task", `Task ${twin.id} already recorded ${result}.`);
    }
    // A reply is sent only while its grant is live (its slot was reserved
    // against the daily cap when the task was added).
    if (status === "done" && task.kind === "reply" && task.executor === "agent" &&
        !activeGrant(db, task.channel, task.account, now, "reply"))
      throw new EngineError("not_authorized", `The reply grant for ${task.channel} @${task.account} has ended.`);
    db.prepare("UPDATE tasks SET status = ?, result = ?, closed_at = ? WHERE id = ?").run(status, result, now.toISOString(), id);
    return getTask(db, id, now);
  });
}

// ---- costs ---------------------------------------------------------------

// Money is recorded before it is committed, and only under a spend grant whose
// total cap and the bet's own cap both still have room. Agent spend and owner
// time are recorded after the fact; going over those caps is flagged for the
// weekly review rather than refused, because the time is already spent.
export function recordCost(db, spec, { now = new Date() } = {}) {
  return transaction(db, () => {
    const bet = getBet(db, spec.betId ?? "", now);
    if (bet.status !== "running") throw new EngineError("invalid_cost", `Bet ${bet.id} is ${bet.status}, not running.`);
    if (!["money_usd", "agent_usd", "owner_minutes"].includes(spec.kind))
      throw new EngineError("invalid_cost", "kind must be money_usd, agent_usd or owner_minutes.");
    const value = Number(spec.amount);
    if (!Number.isFinite(value) || value <= 0) throw new EngineError("invalid_cost", "amount must be a positive number.");
    const note = text(spec.note, "note", "invalid_cost");
    let grantId = null;
    if (spec.kind === "money_usd") {
      const grant = activeGrant(db, spec.channel ?? "", spec.account ?? "", now, "spend");
      if (!grant)
        throw new EngineError("not_authorized", `No spend grant for ${spec.channel} @${spec.account}. Only the owner can grant spending.`);
      const { total } = db.prepare("SELECT ifnull(sum(amount), 0) AS total FROM costs WHERE grant_id = ?").get(grant.id);
      // Compared in whole cents: 0.10 + 0.20 must fit a 0.30 cap.
      if (cents(total) + cents(value) > cents(grant.cap_usd))
        throw new EngineError("spend_cap", `Grant ${grant.id} has $${round2(grant.cap_usd - total)} left of $${grant.cap_usd}.`);
      if (cents(bet.spent.money_usd) + cents(value) > cents(bet.caps.money_usd))
        throw new EngineError("spend_cap", `Bet ${bet.id} has $${round2(bet.caps.money_usd - bet.spent.money_usd)} left of its cap.`);
      const day = localDate(now, grant.timezone);
      const charges = db
        .prepare("SELECT at FROM costs WHERE grant_id = ?")
        .all(grant.id)
        .filter((row) => localDate(new Date(row.at), grant.timezone) === day).length;
      if (charges >= grant.max_per_day)
        throw new EngineError("daily_cap", `Already ${charges} of ${grant.max_per_day} charge(s) on ${day}.`);
      grantId = grant.id;
    }
    db.prepare(
      "INSERT INTO costs (bet_id, kind, amount, grant_id, note, recorded_by, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(bet.id, spec.kind, value, grantId, note, validAuthor(spec.by), now.toISOString());
    return getBet(db, bet.id, now);
  });
}

const round2 = (value) => Math.round(value * 100) / 100;
const cents = (value) => Math.round(value * 100);
