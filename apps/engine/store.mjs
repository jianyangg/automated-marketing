import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Errors carry a stable machine-readable `code` so the CLI (and the agent
// calling it) can branch on the reason instead of parsing English text.
export class EngineError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    if (details) this.details = details;
  }
}

// Terminal control codes and bidirectional overrides can make text display
// differently from what it contains, so an approval prompt could show the
// owner one post while another is sent. Anything shown at an owner prompt must
// be plain printable text: only newline and tab are allowed as controls.
const DECEPTIVE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/;

export function assertPrintable(value, name, code) {
  if (typeof value === "string" && DECEPTIVE.test(value))
    throw new EngineError(code, `${name} contains control or text-direction characters.`);
  return value;
}

// Each entry upgrades the schema by one version. SQLite's `user_version`
// pragma records how many have run, so opening an old file applies only the
// missing steps. Append new steps; never edit a shipped one.
const MIGRATIONS = [
  `
  CREATE TABLE grants (
    id INTEGER PRIMARY KEY,
    channel TEXT NOT NULL,
    account TEXT NOT NULL,
    max_per_day INTEGER NOT NULL CHECK (max_per_day > 0),
    timezone TEXT NOT NULL,
    pause_after_failures INTEGER NOT NULL CHECK (pause_after_failures > 0),
    expires_at TEXT NOT NULL,
    statement TEXT NOT NULL,
    authorized_via TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT
  );

  -- An action is immutable once proposed: its content hash is what an
  -- approval or a delivery refers to. Changing copy means proposing anew.
  CREATE TABLE actions (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    account TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    payload TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    approved_hash TEXT,
    approved_at TEXT,
    approved_via TEXT
  );

  CREATE TABLE deliveries (
    id INTEGER PRIMARY KEY,
    action_id TEXT NOT NULL REFERENCES actions(id),
    grant_id INTEGER REFERENCES grants(id),
    channel TEXT NOT NULL,
    account TEXT NOT NULL,
    status TEXT NOT NULL
      CHECK (status IN ('attempting', 'delivered', 'failed', 'unknown', 'handoff')),
    local_date TEXT NOT NULL,
    attempted_at TEXT NOT NULL,
    settled_at TEXT,
    provider_id TEXT,
    url TEXT,
    error TEXT
  );
  -- The duplicate-send guard: an action may have many failed attempts but at
  -- most one attempt that might have reached the audience.
  CREATE UNIQUE INDEX one_live_delivery_per_action
    ON deliveries(action_id) WHERE status != 'failed';

  CREATE TABLE observations (
    id INTEGER PRIMARY KEY,
    metric TEXT NOT NULL,
    value REAL,
    unit TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    source TEXT NOT NULL,
    action_id TEXT REFERENCES actions(id),
    note TEXT,
    observed_at TEXT NOT NULL,
    supersedes INTEGER REFERENCES observations(id),
    is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1))
  );
  -- Corrections add a row rather than overwrite one, so history survives,
  -- but only one reading per metric/source/window counts as current.
  CREATE UNIQUE INDEX one_current_reading
    ON observations(metric, source, window_start, window_end, ifnull(action_id, ''))
    WHERE is_current = 1;

  CREATE TABLE decisions (
    id INTEGER PRIMARY KEY,
    action_id TEXT REFERENCES actions(id),
    verdict TEXT NOT NULL CHECK (verdict IN ('keep', 'change', 'stop', 'wait')),
    rationale TEXT NOT NULL,
    evidence TEXT NOT NULL,
    review_at TEXT,
    decided_at TEXT NOT NULL
  );
  `,
  // v2: each action names the one thing it varies (e.g. "hook=question"),
  // so results can be compared across posts that differ in that one way.
  `ALTER TABLE actions ADD COLUMN variable TEXT;`,
  // v3: the engine models the business, not just the posting queue. A bet is
  // a time-boxed attempt to move one funnel stage, with its success threshold,
  // cost caps and kill date fixed before it starts. Tasks are any unit of work
  // inside a bet (a post is one kind). Customers, competitors and gaps are
  // the evidence bets must point at. Every agent-written row names its author.
  `
  -- The brand's growth stage. Latest row wins; history explains each change.
  CREATE TABLE stage_changes (
    id INTEGER PRIMARY KEY,
    stage TEXT NOT NULL CHECK (stage IN ('finding-fit', 'early-traction', 'scaling')),
    rationale TEXT NOT NULL,
    evidence TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    changed_at TEXT NOT NULL
  );

  -- Whether a metric's numbers can be believed. Latest check per metric wins.
  CREATE TABLE metric_checks (
    id INTEGER PRIMARY KEY,
    metric TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('verified', 'unverified', 'broken')),
    note TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    checked_at TEXT NOT NULL
  );

  CREATE TABLE situations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_text TEXT NOT NULL,
    alternatives TEXT NOT NULL,
    objections TEXT,
    places TEXT,
    recorded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE competitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    urls TEXT NOT NULL,
    positioning TEXT,
    pricing TEXT,
    audience TEXT,
    channels TEXT,
    recorded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE competitor_snapshots (
    id INTEGER PRIMARY KEY,
    competitor_id TEXT NOT NULL REFERENCES competitors(id),
    url TEXT NOT NULL,
    http_status INTEGER,
    content_hash TEXT,
    path TEXT,
    error TEXT,
    fetched_at TEXT NOT NULL
  );

  -- One piece of customer or market evidence. Public kinds need a source
  -- link; a real user's words need recorded consent.
  CREATE TABLE signals (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('behavior', 'user_words', 'public_complaint',
      'search_demand', 'ai_answer', 'competitor_change')),
    text TEXT NOT NULL,
    source_url TEXT,
    observation_id INTEGER REFERENCES observations(id),
    situation_id TEXT REFERENCES situations(id),
    competitor_id TEXT REFERENCES competitors(id),
    consent INTEGER NOT NULL DEFAULT 0 CHECK (consent IN (0, 1)),
    recorded_by TEXT NOT NULL,
    observed_at TEXT NOT NULL
  );

  CREATE TABLE gaps (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('positioning', 'channel')),
    statement TEXT NOT NULL,
    signals TEXT NOT NULL,
    competitors TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- One run of one prompt on one AI assistant. Answers vary run to run, so
  -- visibility is a mention rate over many runs, never a single rank.
  CREATE TABLE visibility_runs (
    id INTEGER PRIMARY KEY,
    prompt TEXT NOT NULL,
    assistant TEXT NOT NULL,
    mentioned INTEGER NOT NULL CHECK (mentioned IN (0, 1)),
    mentions TEXT NOT NULL,
    citations TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    ran_at TEXT NOT NULL
  );

  CREATE TABLE bets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    lever TEXT NOT NULL,
    funnel_stage TEXT NOT NULL,
    metric TEXT NOT NULL,
    criterion TEXT NOT NULL CHECK (criterion IN ('average_at_least', 'verified')),
    threshold REAL,
    min_known_days INTEGER NOT NULL CHECK (min_known_days > 0),
    situation_id TEXT REFERENCES situations(id),
    gap_id INTEGER REFERENCES gaps(id),
    tactic TEXT,
    risk TEXT NOT NULL,
    cap_money_usd REAL NOT NULL CHECK (cap_money_usd >= 0),
    cap_agent_usd REAL NOT NULL CHECK (cap_agent_usd >= 0),
    cap_owner_minutes REAL NOT NULL CHECK (cap_owner_minutes >= 0),
    learning INTEGER NOT NULL DEFAULT 0 CHECK (learning IN (0, 1)),
    stage_override TEXT,
    status TEXT NOT NULL CHECK (status IN ('proposed', 'running', 'kept', 'stopped', 'changed', 'dropped')),
    kill_at TEXT NOT NULL,
    extended INTEGER NOT NULL DEFAULT 0 CHECK (extended IN (0, 1)),
    recorded_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    started_at TEXT,
    closed_at TEXT
  );

  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY,
    bet_id TEXT NOT NULL REFERENCES bets(id),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    executor TEXT NOT NULL CHECK (executor IN ('agent', 'owner')),
    channel TEXT,
    account TEXT,
    action_id TEXT REFERENCES actions(id),
    status TEXT NOT NULL CHECK (status IN ('open', 'done', 'dropped')),
    due_at TEXT,
    result TEXT,
    recorded_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    closed_at TEXT
  );

  CREATE TABLE costs (
    id INTEGER PRIMARY KEY,
    bet_id TEXT NOT NULL REFERENCES bets(id),
    kind TEXT NOT NULL CHECK (kind IN ('money_usd', 'agent_usd', 'owner_minutes')),
    amount REAL NOT NULL CHECK (amount > 0),
    grant_id INTEGER REFERENCES grants(id),
    note TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    at TEXT NOT NULL
  );

  ALTER TABLE actions ADD COLUMN bet_id TEXT REFERENCES bets(id);
  ALTER TABLE decisions ADD COLUMN bet_id TEXT REFERENCES bets(id);
  ALTER TABLE decisions ADD COLUMN recorded_by TEXT;
  -- Set when a bet was closed against what its numbers said.
  ALTER TABLE decisions ADD COLUMN overridden INTEGER NOT NULL DEFAULT 0 CHECK (overridden IN (0, 1));
  -- Grants now cover kinds of action, not only posts. A spend grant caps the
  -- total money that may be recorded against it.
  ALTER TABLE grants ADD COLUMN kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'reply', 'spend'));
  ALTER TABLE grants ADD COLUMN cap_usd REAL;
  -- A proposal that will never go out (superseded copy, dropped idea) is
  -- withdrawn rather than left in the queue forever.
  ALTER TABLE actions ADD COLUMN withdrawn_at TEXT;
  ALTER TABLE actions ADD COLUMN withdrawn_reason TEXT;
  `,
];

