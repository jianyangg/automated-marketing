import test from "node:test";
import assert from "node:assert/strict";
import { threadsAdapter } from "../adapters/threads.mjs";
import { mixpanelReader } from "../metrics/mixpanel.mjs";
import { DefiniteFailure } from "../delivery.mjs";
import { sha256 } from "../actions.mjs";

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

// A scripted provider: each route returns a queued response (or throws) and
// every request is logged so tests can assert exactly what was sent.
function fakeFetch(routes) {
  const log = [];
  const fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const path = new URL(url).pathname;
    log.push({ method, path, url, body: init.body?.toString() ?? null, headers: init.headers ?? {} });
    const key = `${method} ${path}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request ${key}`);
    const next = Array.isArray(handler) ? handler.shift() : handler;
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(url, init) : next;
  };
  return { fetch, log };
}

const credentials = () => ({ userId: "42", accessToken: "secret-token" });
const adapter = (fetch, extra = {}) =>
  threadsAdapter({ credentials, fetch, sleep: async () => {}, pollEveryMs: 0, maxPolls: 3, ...extra });
const request = (extra = {}) => ({ text: "Pick one task.", assets: [], ...extra });

test("text post: container, wait for processing, publish, then read the permalink", async () => {
  const { fetch, log } = fakeFetch({
    "POST /v1.0/42/threads": json({ id: "c1" }),
    "GET /v1.0/c1": [json({ status: "IN_PROGRESS" }), json({ status: "FINISHED" })],
    "POST /v1.0/42/threads_publish": json({ id: "m1" }),
    "GET /v1.0/m1": json({ permalink: "https://www.threads.com/@a/post/x" }),
  });
  const result = await adapter(fetch).publish(request());
  assert.deepEqual(result, { state: "delivered", providerId: "m1", url: "https://www.threads.com/@a/post/x" });
  assert.match(log[0].body, /media_type=TEXT/);
  assert.match(log[0].body, /text=Pick\+one\+task\./);
  assert.match(log.at(-2).body, /creation_id=c1/);
});

test("nothing is public before threads_publish, so earlier failures are definite", async () => {
  const rejected = fakeFetch({ "POST /v1.0/42/threads": json({ error: { message: "Invalid text" } }, 400) });
  await assert.rejects(adapter(rejected.fetch).publish(request()), DefiniteFailure);
  const offline = fakeFetch({ "POST /v1.0/42/threads": new TypeError("fetch failed") });
  await assert.rejects(adapter(offline.fetch).publish(request()), DefiniteFailure);
  const broken = fakeFetch({
    "POST /v1.0/42/threads": json({ id: "c1" }),
    "GET /v1.0/c1": json({ status: "ERROR", error_message: "UNKNOWN" }),
  });
  await assert.rejects(adapter(broken.fetch).publish(request()), /ERROR: UNKNOWN/);
  const slow = fakeFetch({ "POST /v1.0/42/threads": json({ id: "c1" }), "GET /v1.0/c1": json({ status: "IN_PROGRESS" }) });
  await assert.rejects(adapter(slow.fetch).publish(request()), DefiniteFailure);
  await assert.rejects(adapter(slow.fetch).publish(request({ text: "x".repeat(501) })), DefiniteFailure);
  const noKeychain = threadsAdapter({
    credentials: () => {
      throw new Error("missing secret");
    },
    fetch: fakeFetch({}).fetch,
  });
  await assert.rejects(noKeychain.publish(request()), DefiniteFailure);
  const already = fakeFetch({ "POST /v1.0/42/threads": json({ id: "c1" }), "GET /v1.0/c1": json({ status: "PUBLISHED" }) });
  const live = await adapter(already.fetch).publish(request()).catch((e) => e);
  assert.ok(!(live instanceof DefiniteFailure));
});

test("a dropped publish call is not a definite failure; a 4xx refusal is", async () => {
  const ready = () => ({ "POST /v1.0/42/threads": json({ id: "c1" }), "GET /v1.0/c1": json({ status: "FINISHED" }) });
  const dropped = fakeFetch({ ...ready(), "POST /v1.0/42/threads_publish": new TypeError("socket hang up") });
  const error = await adapter(dropped.fetch).publish(request()).catch((e) => e);
  assert.ok(!(error instanceof DefiniteFailure));
  const server = fakeFetch({ ...ready(), "POST /v1.0/42/threads_publish": json({}, 503) });
  assert.ok(!((await adapter(server.fetch).publish(request()).catch((e) => e)) instanceof DefiniteFailure));
  const refused = fakeFetch({ ...ready(), "POST /v1.0/42/threads_publish": json({ error: { message: "limit" } }, 400) });
  await assert.rejects(adapter(refused.fetch).publish(request()), DefiniteFailure);
});

test("a missing permalink does not turn a live post into an unknown one", async () => {
  const { fetch } = fakeFetch({
    "POST /v1.0/42/threads": json({ id: "c1" }),
    "GET /v1.0/c1": json({ status: "FINISHED" }),
    "POST /v1.0/42/threads_publish": json({ id: "m1" }),
    "GET /v1.0/m1": new TypeError("fetch failed"),
  });
  assert.deepEqual(await adapter(fetch).publish(request()), { state: "delivered", providerId: "m1", url: null });
});

