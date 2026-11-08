import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { EngineError, assertPrintable } from "./store.mjs";
import { DAY_MS, validAuthor } from "./funnel.mjs";

// Customers and competitors, as evidence a bet can point at.
//
// A situation is a moment a customer is in ("long list, can't pick what to do
// today"), not a demographic. A signal is one piece of evidence, typed by
// where it came from, because the source decides how much it can carry:
//   behavior          - what real users did (must cite an engine observation)
//   user_words        - what a real user said to the business (needs consent)
//   public_complaint  - a review, thread or post anyone can read (needs a link)
//   search_demand     - what people search or ask for (needs a link)
//   ai_answer         - what an AI assistant said when asked (needs a link or
//                       is recorded through visibility runs instead)
//   competitor_change - a change seen on a competitor's own pages (needs a link)
// A gap is a claim built from signals: a promise nobody credibly owns
// (positioning) or a place competitors win where the brand is absent (channel).

const SIGNAL_KINDS = ["behavior", "user_words", "public_complaint", "search_demand", "ai_answer", "competitor_change"];
const NEEDS_LINK = new Set(["public_complaint", "search_demand", "ai_answer", "competitor_change"]);
export const WATCH_STALE_DAYS = 35;

const slug = (value, name) => {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(value))
    throw new EngineError("invalid_market", `${name} must be a short lowercase slug like "long-list-freeze".`);
  return value;
};
const text = (value, name, { optional = false } = {}) => {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== "string" || !value.trim()) throw new EngineError("invalid_market", `${name} is required.`);
  return assertPrintable(value.trim(), name, "invalid_market");
};
// The URL parser is the check, so anything stored here can be parsed again
// later (a regex alone accepts strings like "https://[").
const https = (value, name) => {
  let parsed = null;
  try {
    parsed = typeof value === "string" && !/\s/.test(value) ? new URL(value) : null;
  } catch {
    parsed = null;
  }
  if (parsed?.protocol !== "https:" || !parsed.hostname) throw new EngineError("invalid_market", `${name} must be an https link.`);
  return value;
};
const exists = (db, table, id) => db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id);

// ---- situations ----------------------------------------------------------

export function addSituation(db, spec, { now = new Date() } = {}) {
  const id = slug(spec.id, "id");
  if (exists(db, "situations", id)) throw new EngineError("invalid_market", `Situation ${id} already exists.`);
  db.prepare(
    `INSERT INTO situations (id, name, trigger_text, alternatives, objections, places, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    text(spec.name, "name"),
    text(spec.trigger, "trigger"),
    text(spec.alternatives, "alternatives"),
    text(spec.objections, "objections", { optional: true }),
    text(spec.places, "places", { optional: true }),
    validAuthor(spec.by),
    now.toISOString(),
  );
  return listSituations(db).find((s) => s.id === id);
}

export function listSituations(db) {
  return db
    .prepare("SELECT * FROM situations ORDER BY created_at")
    .all()
    .map((row) => {
      const counts = Object.fromEntries(
        db
          .prepare("SELECT kind, count(*) AS n FROM signals WHERE situation_id = ? GROUP BY kind")
          .all(row.id)
          .map((c) => [c.kind, c.n]),
      );
      return {
        id: row.id,
        name: row.name,
        trigger: row.trigger_text,
        alternatives: row.alternatives,
        objections: row.objections,
        places: row.places,
        signals: counts,
        // Only real users' behavior or words show a situation is real for
        // this product; public complaints show it exists somewhere.
        firsthand: (counts.behavior ?? 0) + (counts.user_words ?? 0),
      };
    });
}

// ---- competitors ---------------------------------------------------------

export function addCompetitor(db, spec, { now = new Date() } = {}) {
  const id = slug(spec.id, "id");
  if (exists(db, "competitors", id)) throw new EngineError("invalid_market", `Competitor ${id} already exists.`);
  const urls = (spec.urls ?? []).map((url) => https(url, "url"));
  if (!urls.length) throw new EngineError("invalid_market", "At least one --url (homepage, pricing) is required.");
  db.prepare(
    `INSERT INTO competitors (id, name, urls, positioning, pricing, audience, channels, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    text(spec.name, "name"),
    JSON.stringify(urls),
    text(spec.positioning, "positioning", { optional: true }),
    text(spec.pricing, "pricing", { optional: true }),
    text(spec.audience, "audience", { optional: true }),
    text(spec.channels, "channels", { optional: true }),
    validAuthor(spec.by),
    now.toISOString(),
  );
  return listCompetitors(db, now).find((c) => c.id === id);
}

export function listCompetitors(db, now = new Date()) {
  return db
    .prepare("SELECT * FROM competitors ORDER BY created_at")
    .all()
    .map((row) => {
      const last = db
        .prepare("SELECT max(fetched_at) AS at FROM competitor_snapshots WHERE competitor_id = ? AND error IS NULL")
        .get(row.id).at;
      return {
        id: row.id,
        name: row.name,
        urls: JSON.parse(row.urls),
        positioning: row.positioning,
        pricing: row.pricing,
        audience: row.audience,
        channels: row.channels,
        lastWatched: last,
        watchDue: !last || now - Date.parse(last) > WATCH_STALE_DAYS * DAY_MS,
        complaints: db
          .prepare("SELECT count(*) AS n FROM signals WHERE competitor_id = ? AND kind = 'public_complaint'")
          .get(row.id).n,
      };
    });
}

// Turns a page into comparable lines of visible text. Scripts, styles and
// markup are dropped so a changed build hash or tracking tag is not "news".
export function pageText(html) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
  return html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|section|tr|header|footer|article|main|nav|ul|ol|table|button|a)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name) => entities[name])
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => line !== lines[index - 1])
    .join("\n");
}

