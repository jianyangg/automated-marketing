import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { EngineError, localDate } from "./store.mjs";

// `brands/<id>/engine.json` says which channels and metrics this brand uses.
// It holds identifiers only; credentials are referenced by Keychain key.
// A missing file is valid: the engine then has no adapters and no metric pulls.
//
// {
//   "name": "Business name", "goal": "More active users",
//   "northStar": "active_users",
//   "channels": { "threads": { "account": "handle", "secret": "brand/threads" } },
//   "metrics": [{ "name": "active_users", "provider": "mixpanel", "event": "task_started",
//                 "type": "unique", "projectId": 123, "region": "us",
//                 "timezone": "America/New_York", "secret": "brand/mixpanel" },
//               { "name": "search_clicks", "provider": "manual", "unit": "clicks",
//                 "timezone": "America/Los_Angeles" }],
//   "funnel": [{ "stage": "visit", "metric": "search_clicks", "target": 20 },
//              { "stage": "first_use", "metric": "active_users", "target": 10 }],
//   "economics": { "valuePerUnitUsd": null }
// }

const fail = (message) => {
  throw new EngineError("invalid_config", `engine.json: ${message}`);
};
const text = (value, name) =>
  typeof value === "string" && value.trim() ? value.trim() : fail(`${name} is required.`);

function timezone(entry, where) {
  // Daily readings are bucketed in a stated time zone. It must be stated,
  // not assumed, or every daily window would be misdated.
  try {
    localDate(new Date(), text(entry.timezone, `${where}.timezone`));
  } catch (error) {
    if (error instanceof EngineError) throw error;
    fail(`${where}.timezone is not a known time zone.`);
  }
  return entry.timezone;
}

function metric(entry, index) {
  const where = `metrics[${index}]`;
  // A "manual" metric has no API reader: its daily values are recorded with
  // `observe` (for example search clicks copied from Search Console). It still
  // needs a day boundary so funnel and bet windows line up.
  if (entry?.provider === "manual")
    return {
      name: text(entry.name, `${where}.name`),
      provider: "manual",
      unit: text(entry.unit, `${where}.unit`),
      timezone: timezone(entry, where),
    };
  if (entry?.provider !== "mixpanel") fail(`${where}.provider must be "mixpanel" or "manual".`);
  if (!Number.isInteger(entry.projectId)) fail(`${where}.projectId must be a number.`);
  if (!["general", "unique"].includes(entry.type)) fail(`${where}.type must be "general" or "unique".`);
  if (!["us", "eu", "in"].includes(entry.region)) fail(`${where}.region must be us, eu or in.`);
  timezone(entry, where);
  return {
    name: text(entry.name, `${where}.name`),
    provider: "mixpanel",
    event: text(entry.event, `${where}.event`),
    type: entry.type,
    projectId: entry.projectId,
    region: entry.region,
    timezone: entry.timezone,
    secret: text(entry.secret, `${where}.secret`),
  };
}

// With `brand` set, every credential key must belong to that brand
// ("<brand>/..."), so one brand's config can never borrow another's account.
export function parseConfig(raw, { brand } = {}) {
  const config = raw ?? {};
  const owned = (key, where) => {
    if (brand && !key.startsWith(`${brand}/`)) fail(`${where} must start with "${brand}/".`);
    return key;
  };
  const channels = {};
  for (const [channel, entry] of Object.entries(config.channels ?? {})) {
    if (channel !== "threads") fail(`channel "${channel}" has no adapter yet.`);
    channels[channel] = {
      account: text(entry?.account, `channels.${channel}.account`),
      secret: owned(text(entry?.secret, `channels.${channel}.secret`), `channels.${channel}.secret`),
    };
  }
  const metrics = (config.metrics ?? []).map(metric);
  metrics.forEach((entry, index) => entry.secret !== undefined && owned(entry.secret, `metrics[${index}].secret`));
  const names = new Set(metrics.map((m) => m.name));
  if (names.size !== metrics.length) fail("metric names must be unique.");
  if (config.northStar !== undefined && !names.has(config.northStar))
    fail(`northStar "${config.northStar}" is not one of the configured metrics.`);
  const optional = (name) => (config[name] === undefined ? null : text(config[name], name));
  return {
    name: optional("name"),
    goal: optional("goal"),
    northStar: config.northStar ?? null,
    channels,
    metrics,
    funnel: funnel(config.funnel, names),
    economics: economics(config.economics),
  };
}

// The funnel lists the stages a customer passes through, top to bottom, each
// with one daily metric and a target daily average. The target is the owner's
// or CMO's stated goal for that stage; the engine never invents one, so a
// stage without a target is a configuration error, not a silent default.
//
// "funnel": [{ "stage": "visit", "metric": "site_visits", "target": 30 },
//            { "stage": "first_use", "metric": "task_starters", "target": 10 }]
function funnel(raw, metricNames) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail("funnel must be an array of stages.");
  const stages = raw.map((entry, index) => {
    const where = `funnel[${index}]`;
    const stage = text(entry?.stage, `${where}.stage`);
    if (!/^[a-z0-9_-]+$/.test(stage)) fail(`${where}.stage must be lowercase letters, digits, _ or -.`);
    const name = text(entry.metric, `${where}.metric`);
    if (!metricNames.has(name)) fail(`${where}.metric "${name}" is not one of the configured metrics.`);
    if (typeof entry.target !== "number" || !Number.isFinite(entry.target) || entry.target <= 0)
      fail(`${where}.target must be a positive number (the goal daily average).`);
    return { stage, metric: name, target: entry.target };
  });
  if (new Set(stages.map((s) => s.stage)).size !== stages.length) fail("funnel stage names must be unique.");
  return stages;
}

// What one unit of the north star is worth, when the owner knows it. Unknown
// stays null; cost-per-result is still reported, value-based ratios are not.
function economics(raw) {
  if (raw === undefined) return { valuePerUnitUsd: null };
  const value = raw?.valuePerUnitUsd;
  if (value !== undefined && value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0))
    fail("economics.valuePerUnitUsd must be a non-negative number or null.");
  return { valuePerUnitUsd: value ?? null };
}

export async function loadConfig(brandDir) {
  let raw;
  try {
    raw = await readFile(join(brandDir, "engine.json"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return parseConfig({});
    throw error;
  }
  try {
    return parseConfig(JSON.parse(raw), { brand: basename(brandDir) });
  } catch (error) {
    if (error instanceof EngineError) throw error;
    fail("not valid JSON.");
  }
}
