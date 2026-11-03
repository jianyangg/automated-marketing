import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { brandDirectory } from "../dashboard/files.mjs";
import { openStore, EngineError } from "./store.mjs";
import { propose, getAction, brandFile } from "./actions.mjs";
import { addGrant, revokeGrant, approveAction } from "./authority.mjs";
import { publish, reconcile, recordReceipt } from "./delivery.mjs";
import { observe, decide } from "./learning.mjs";
import { status } from "./status.mjs";
import { pull } from "./pull.mjs";
import { writeBrief, writeSnapshot } from "./brief.mjs";
import { importReceipts } from "./imports.mjs";
import { loadConfig } from "./config.mjs";
import { readSecret, writeSecret } from "./secrets.mjs";
import { connectThreads } from "./connect.mjs";
import { channelAdapters, metricReaders, manualAdapter } from "./adapters/index.mjs";

const USAGE = `Usage: npm run engine -- <command> --brand <id> [options]

Daily loop
  status                          Blocked sends, queue, today's allowance, north star, experiments
  pull [--days 7]                 Read post insights and daily metrics from configured providers
  propose --channel --account --hypothesis [--variable name=value] (--text | --text-file)
          [--asset path[=https://public-copy]]...
  publish <action> [--via manual] Send through the channel adapter, or hand off for manual posting
  reconcile                       Ask providers what happened to sends without a receipt
  receipt <action> (--url [--provider-id] | --absent)
  decide --verdict keep|change|stop|wait --rationale [--evidence 1,2] [--action] [--review-at]
  brief [--replace-manual-brief]  Regenerate index.md and reports/engine-snapshot.json

Records
  show <action>
  observe --metric --value <number|unavailable> --unit --from --to --source [--action] [--note] [--correct]
  import --file <path> --timezone <zone>   Add posts published outside the engine
  refresh-token --channel threads          Renew the Threads token (weekly; no-op if recent)

Owner only (interactive terminal)
  connect threads --app-id <id>            Sign in to Threads and store the token in the Keychain
  grant --channel --account --max-per-day --timezone --pause-after-failures --expires --statement
  revoke <grant>
  approve <action>

Paths are relative to the brand folder. Output is JSON.`;

const string = { type: "string" };
const options = {
  brand: string,
  root: string,
  channel: string,
  account: string,
  hypothesis: string,
  variable: string,
  text: string,
  "text-file": string,
  asset: { type: "string", multiple: true, default: [] },
  via: string,
  url: string,
  "provider-id": string,
  absent: { type: "boolean", default: false },
  metric: string,
  value: string,
  unit: string,
  from: string,
  to: string,
  source: string,
  action: string,
  note: string,
  correct: { type: "boolean", default: false },
  verdict: string,
  rationale: string,
  evidence: string,
  "review-at": string,
  "max-per-day": string,
  timezone: string,
  "pause-after-failures": string,
  expires: string,
  statement: string,
  days: { type: "string", default: "7" },
  file: string,
  "app-id": string,
  "replace-manual-brief": { type: "boolean", default: false },
  help: { type: "boolean", default: false },
};

function argument(positionals, index, name) {
  if (!positionals[index]) throw new EngineError("usage", `Missing <${name}>.\n\n${USAGE}`);
  return positionals[index];
}

// "unavailable" is the explicit way to record that a metric could not be
// read. Anything else must parse as a number; an empty string is not 0.
function parseValue(raw) {
  if (raw === "unavailable") return null;
  if (raw === undefined || raw.trim() === "")
    throw new EngineError("invalid_observation", "--value is required (a number or 'unavailable').");
  return Number(raw);
}

// "work/post.png=https://cdn.example/post.png" pairs a brand file with the
// public copy a provider will download.
function parseAsset(raw) {
  const split = raw.indexOf("=https://");
  return split === -1 ? raw : { path: raw.slice(0, split), publicUrl: raw.slice(split + 1) };
}