function difference(before, after, limit = 15) {
  const old = new Set(before.split("\n"));
  const now = new Set(after.split("\n"));
  const added = [...now].filter((line) => !old.has(line));
  const removed = [...old].filter((line) => !now.has(line));
  return { added: added.slice(0, limit), removed: removed.slice(0, limit), addedCount: added.length, removedCount: removed.length };
}

// Fetches every watched page, saves its visible text under
// research/competitors/<id>/, and reports what changed since the last good
// snapshot of the same page. A failed fetch is recorded as a failure, never
// as "unchanged".
export async function watchCompetitors(db, brandDir, { only, by, fetch = globalThis.fetch, now = new Date() } = {}) {
  validAuthor(by);
  const competitors = listCompetitors(db, now).filter((c) => !only || c.id === only);
  if (only && !competitors.length) throw new EngineError("not_found", `No competitor ${only}.`);
  const results = [];
  for (const competitor of competitors)
    for (const [index, url] of competitor.urls.entries()) {
      const fetchedAt = now.toISOString();
      const record = (fields) =>
        db
          .prepare(
            `INSERT INTO competitor_snapshots (competitor_id, url, http_status, content_hash, path, error, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(competitor.id, url, fields.status ?? null, fields.hash ?? null, fields.path ?? null, fields.error ?? null, fetchedAt);
      let response;
      try {
        response = await fetch(url, {
          headers: { "user-agent": "automated-marketing-engine/1 (competitor page check)", accept: "text/html" },
          redirect: "follow",
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        record({ error: error.message });
        results.push({ competitor: competitor.id, url, error: error.message });
        continue;
      }
      if (!response.ok) {
        record({ status: response.status, error: `HTTP ${response.status}` });
        results.push({ competitor: competitor.id, url, error: `HTTP ${response.status}` });
        continue;
      }
      const body = pageText(await response.text());
      const hash = createHash("sha256").update(body).digest("hex");
      // Timestamped names, so a second check on the same day never overwrites
      // the snapshot an earlier row (and the diff) points to.
      const stamp = fetchedAt.replace(/[:.]/g, "").replace("T", "-").slice(0, 17);
      const path = `research/competitors/${competitor.id}/${stamp}-${index}.txt`;
      const previous = db
        .prepare(
          `SELECT content_hash, path FROM competitor_snapshots
           WHERE competitor_id = ? AND url = ? AND error IS NULL ORDER BY id DESC LIMIT 1`,
        )
        .get(competitor.id, url);
      let before = null;
      if (previous && previous.content_hash !== hash)
        try {
          before = (await readFile(join(brandDir, previous.path), "utf8")).trim();
        } catch {
          // The older file was removed by hand; report the change without a diff.
        }
      await mkdir(join(brandDir, "research/competitors", competitor.id), { recursive: true });
      await writeFile(join(brandDir, path), `${body}\n`);
      record({ status: response.status, hash, path });
      if (!previous) results.push({ competitor: competitor.id, url, path, first: true });
      else if (previous.content_hash === hash) results.push({ competitor: competitor.id, url, path, changed: false });
      else results.push({ competitor: competitor.id, url, path, changed: true, previous: previous.path, ...(before !== null && difference(before, body)) });
    }
  return results;
}

// ---- signals and gaps ----------------------------------------------------

export function addSignal(db, spec, { now = new Date() } = {}) {
  const kind = spec.kind;
  if (!SIGNAL_KINDS.includes(kind))
    throw new EngineError("invalid_market", `kind must be one of ${SIGNAL_KINDS.join(", ")}.`);
  const sourceUrl = spec.sourceUrl ? https(spec.sourceUrl, "source-url") : null;
  if (NEEDS_LINK.has(kind) && !sourceUrl)
    throw new EngineError("invalid_market", `A ${kind} signal needs --source-url so anyone can check it.`);
  // A real person's words are used only with their agreement, and never with
  // identifying details: the text should be the quote, not who said it.
  if (kind === "user_words" && spec.consent !== true)
    throw new EngineError("invalid_market", "user_words needs --consent: the person agreed to their words being used.");
  let observationId = null;
  if (kind === "behavior") {
    observationId = Number(spec.observation);
    if (!Number.isInteger(observationId) || !exists(db, "observations", observationId))
      throw new EngineError("invalid_market", "A behavior signal must cite the --observation it summarizes.");
  }
  const situation = spec.situation ?? null;
  if (situation && !exists(db, "situations", situation)) throw new EngineError("invalid_market", `No situation ${situation}.`);
  const competitor = spec.competitor ?? null;
  if (competitor && !exists(db, "competitors", competitor)) throw new EngineError("invalid_market", `No competitor ${competitor}.`);
  const observedAt = spec.observedAt ? new Date(spec.observedAt) : now;
  if (Number.isNaN(observedAt.getTime())) throw new EngineError("invalid_market", "observed-at must be an ISO date.");
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO signals (kind, text, source_url, observation_id, situation_id, competitor_id, consent,
         recorded_by, observed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      kind,
      text(spec.text, "text"),
      sourceUrl,
      observationId,
      situation,
      competitor,
      spec.consent === true ? 1 : 0,
      validAuthor(spec.by),
      observedAt.toISOString(),
    );
  return { id: Number(lastInsertRowid), kind, situation, competitor, sourceUrl };
}

export function listSignals(db, { situation, competitor, kind, limit = 50 } = {}) {
  const filters = [
    ["situation_id", situation],
    ["competitor_id", competitor],
    ["kind", kind],
  ].filter(([, value]) => value !== undefined);
  return db
    .prepare(
      `SELECT id, kind, text, source_url AS sourceUrl, situation_id AS situation, competitor_id AS competitor,
         recorded_by AS recordedBy, observed_at AS observedAt FROM signals
       ${filters.length ? `WHERE ${filters.map(([c]) => `${c} = ?`).join(" AND ")}` : ""}
       ORDER BY id DESC LIMIT ?`,
    )
    .all(...filters.map(([, v]) => v), limit);
}

export function addGap(db, spec, { now = new Date() } = {}) {
  if (!["positioning", "channel"].includes(spec.kind))
    throw new EngineError("invalid_market", "kind must be positioning or channel.");
  const signals = [...new Set(spec.signals ?? [])];
  if (!signals.length) throw new EngineError("invalid_market", "A gap must cite the --signals it rests on.");
  for (const id of signals)
    if (!Number.isInteger(id) || !exists(db, "signals", id)) throw new EngineError("invalid_market", `No signal ${id}.`);
  const competitors = [...new Set(spec.competitors ?? [])];
  for (const id of competitors) if (!exists(db, "competitors", id)) throw new EngineError("invalid_market", `No competitor ${id}.`);
  const { lastInsertRowid } = db
    .prepare("INSERT INTO gaps (kind, statement, signals, competitors, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(spec.kind, text(spec.statement, "statement"), JSON.stringify(signals), JSON.stringify(competitors), validAuthor(spec.by), now.toISOString());
  return { id: Number(lastInsertRowid), kind: spec.kind, signals, competitors };
}

export function listGaps(db) {
  return db
    .prepare("SELECT * FROM gaps ORDER BY id")
    .all()
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      statement: row.statement,
      signals: JSON.parse(row.signals),
      competitors: JSON.parse(row.competitors),
      bets: db.prepare("SELECT count(*) AS n FROM bets WHERE gap_id = ?").get(row.id).n,
    }));
}

// ---- AI visibility -------------------------------------------------------

export function recordVisibility(db, spec, { now = new Date() } = {}) {
  const prompt = text(spec.prompt, "prompt");
  const assistant = slug(spec.assistant, "assistant");
  if (!["yes", "no"].includes(spec.mentioned)) throw new EngineError("invalid_market", "--mentioned must be yes or no.");
  const mentions = (spec.mentions ?? []).map((name) => text(name, "mention"));
  const citations = (spec.citations ?? []).map((url) => https(url, "citation"));
  const ranAt = spec.ranAt ? new Date(spec.ranAt) : now;
  if (Number.isNaN(ranAt.getTime())) throw new EngineError("invalid_market", "ran-at must be an ISO date.");
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO visibility_runs (prompt, assistant, mentioned, mentions, citations, recorded_by, ran_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(prompt, assistant, spec.mentioned === "yes" ? 1 : 0, JSON.stringify(mentions), JSON.stringify(citations), validAuthor(spec.by), ranAt.toISOString());
  return { id: Number(lastInsertRowid), prompt, assistant, mentioned: spec.mentioned === "yes" };
}

// Mention rate per prompt and assistant, plus the pages assistants cite most.
// Those cited pages are where outreach should aim.
export function visibilityReport(db, { days = 30, now = new Date() } = {}) {
  const since = new Date(now.getTime() - days * DAY_MS).toISOString();
  const rows = db.prepare("SELECT * FROM visibility_runs WHERE ran_at >= ?").all(since);
  const groups = new Map();
  const domains = new Map();
  const brands = new Map();
  for (const row of rows) {
    const key = `${row.prompt}\u0000${row.assistant}`;
    const group = groups.get(key) ?? { prompt: row.prompt, assistant: row.assistant, runs: 0, mentioned: 0 };
    group.runs++;
    group.mentioned += row.mentioned;
    groups.set(key, group);
    for (const url of JSON.parse(row.citations)) {
      let host;
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        continue; // Rows from before links were parsed on entry.
      }
      domains.set(host, (domains.get(host) ?? 0) + 1);
    }
    for (const name of JSON.parse(row.mentions)) brands.set(name, (brands.get(name) ?? 0) + 1);
  }
  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  return {
    days,
    runs: rows.length,
    prompts: [...groups.values()].map((g) => ({ ...g, mentionRate: Math.round((g.mentioned / g.runs) * 100) / 100 })),
    citedDomains: top(domains),
    mentionedBrands: top(brands),
  };
}

// One compact view of what the brand knows about its market and what is stale.
export function marketView(db, now = new Date()) {
  const situations = listSituations(db);
  const competitors = listCompetitors(db, now);
  return {
    situations: situations.map(({ id, name, signals, firsthand }) => ({ id, name, signals, firsthand })),
    competitors: competitors.map(({ id, name, lastWatched, watchDue, complaints }) => ({ id, name, lastWatched, watchDue, complaints })),
    gaps: listGaps(db).map(({ id, kind, statement, bets }) => ({ id, kind, statement, bets })),
    lastVisibilityRun: db.prepare("SELECT max(ran_at) AS at FROM visibility_runs").get().at,
  };
}
