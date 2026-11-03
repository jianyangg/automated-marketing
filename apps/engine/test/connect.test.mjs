import test from "node:test";
import assert from "node:assert/strict";
import { connectThreads } from "../connect.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// In-memory Keychain plus a scripted Meta that records every request.
function harness({ username = "sample", stored = {} } = {}) {
  const keychain = { ...stored };
  const log = [];
  const fetch = async (url, init = {}) => {
    const { pathname, searchParams } = new URL(url);
    log.push({ pathname, query: searchParams, body: init.body ? new URLSearchParams(init.body.toString()) : null });
    if (pathname === "/oauth/access_token") return json({ access_token: "short-tok", user_id: "42" });
    if (pathname === "/access_token") return json({ access_token: "long-tok", expires_in: 5_184_000 });
    if (pathname === "/v1.0/me") return json({ id: "42", username });
    return json({}, 404);
  };
  const opened = [];
  return {
    keychain,
    log,
    opened,
    options: {
      brand: "sample",
      account: "sample",
      appId: "123456",
      callback: { redirectUri: "https://localhost:8443/callback", waitForCode: async () => "the-code" },
      ask: async () => "app-secret",
      openBrowser: (url) => opened.push(new URL(url)),
      fetch,
      secrets: {
        read: (key) => {
          if (!(key in keychain)) throw new Error("missing");
          return keychain[key];
        },
        write: (key, value) => (keychain[key] = value),
      },
      now: () => new Date("2026-11-03T12:00:00Z"),
    },
  };
}

test("connect signs in through Meta and stores a long-lived token for the configured account", async () => {
  const h = harness();
  const result = await connectThreads(h.options);
  assert.deepEqual(result, { connected: "threads", account: "sample", expiresInDays: 60 });
  assert.deepEqual(h.keychain["sample/threads"], {
    userId: "42",
    accessToken: "long-tok",
    obtainedAt: "2026-11-03T12:00:00.000Z",
  });
  const authorize = h.opened[0];
  assert.equal(authorize.origin + authorize.pathname, "https://threads.com/oauth/authorize");
  assert.equal(authorize.searchParams.get("scope"), "threads_basic,threads_content_publish,threads_manage_insights");
  assert.match(authorize.searchParams.get("state"), /^[0-9a-f]{32}$/);
  const exchange = h.log[0].body;
  assert.equal(exchange.get("code"), "the-code");
  assert.equal(exchange.get("redirect_uri"), "https://localhost:8443/callback");
  assert.equal(h.log[1].query.get("grant_type"), "th_exchange_token");
  assert.equal(JSON.stringify(result).includes("tok"), false, "the token is never returned");
});

test("signing in as a different profile saves nothing", async () => {
  const h = harness({ username: "someone_else" });
  await assert.rejects(connectThreads(h.options), { code: "wrong_account" });
  assert.equal(h.keychain["sample/threads"], undefined);
});

test("a stored app secret is reused, so reconnecting only needs sign-in", async () => {
  const h = harness({ stored: { "sample/threads-app": { appId: "123456", appSecret: "kept" } } });
  let asked = false;
  await connectThreads({ ...h.options, ask: async () => ((asked = true), "new") });
  assert.equal(asked, false);
  assert.equal(h.log[0].body.get("client_secret"), "kept");
});

test("connect refuses a non-numeric app id before opening anything", async () => {
  const h = harness();
  await assert.rejects(connectThreads({ ...h.options, appId: "my-app" }), { code: "usage" });
  assert.equal(h.opened.length, 0);
});
