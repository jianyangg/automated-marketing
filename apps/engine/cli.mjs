import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { brandDirectory } from "../dashboard/files.mjs";
import { openStore, EngineError } from "./store.mjs";
import { propose, getAction, brandFile, withdrawAction } from "./actions.mjs";
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
import { loadPlaybook } from "./playbook.mjs";
import { lintCopy } from "./copylint.mjs";
import { channelAdapters, metricReaders, manualAdapter } from "./adapters/index.mjs";
import { proposeBet, startBet, closeBet, extendBet, getBet, listBets, addTask, closeTask, listTasks, recordCost } from "./bets.mjs";
import { funnelView, recordCheck, currentStage, setStage } from "./funnel.mjs";
import {
  addSituation, listSituations, addCompetitor, listCompetitors, watchCompetitors, addSignal, listSignals,
  addGap, listGaps, recordVisibility, visibilityReport, marketView,
} from "./market.mjs";
import { scorecard, eachBrand, tacticResults, rankTactics } from "./scorecard.mjs";
import { inbox } from "./agenda.mjs";

const USAGE = `Usage: npm run engine -- <command> --brand <id> [options]
Commands that write records take --by <role> (cmo, competitor-watcher, ...).

Every run
  status                          Funnel, running bets, owner inbox, agenda, queue
  agenda | inbox | funnel         The agent's next steps / what waits on the owner / stage numbers
  pull [--days 7]                 Read post insights and daily metrics from configured providers
  reconcile                       Ask providers what happened to sends without a receipt
  brief [--replace-manual-brief]  Regenerate index.md and reports/engine-snapshot.json

Bets and work
  bet propose --title --hypothesis --risk --lever --funnel-stage --min-known-days --kill-at
              --cap-money-usd --cap-agent-usd --cap-owner-minutes [--threshold] [--situation]
              [--gap] [--tactic] [--learning] --by
  bet start <bet> [--override-stage "<why>"]
  bet close <bet> --verdict keep|stop|change|drop --rationale [--evidence 1,2] [--override] --by
  bet extend <bet> --to <date> --reason      (once, only when too few days were measured)
  bet show <bet> | bet list [--status running]
  task add --bet --kind --title --executor agent|owner [--channel --account --due --action] --by
  task done <task> [--result] | task drop <task> --result "<why>" | task list [--status --bet --executor]
  cost --bet --kind money_usd|agent_usd|owner_minutes --amount --note [--channel --account] --by
  trust --metric --state verified|unverified|broken --note "<how it was checked>" --by
  stage [--set <stage> --rationale [--evidence 1,2] --by]

Posts
  propose --channel --account --hypothesis [--bet] [--variable name=value] (--text | --text-file)
          [--asset path[=https://public-copy]]...
  publish <action> [--via manual] Send through the channel adapter, or hand off for manual posting
  receipt <action> (--url [--provider-id] | --absent)
  withdraw <action> --reason      Take a proposal that will never go out off the queue
  show <action>

Market
  situation add --id --name --trigger --alternatives [--objections --places] --by | situation list
  competitor add --id --name --page <url>... [--positioning --pricing --audience --channels] --by
  competitor list | watch [--competitor <id>] --by
  signal add --kind --text [--source-url --situation --competitor --observation --consent --observed-at] --by
  signal list [--situation --competitor --kind] | gap add --kind --statement --signals 1,2 [--competitors a,b] --by
  gap list | market
  visibility record --prompt --assistant --mentioned yes|no [--mentions a,b] [--citations url,url] --by
  visibility report [--days 30]

Learning and review
  observe --metric --value <number|unavailable> --unit --from --to --source [--action] [--note] [--correct]
  decide --verdict keep|change|stop|wait --rationale [--evidence 1,2] [--action] [--review-at] [--by]
  scorecard [--all]               How the brand (or every brand) is doing and what it cost
  playbook [--tactic <id> | --rank [--lever] | --results]
  lint-copy (--file <path> | --text "...")  Flag machine-writing tells before owner approval
  import --file <path> --timezone <zone>   Add posts published outside the engine
  refresh-token --channel threads          Renew the Threads token (weekly; no-op if recent)

Owner only (interactive terminal)
  connect threads --app-id <id>            Sign in to Threads and store the token in the Keychain
  grant [--kind post|reply|spend] --channel --account --max-per-day --timezone
        --pause-after-failures --expires --statement [--cap-usd]
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
  days: string,
  file: string,
  "app-id": string,
  tactic: string,
  "replace-manual-brief": { type: "boolean", default: false },
  help: { type: "boolean", default: false },
  by: string,
  bet: string,
  kind: string,
  title: string,
  risk: string,
  lever: string,
  "funnel-stage": string,
  threshold: string,
  "min-known-days": string,
  "kill-at": string,
  "cap-money-usd": string,
  "cap-agent-usd": string,
  "cap-owner-minutes": string,
  "cap-usd": string,
  situation: string,
  gap: string,
  learning: { type: "boolean", default: false },
  "override-stage": string,
  override: string,
  reason: string,
  executor: string,
  due: string,
  result: string,
  status: string,
  amount: string,
  state: string,
  set: string,
  id: string,
  name: string,
  trigger: string,
  alternatives: string,
  objections: string,
  places: string,
  page: { type: "string", multiple: true, default: [] },
  positioning: string,
  pricing: string,
  audience: string,
  channels: string,
  competitor: string,
  "source-url": string,
  observation: string,
  consent: { type: "boolean", default: false },
  "observed-at": string,
  signals: string,
  competitors: string,
  prompt: string,
  assistant: string,
  mentioned: string,
  mentions: string,
  citations: string,
  "ran-at": string,
  all: { type: "boolean", default: false },
  rank: { type: "boolean", default: false },
  results: { type: "boolean", default: false },
};

// "1,2,3" -> [1, 2, 3]. Anything that is not a whole number fails loudly
// instead of being dropped, so a typo can never cite the wrong evidence.
function ids(raw, name) {
  if (raw === undefined || raw === "") return [];
  return raw.split(",").map((part) => {
    const id = Number(part.trim());
    if (!Number.isInteger(id)) throw new EngineError("usage", `--${name} must be comma-separated numbers.`);
    return id;
  });
}
const list = (raw) => (raw === undefined || raw === "" ? [] : raw.split(",").map((part) => part.trim()).filter(Boolean));

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

const NEEDS_CONFIG = new Set([
  "status", "agenda", "funnel", "pull", "brief", "bet", "scorecard", "publish", "reconcile", "import",
  "refresh-token", "connect",
]);

async function run(command, positionals, values, brandDir, db, root) {
  // Only commands that use the brand's configuration load it, so a mistake in
  // engine.json can never block revoking a grant, withdrawing a proposal or
  // reading a record.
  const config = NEEDS_CONFIG.has(command) ? await loadConfig(brandDir) : null;
  const adapters = config ? channelAdapters(config) : {};
  switch (command) {
    case "status":
      return status(db, { config });
    case "lint-copy": {
      const text =
        values.file !== undefined ? (await brandFile(brandDir, values.file)).content.toString("utf8") : values.text;
      if (typeof text !== "string" || !text.trim()) throw new EngineError("usage", "Pass --file or --text.");
      const result = lintCopy(text);
      if (!result.ok) process.exitCode = 1;
      return result;
    }
    case "playbook": {
      const cards = await loadPlaybook();
      if (values.results || values.rank) {
        const perBrand = await eachBrand(root, ({ brand, db: other }) => ({ brand, bets: listBets(other) }));
        const results = tacticResults(perBrand);
        if (values.results) return results;
        return rankTactics(cards, results, { stage: currentStage(db).stage, lever: values.lever });
      }
      if (!values.tactic) return cards.map(({ id, tactic, lever, fits, execution }) => ({ id, tactic, lever, fits, execution }));
      const card = cards.find((item) => item.id === values.tactic);
      if (!card) throw new EngineError("not_found", `No tactic ${values.tactic}.`);
      return card;
    }
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
        betId: values.bet,
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
      const days = Number(values.days ?? "7");
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
        evidence: ids(values.evidence, "evidence"),
        actionId: values.action,
        reviewAt: values["review-at"],
        by: values.by,
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
        kind: values.kind,
        capUsd: values["cap-usd"],
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
    case "withdraw":
      return withdrawAction(db, argument(positionals, 1, "action"), values.reason);
    case "agenda":
      return status(db, { config }).agenda;
    case "inbox":
      return inbox(db);
    case "funnel":
      return funnelView(db, config);
    case "bet": {
      const sub = argument(positionals, 1, "propose|start|close|extend|show|list");
      if (sub === "propose")
        return proposeBet(db, config, {
          title: values.title,
          hypothesis: values.hypothesis,
          risk: values.risk,
          lever: values.lever,
          funnelStage: values["funnel-stage"],
          threshold: values.threshold,
          minKnownDays: values["min-known-days"],
          killAt: values["kill-at"],
          capMoneyUsd: values["cap-money-usd"],
          capAgentUsd: values["cap-agent-usd"],
          capOwnerMinutes: values["cap-owner-minutes"],
          situation: values.situation,
          gap: values.gap,
          tactic: values.tactic,
          learning: values.learning,
          by: values.by,
        });
      if (sub === "list") return listBets(db, { status: values.status });
      const id = argument(positionals, 2, "bet");
      if (sub === "show") return getBet(db, id);
      if (sub === "start") return startBet(db, id, { overrideStage: values["override-stage"] });
      if (sub === "close")
        return closeBet(db, id, {
          verdict: values.verdict,
          rationale: values.rationale,
          evidence: ids(values.evidence, "evidence"),
          override: values.override,
          by: values.by,
        });
      if (sub === "extend") return extendBet(db, id, { to: values.to, reason: values.reason });
      throw new EngineError("usage", `Unknown bet command ${sub}.`);
    }
    case "task": {
      const sub = argument(positionals, 1, "add|done|drop|list");
      if (sub === "add")
        return addTask(db, {
          betId: values.bet,
          kind: values.kind,
          title: values.title,
          executor: values.executor,
          channel: values.channel,
          account: values.account,
          dueAt: values.due,
          actionId: values.action,
          by: values.by,
        });
      if (sub === "list") return listTasks(db, { status: values.status, betId: values.bet, executor: values.executor });
      const id = Number(argument(positionals, 2, "task"));
      if (sub === "done") return closeTask(db, id, { result: values.result });
      if (sub === "drop") return closeTask(db, id, { result: values.result, dropped: true });
      throw new EngineError("usage", `Unknown task command ${sub}.`);
    }
    case "cost":
      return recordCost(db, {
        betId: values.bet,
        kind: values.kind,
        amount: values.amount,
        note: values.note,
        channel: values.channel,
        account: values.account,
        by: values.by,
      });
    case "trust":
      return recordCheck(db, { metric: values.metric, state: values.state, note: values.note, by: values.by });
    case "stage":
      if (values.set === undefined) return currentStage(db);
      return setStage(db, { stage: values.set, rationale: values.rationale, evidence: ids(values.evidence, "evidence"), by: values.by });
    case "situation": {
      const sub = argument(positionals, 1, "add|list");
      if (sub === "list") return listSituations(db);
      if (sub === "add")
        return addSituation(db, {
          id: values.id,
          name: values.name,
          trigger: values.trigger,
          alternatives: values.alternatives,
          objections: values.objections,
          places: values.places,
          by: values.by,
        });
      throw new EngineError("usage", `Unknown situation command ${sub}.`);
    }
    case "competitor": {
      const sub = argument(positionals, 1, "add|list");
      if (sub === "list") return listCompetitors(db);
      if (sub === "add")
        return addCompetitor(db, {
          id: values.id,
          name: values.name,
          urls: values.page,
          positioning: values.positioning,
          pricing: values.pricing,
          audience: values.audience,
          channels: values.channels,
          by: values.by,
        });
      throw new EngineError("usage", `Unknown competitor command ${sub}.`);
    }
    case "watch":
      return watchCompetitors(db, brandDir, { only: values.competitor, by: values.by });
    case "signal": {
      const sub = argument(positionals, 1, "add|list");
      if (sub === "list") return listSignals(db, { situation: values.situation, competitor: values.competitor, kind: values.kind });
      if (sub === "add")
        return addSignal(db, {
          kind: values.kind,
          text: values.text,
          sourceUrl: values["source-url"],
          situation: values.situation,
          competitor: values.competitor,
          observation: values.observation,
          consent: values.consent,
          observedAt: values["observed-at"],
          by: values.by,
        });
      throw new EngineError("usage", `Unknown signal command ${sub}.`);
    }
    case "gap": {
      const sub = argument(positionals, 1, "add|list");
      if (sub === "list") return listGaps(db);
      if (sub === "add")
        return addGap(db, {
          kind: values.kind,
          statement: values.statement,
          signals: ids(values.signals, "signals"),
          competitors: list(values.competitors),
          by: values.by,
        });
      throw new EngineError("usage", `Unknown gap command ${sub}.`);
    }
    case "market":
      return marketView(db);
    case "visibility": {
      const sub = argument(positionals, 1, "record|report");
      if (sub === "report") {
        const days = Number(values.days ?? "30");
        if (!Number.isInteger(days) || days < 1 || days > 365)
          throw new EngineError("usage", "--days must be a whole number from 1 to 365.");
        return visibilityReport(db, { days });
      }
      if (sub === "record")
        return recordVisibility(db, {
          prompt: values.prompt,
          assistant: values.assistant,
          mentioned: values.mentioned,
          mentions: list(values.mentions),
          citations: list(values.citations),
          ranAt: values["ran-at"],
          by: values.by,
        });
      throw new EngineError("usage", `Unknown visibility command ${sub}.`);
    }
    case "scorecard":
      if (!values.all) return scorecard(db, config);
      // The current brand's database is already open; every brand, this one
      // included, is opened afresh so the views are computed the same way.
      return eachBrand(root, ({ brand, db: other, config: otherConfig }) => ({ brand, ...scorecard(other, otherConfig) }));
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
    const root = resolve(values.root ?? repository);
    const brandDir = await brandDirectory(root, values.brand);
    db = openStore(join(brandDir, ".state", "engine.sqlite"));
    console.log(JSON.stringify(await run(positionals[0], positionals, values, brandDir, db, root), null, 2));
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