async function run(command, positionals, values, brandDir, db) {
  const config = await loadConfig(brandDir);
  const adapters = channelAdapters(config);
  switch (command) {
    case "status":
      return status(db, { config });
    case "show":
      return getAction(db, argument(positionals, 1, "action"));
    case "propose": {
      if (values.text !== undefined && values["text-file"] !== undefined)
        throw new EngineError("usage", "Use --text or --text-file, not both.");
      const text =
        values["text-file"] !== undefined
          ? (await brandFile(brandDir, values["text-file"])).content.toString("utf8").trim()
          : values.text;
      return propose(db, brandDir, {
        channel: values.channel,
        account: values.account,
        hypothesis: values.hypothesis,
        variable: values.variable,
        text,
        assets: values.asset.map(parseAsset),
      });
    }
    case "publish": {
      if (values.via !== undefined && values.via !== "manual")
        throw new EngineError("usage", "--via accepts only 'manual'.");
      const action = getAction(db, argument(positionals, 1, "action"));
      const route = values.via === "manual" ? { [action.channel]: manualAdapter } : adapters;
      return publish(db, brandDir, action.id, { adapters: route });
    }
    case "reconcile":
      return reconcile(db, { adapters });
    case "receipt":
      return recordReceipt(db, argument(positionals, 1, "action"), {
        url: values.url,
        providerId: values["provider-id"],
        absent: values.absent,
      });
    case "pull": {
      const days = Number(values.days);
      if (!Number.isInteger(days) || days < 1 || days > 90)
        throw new EngineError("usage", "--days must be a whole number from 1 to 90.");
      return pull(db, { config, adapters, readers: metricReaders(), days });
    }
    case "brief": {
      const view = status(db, { config });
      return {
        brief: await writeBrief(brandDir, view, config, { replaceManual: values["replace-manual-brief"] }),
        snapshot: await writeSnapshot(db, brandDir, config),
      };
    }
    case "observe":
      return observe(db, {
        metric: values.metric,
        value: parseValue(values.value),
        unit: values.unit,
        from: values.from,
        to: values.to,
        source: values.source,
        actionId: values.action,
        note: values.note,
        correct: values.correct,
      });
    case "decide":
      return decide(db, {
        verdict: values.verdict,
        rationale: values.rationale,
        evidence: values.evidence ? values.evidence.split(",").map(Number) : [],
        actionId: values.action,
        reviewAt: values["review-at"],
      });
    case "import": {
      if (!values.file) throw new EngineError("usage", "--file is required.");
      const entries = JSON.parse((await brandFile(brandDir, values.file)).content.toString("utf8"));
      return importReceipts(db, brandDir, entries, { adapters, timezone: values.timezone });
    }
    case "refresh-token": {
      const channel = config.channels[values.channel];
      if (values.channel !== "threads" || !channel)
        throw new EngineError("usage", "--channel threads must be configured in engine.json.");
      // Safe to run every day: tokens last 60 days and can only be refreshed
      // after 24 hours, so this renews weekly and otherwise does nothing.
      const current = readSecret(channel.secret);
      const ageDays = current.obtainedAt ? (Date.now() - Date.parse(current.obtainedAt)) / 86_400_000 : Infinity;
      if (ageDays < 7) return { refreshed: false, tokenAgeDays: Math.floor(ageDays) };
      const refreshed = await adapters.threads.refreshToken();
      writeSecret(channel.secret, { ...current, accessToken: refreshed.accessToken, obtainedAt: new Date().toISOString() });
      return { refreshed: values.channel, expiresInSeconds: refreshed.expiresInSeconds };
    }
    case "connect": {
      const name = argument(positionals, 1, "channel");
      const channel = config.channels[name];
      if (name !== "threads" || !channel)
        throw new EngineError("usage", "Add the threads channel (account and secret) to engine.json first.");
      return connectThreads({ brand: values.brand, account: channel.account, appId: values["app-id"] });
    }
    case "grant":
      return addGrant(db, {
        channel: values.channel,
        account: values.account,
        maxPerDay: values["max-per-day"],
        timezone: values.timezone,
        pauseAfterFailures: values["pause-after-failures"],
        expiresAt: values.expires,
        statement: values.statement,
      });
    case "revoke":
      await revokeGrant(db, Number(argument(positionals, 1, "grant")));
      return { revoked: Number(positionals[1]) };
    case "approve":
      return approveAction(db, argument(positionals, 1, "action"));
    default:
      throw new EngineError("usage", USAGE);
  }
}

let db;
try {
  const { values, positionals } = parseArgs({ options, allowPositionals: true });
  if (values.help || !positionals[0]) {
    console.log(USAGE);
  } else {
    if (!values.brand) throw new EngineError("usage", `--brand is required.\n\n${USAGE}`);
    const repository = fileURLToPath(new URL("../../", import.meta.url));
    const brandDir = await brandDirectory(resolve(values.root ?? repository), values.brand);
    db = openStore(join(brandDir, ".state", "engine.sqlite"));
    console.log(JSON.stringify(await run(positionals[0], positionals, values, brandDir, db), null, 2));
  }
} catch (error) {
  // Known errors print their code so a calling agent can react to it; anything
  // else is a bug and keeps its stack trace.
  const known =
    error instanceof EngineError || error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" || error instanceof SyntaxError;
  console.error(
    known
      ? JSON.stringify({ error: { code: error.code ?? "invalid_json", message: error.message, details: error.details } })
      : error,
  );
  process.exitCode = 1;
} finally {
  db?.close();
}
