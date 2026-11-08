import { activeGrant } from "./authority.mjs";
import { listBets, listTasks, MAX_RUNNING } from "./bets.mjs";
import { DAY_MS, trustOf } from "./funnel.mjs";
import { WATCH_STALE_DAYS } from "./market.mjs";

// Two ranked lists built from state by fixed rules, so any run over the same
// state agrees on them:
//   inbox  - what only the owner can do, oldest first, with a stale flag
//   agenda - what the agent should do next, most urgent first
// Judgment still belongs to the agent; these lists make sure it starts from
// the right question instead of from "what should today's post say".

export const OWNER_SLA_DAYS = 2;
const age = (iso, now) => Math.floor((now - Date.parse(iso)) / DAY_MS);

export function inbox(db, now = new Date()) {
  const items = [];
  const add = (kind, text, since, ref) => {
    const days = age(since, now);
    items.push({ kind, text, ref, since, ageDays: days, stale: days >= OWNER_SLA_DAYS });
  };
  // Proposals the agent cannot send itself: not approved and no grant.
  const waiting = db
    .prepare(
      `SELECT a.id, a.channel, a.account, a.created_at FROM actions a
       WHERE a.withdrawn_at IS NULL AND (a.approved_hash IS NULL OR a.approved_hash != a.content_hash)
         AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.action_id = a.id AND d.status != 'failed')
       ORDER BY a.created_at`,
    )
    .all();
  for (const row of waiting)
    if (!activeGrant(db, row.channel, row.account, now))
      add("approve", `Read and approve ${row.id} for ${row.channel} (\`approve ${row.id}\`).`, row.created_at, row.id);
  for (const row of db
    .prepare("SELECT action_id, channel, attempted_at FROM deliveries WHERE status = 'handoff' ORDER BY id")
    .all())
    add("post", `Post ${row.action_id} on ${row.channel} (\`show ${row.action_id}\`), then send me the link.`, row.attempted_at, row.action_id);
  const openBets = new Set(
    db.prepare("SELECT id FROM bets WHERE status IN ('proposed', 'running')").all().map((row) => row.id),
  );
  for (const task of listTasks(db, { status: "open", executor: "owner", now }).filter((t) => openBets.has(t.betId)))
    add("task", `${task.title} (task ${task.id})`, task.createdAt, String(task.id));
  for (const grant of db
    .prepare("SELECT * FROM grants WHERE revoked_at IS NULL AND expires_at > ?")
    .all(now.toISOString())) {
    const left = Math.floor((Date.parse(grant.expires_at) - now) / DAY_MS);
    if (left <= 7)
      items.push({ kind: "grant", text: `${grant.kind} grant ${grant.id} (${grant.channel}) expires in ${left} day(s).`, ref: String(grant.id), since: grant.expires_at, ageDays: 0, stale: false });
  }
  return items.sort((a, b) => b.ageDays - a.ageDays);
}

export function agenda(db, config, view, now = new Date()) {
  const items = [];
  const add = (kind, text) => items.push({ kind, text });

  for (const item of view.unresolved.filter((d) => d.status !== "handoff"))
    add("reconcile", `Reconcile delivery ${item.id} (${item.status}) before sending anything else to ${item.channel}.`);

  if (!config.funnel.length) {
    add("configure", "Add a funnel to engine.json (stages, one metric each, target daily averages) so the constraint can be found.");
    return items;
  }

  const running = listBets(db, { status: "running", now });
  const measuring = new Set(running.filter((b) => b.lever === "measurement").map((b) => b.metric));
  for (const stage of view.funnel.stages)
    if (stage.trust === "broken" && !measuring.has(stage.metric))
      add("measure", `${stage.metric} (${stage.stage}) is broken. Start a measurement bet to fix it before judging anything through it.`);

  for (const bet of running) {
    const state = bet.score.state;
    if (state === "keep") add("close", `Close ${bet.id} "${bet.title}": it met its threshold. Keep it.`);
    else if (state === "stop") add("close", `Close ${bet.id} "${bet.title}": the kill date passed below threshold. Stop or change it.`);
    else if (state === "insufficient")
      add("close", bet.extended
        ? `Close ${bet.id} "${bet.title}": still too few measured days after its one extension. Stop it.`
        : `${bet.id} "${bet.title}" reached its kill date with too few measured days. Extend it once or stop it.`);
  }

  const metrics = new Set([config.northStar, ...config.funnel.map((s) => s.metric)].filter(Boolean));
  for (const metric of metrics)
    if (trustOf(db, metric).state === "unverified" && !measuring.has(metric))
      add("verify", `${metric} is not verified. Check it end to end against a second source (record with \`trust\`) or start a measurement bet.`);

  for (const bet of running.filter((b) => b.overCap.length))
    add("budget", `${bet.id} is over its ${bet.overCap.join(", ")} cap. Decide whether it is still worth it.`);

  const open = MAX_RUNNING - running.length;
  const constraint = view.funnel.constraint;
  if (open > 0 && constraint?.stage)
    add("bet", `${open} bet slot(s) open. Start a bet on the constraint: ${constraint.stage} (${constraint.reason.replaceAll("_", " ")}). See \`playbook --rank\`.`);

  const tasks = listTasks(db, { status: "open", now });
  for (const bet of running)
    if (!tasks.some((t) => t.betId === bet.id && t.executor === "agent"))
      add("task", `${bet.id} "${bet.title}" has no open agent task. Add its next piece of work.`);

  // Posts are suggested only as work inside a running bet that uses them.
  const queued = view.proposed.filter((p) => p.betId && running.some((b) => b.id === p.betId));
  for (const grant of view.grants.filter((g) => g.kind === "post" && g.usedToday < g.maxPerDay)) {
    const next = queued.find((p) => p.channel === grant.channel && p.account === grant.account);
    if (next) add("publish", `Publish ${next.id} to ${next.channel} for ${next.betId}.`);
  }

  if (!view.market.situations.length) add("research", "No customer situations recorded. Research and record the first one or two.");
  else if (!view.market.situations.some((s) => s.firsthand > 0))
    add("research", "No situation has firsthand evidence (real users' behavior or words). Plan conversations with real users.");
  if (!view.market.competitors.length) add("research", "No competitors recorded. Record the 3-5 the customer would choose instead.");
  const due = view.market.competitors.filter((c) => c.watchDue);
  if (due.length) add("watch", `Competitor pages due for a check: ${due.map((c) => c.id).join(", ")} (\`watch\`).`);
  const lastRun = view.market.lastVisibilityRun;
  if (!lastRun || now - Date.parse(lastRun) > WATCH_STALE_DAYS * DAY_MS)
    add("visibility", "AI-visibility check is due: run the fixed prompts 10+ times per assistant and record them.");

  return items;
}