test("images must be hosted as the exact approved bytes before Threads fetches them", async () => {
  const bytes = Buffer.from("png bytes");
  const asset = { path: "work/post.png", sha256: sha256(bytes), publicUrl: "https://cdn.test/post.png" };
  await assert.rejects(adapter(fakeFetch({}).fetch).publish(request({ assets: [{ ...asset, publicUrl: undefined }] })), /public URL/);
  const image = (body) => new Response(body, { headers: { "content-type": "image/png" } });
  const swapped = fakeFetch({ "GET /post.png": image(Buffer.from("other")) });
  await assert.rejects(adapter(swapped.fetch).publish(request({ assets: [asset] })), /differs from approved/);
  const good = fakeFetch({
    "GET /post.png": image(bytes),
    "POST /v1.0/42/threads": json({ id: "c1" }),
    "GET /v1.0/c1": json({ status: "FINISHED" }),
    "POST /v1.0/42/threads_publish": json({ id: "m1" }),
    "GET /v1.0/m1": json({}),
  });
  await adapter(good.fetch).publish(request({ assets: [asset] }));
  const create = good.log.find((entry) => entry.path === "/v1.0/42/threads");
  assert.match(create.body, /media_type=IMAGE/);
  assert.match(create.body, /image_url=https%3A%2F%2Fcdn\.test%2Fpost\.png/);
});

test("lookup matches by exact text and says absent only once the feed covers the attempt", async () => {
  const attemptedAt = "2026-11-02T14:00:00.000Z";
  const feed = (data) => fakeFetch({ "GET /v1.0/42/threads": json({ data }) });
  const later = () => new Date("2026-11-02T15:00:00Z");
  const found = feed([{ id: "m9", text: "Pick one task.", permalink: "https://p", timestamp: "2026-11-02T14:00:05+0000" }]);
  assert.deepEqual(await adapter(found.fetch, { now: later }).lookup({ text: "Pick one task.", attemptedAt }), {
    state: "delivered",
    providerId: "m9",
    url: "https://p",
  });
  const older = [{ id: "m1", text: "old", timestamp: "2026-11-01T10:00:00+0000" }];
  assert.equal((await adapter(feed(older).fetch, { now: later }).lookup({ text: "Pick one task.", attemptedAt })).state, "absent");
  const soon = () => new Date("2026-11-02T14:05:00Z");
  assert.equal((await adapter(feed(older).fetch, { now: soon }).lookup({ text: "Pick one task.", attemptedAt })).state, "unknown");
});

test("permalink lookup pages back through the feed and matches by post code across hosts", async () => {
  const { fetch, log } = fakeFetch({
    "GET /v1.0/42/threads": [
      json({ data: [{ id: "a", permalink: "https://www.threads.com/@x/post/AAA" }], paging: { cursors: { after: "c2" }, next: "https://next" } }),
      json({ data: [{ id: "b", permalink: "https://www.threads.net/@x/post/BBB" }], paging: { cursors: { after: "c3" } } }),
    ],
    "GET /v1.0/b": json({ id: "b", text: "live", permalink: "https://www.threads.net/@x/post/BBB", timestamp: "2026-10-18T13:00:00+0000" }),
  });
  const found = await adapter(fetch).findByPermalink("https://www.threads.com/@x/post/BBB");
  assert.deepEqual(found, {
    providerId: "b",
    text: "live",
    url: "https://www.threads.net/@x/post/BBB",
    publishedAt: "2026-10-18T13:00:00.000Z",
  });
  assert.match(log[1].url, /after=c2/);
  const empty = fakeFetch({ "GET /v1.0/42/threads": json({ data: [] }) });
  assert.equal(await adapter(empty.fetch).findByPermalink("https://www.threads.com/@x/post/ZZZ"), null);
});

test("insights keep only metrics Meta actually returned", async () => {
  const { fetch } = fakeFetch({
    "GET /v1.0/m1/insights": json({
      data: [
        { name: "views", values: [{ value: 17 }] },
        { name: "likes", values: [{ value: 0 }] },
        { name: "shares", values: [] },
      ],
    }),
  });
  assert.deepEqual(await adapter(fetch).postInsights("m1"), { views: 17, likes: 0 });
});

test("errors never echo the access token", async () => {
  const { fetch, log } = fakeFetch({ "POST /v1.0/42/threads": json({}, 401) });
  const error = await adapter(fetch).publish(request()).catch((e) => e);
  assert.doesNotMatch(error.message, /secret-token/);
  assert.match(log[0].body, /access_token=secret-token/);
});

test("Mixpanel reads daily counts with Basic auth and leaves missing days absent", async () => {
  const { fetch, log } = fakeFetch({
    "GET /api/query/segmentation": json({
      data: { series: ["2026-11-01", "2026-11-02"], values: { task_started: { "2026-11-01": 3, "2026-11-02": 0 } } },
    }),
  });
  const reader = mixpanelReader({ credentials: () => ({ username: "sa", secret: "pw" }), fetch });
  const metric = { event: "task_started", type: "unique", projectId: 7, region: "eu", secret: "k" };
  assert.deepEqual(await reader.daily(metric, "2026-11-01", "2026-11-03"), { "2026-11-01": 3, "2026-11-02": 0 });
  assert.match(log[0].url, /^https:\/\/eu\.mixpanel\.com\/.*project_id=7.*type=unique/);
  assert.equal(log[0].headers.authorization, `Basic ${Buffer.from("sa:pw").toString("base64")}`);
});
