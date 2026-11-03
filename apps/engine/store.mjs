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
];

export function openStore(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  const { user_version: version } = db.prepare("PRAGMA user_version").get();
  if (version > MIGRATIONS.length)
    throw new EngineError(
      "unsupported_schema",
      `State file schema v${version} is newer than this engine (v${MIGRATIONS.length}). Update the framework before using it.`,
    );
  for (let step = version; step < MIGRATIONS.length; step++)
    transaction(db, () => {
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
