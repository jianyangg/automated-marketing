import { createServer } from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { EngineError } from "./store.mjs";
import { readSecret, writeSecret } from "./secrets.mjs";

// Connects a brand's Threads account with Meta's official OAuth flow so the
// owner only signs in and clicks Allow. The token goes from Meta straight into
// the Keychain; it is never printed, logged, or handed to the agent.
// https://developers.facebook.com/docs/threads/get-started/get-access-tokens-and-permissions
const AUTHORIZE = "https://threads.com/oauth/authorize";
const GRAPH = "https://graph.threads.com";
const SCOPES = ["threads_basic", "threads_content_publish", "threads_manage_insights"];

// Reads a line at the owner's terminal without echoing it, for the app secret.
export function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new EngineError("owner_terminal_required", "Connecting an account must be done by the owner in a terminal.");
  return new Promise((resolve) => {
    const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    prompt._writeToOutput = (text) => {
      if (text.startsWith(question)) process.stdout.write(question);
    };
    prompt.question(question, (answer) => {
      prompt.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

// Meta only redirects to https, so the callback listens on https://localhost
// with a throwaway self-signed certificate. The browser shows one warning for
// it; the certificate is deleted as soon as the code arrives.
export function localCallback({ port = 8443, timeoutMs = 5 * 60_000 } = {}) {
  const redirectUri = `https://localhost:${port}/callback`;
  return {
    redirectUri,
    waitForCode(expectedState) {
      const dir = mkdtempSync(join(tmpdir(), "engine-connect-"));
      execFileSync(
        "openssl",
        ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
          "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem")],
        { stdio: "ignore" },
      );
      return new Promise((resolve, reject) => {
        const finish = (error, code) => {
          clearTimeout(timer);
          server.close();
          rmSync(dir, { recursive: true, force: true });
          error ? reject(error) : resolve(code);
        };
        const server = createServer(
          { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) },
          (request, response) => {
            const url = new URL(request.url, redirectUri);
            if (url.pathname !== "/callback") return response.writeHead(404).end();
            const ok = url.searchParams.get("state") === expectedState && url.searchParams.get("code");
            response.writeHead(ok ? 200 : 400, { "content-type": "text/plain" });
            response.end(ok ? "Connected. You can close this tab." : "This sign-in link does not match. Try connect again.");
            if (ok) finish(null, url.searchParams.get("code").replace(/#_$/, ""));
            else if (url.searchParams.get("error"))
              finish(new EngineError("connect_denied", "Threads access was not granted."));
          },
        );
        const timer = setTimeout(
          () => finish(new EngineError("connect_timeout", "No sign-in arrived within 5 minutes.")),
          timeoutMs,
        );
        server.listen(port, "127.0.0.1");
      });
    },
  };
}

async function graph(fetch, path, { method = "GET", params }) {
  const query = new URLSearchParams(params);
  const response = await fetch(method === "GET" ? `${GRAPH}/${path}?${query}` : `${GRAPH}/${path}`, {
    method,
    ...(method !== "GET" && { body: query }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => null);
  // Only Meta's message is surfaced; request parameters (secret, code, token) never are.
  if (!response.ok)
    throw new EngineError("connect_failed", `Threads refused the connection: ${data?.error_message ?? data?.error?.message ?? `HTTP ${response.status}`}`);
  return data;
}

export async function connectThreads({
  brand,
  account,
  appId,
  callback = localCallback(),
  ask = promptHidden,
  openBrowser = (url) => execFileSync("open", [url]),
  fetch = globalThis.fetch,
  secrets = { read: readSecret, write: writeSecret },
  now = () => new Date(),
}) {
  if (!/^\d+$/.test(appId ?? ""))
    throw new EngineError("usage", "--app-id must be the numeric Threads App ID from the Meta app dashboard.");
  // The app secret is kept so later reconnects only need sign-in.
  const appKey = `${brand}/threads-app`;
  let app;
  try {
    app = secrets.read(appKey);
  } catch {
    app = null;
  }
  if (app?.appId !== appId) {
    const appSecret = await ask("Threads app secret (input hidden): ");
    if (!appSecret) throw new EngineError("usage", "An app secret is required.");
    app = { appId, appSecret };
    secrets.write(appKey, app);
  }

  const state = randomBytes(16).toString("hex");
  const authorize = new URL(AUTHORIZE);
  authorize.search = new URLSearchParams({
    client_id: appId,
    redirect_uri: callback.redirectUri,
    scope: SCOPES.join(","),
    response_type: "code",
    state,
  });
  const pending = callback.waitForCode(state);
  openBrowser(authorize.toString());
  const code = await pending;

  const short = await graph(fetch, "oauth/access_token", {
    method: "POST",
    params: {
      client_id: appId,
      client_secret: app.appSecret,
      grant_type: "authorization_code",
      redirect_uri: callback.redirectUri,
      code,
    },
  });
  const long = await graph(fetch, "access_token", {
    params: { grant_type: "th_exchange_token", client_secret: app.appSecret, access_token: short.access_token },
  });
  // Store nothing unless the signed-in profile is the account this brand
  // configured, so a wrong login cannot quietly redirect future posts.
  const me = await graph(fetch, "v1.0/me", { params: { fields: "id,username", access_token: long.access_token } });
  if (me.username?.toLowerCase() !== account.toLowerCase())
    throw new EngineError(
      "wrong_account",
      `You signed in as @${me.username ?? "unknown"}, but this brand posts as @${account}. Nothing was saved.`,
    );
  secrets.write(`${brand}/threads`, { userId: me.id, accessToken: long.access_token, obtainedAt: now().toISOString() });
  return { connected: "threads", account: me.username, expiresInDays: Math.round((long.expires_in ?? 0) / 86_400) };
}
