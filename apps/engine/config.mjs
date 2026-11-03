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
//                 "timezone": "America/New_York", "secret": "brand/mixpanel" }]
// }

const fail = (message) => {
  throw new EngineError("invalid_config", `engine.json: ${message}`);
};
const text = (value, name) =>
  typeof value === "string" && value.trim() ? value.trim() : fail(`${name} is required.`);

function metric(entry, index) {
  const where = `metrics[${index}]`;
  if (entry?.provider !== "mixpanel") fail(`${where}.provider must be "mixpanel".`);
  if (!Number.isInteger(entry.projectId)) fail(`${where}.projectId must be a number.`);
  if (!["general", "unique"].includes(entry.type)) fail(`${where}.type must be "general" or "unique".`);
  if (!["us", "eu", "in"].includes(entry.region)) fail(`${where}.region must be us, eu or in.`);
  // Mixpanel buckets days in the project's own time zone. It must be stated,
  // not assumed, or every daily window would be misdated.
  try {
    localDate(new Date(), text(entry.timezone, `${where}.timezone`));
  } catch (error) {
    if (error instanceof EngineError) throw error;
    fail(`${where}.timezone is not a known time zone.`);
  }
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
  metrics.forEach((entry, index) => owned(entry.secret, `metrics[${index}].secret`));
  const names = new Set(metrics.map((m) => m.name));
  if (names.size !== metrics.length) fail("metric names must be unique.");
  if (config.northStar !== undefined && !names.has(config.northStar))
    fail(`northStar "${config.northStar}" is not one of the configured metrics.`);
  const optional = (name) => (config[name] === undefined ? null : text(config[name], name));
  return { name: optional("name"), goal: optional("goal"), northStar: config.northStar ?? null, channels, metrics };
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