export function openStore(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // The busy timeout must come first: switching to WAL takes a lock, and
  // without a timeout a second process opening the file at the same moment
  // fails with "database is locked" instead of waiting its turn.
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const { user_version: version } = db.prepare("PRAGMA user_version").get();
  if (version > MIGRATIONS.length)
    throw new EngineError(
      "unsupported_schema",
      `State file schema v${version} is newer than this engine (v${MIGRATIONS.length}). Update the framework before using it.`,
    );
  for (let step = version; step < MIGRATIONS.length; step++)
    transaction(db, () => {
      // Another process may have applied this step while we waited for the
      // write lock (parallel agents opening an old file at once), so re-read
      // the version inside the lock and skip what is already done.
      if (db.prepare("PRAGMA user_version").get().user_version > step) return;
      db.exec(MIGRATIONS[step]);
      db.exec(`PRAGMA user_version = ${step + 1}`);
    });
  return db;
}

// BEGIN IMMEDIATE takes the write lock up front, so two runs that overlap
// (say a 9 AM run that overran into the 5 PM one) cannot both pass the
// "already sent today?" check before either records its send.
export function transaction(db, work) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// "2026-11-02" plus n days, using UTC arithmetic so DST never shifts it.
export function addDays(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// How far a time zone's wall clock is ahead of UTC at a given instant.
function offsetMs(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const wall = Date.UTC(+parts.year, parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - instant.getTime();
}

// The UTC instant when a calendar date starts in a time zone. The second
// pass corrects for days when the offset changes (daylight saving).
export function startOfDay(date, timeZone) {
  const [y, m, d] = date.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d);
  for (let pass = 0; pass < 2; pass++) guess = Date.UTC(y, m - 1, d) - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

// The calendar date at `now` in an IANA time zone, e.g. "2026-11-02".
// Throws for an unknown zone, which doubles as time zone validation.
export function localDate(now, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
