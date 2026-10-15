import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { request } from "node:http";
import { startDashboard } from "../http.mjs";
import { fixture } from "./fixture.mjs";

async function running(t) {
  const data = await fixture(t);
  const service = await startDashboard({ root: data.root, port: 0 });
  t.after(
    () =>
      new Promise((resolve) => {
        service.server.close(resolve);
        service.server.closeAllConnections();
      }),
  );
  return { ...data, ...service };
}

test("serves a local read-only page and JSON with private no-store headers", async (t) => {
  const { url, server } = await running(t);
  assert.equal(server.address().address, "127.0.0.1");
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("cache-control"), /no-store/);
  assert.match(
    page.headers.get("content-security-policy"),
    /default-src 'self'/,
  );
  const html = await page.text();
  assert.match(html, /Progress over time/);
  assert.doesNotMatch(
    html,
    /Your marketing, at a glance|Read-only|Shared memory/,
  );
  for (const asset of [
    "app.mjs",
    "view.mjs",
    "text.mjs",
    "dom.mjs",
    "metric-view.mjs",
    "charts.mjs",
    "chart-model.mjs",
    "records.mjs",
    "markdown-model.mjs",
    "style.css",
    "styles/base.css",
    "styles/overview.css",
    "styles/records.css",
    "styles/responsive.css",
  ]) {
    assert.equal((await fetch(url + asset)).status, 200, asset);
  }
  const brands = await fetch(url + "api/brands").then((r) => r.json());
  assert.equal(brands.brands[0].id, "sample");
  const response = await fetch(url + "api/brands/sample");
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal((await response.json()).goal, "More useful trials.");
});

test("rejects writes, missing sessions, foreign origin/host and raw path traversal", async (t) => {
  const { url } = await running(t);
  const base = new URL(url).origin;
  assert.equal((await fetch(base + "/api/brands")).status, 404);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(
      (await fetch(url + "api/brands/sample", { method })).status,
      405,
    );
  }
  assert.equal(
    (
      await fetch(url + "api/brands", {
        headers: { Origin: "https://example.com" },
      })
    ).status,
    403,
  );
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const call = request(
      url + "api/brands",
      { headers: { Host: "evil.example" } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    call.on("error", reject);
    call.end();
  });
  assert.equal(foreignHostStatus, 403);
  const response = await fetch(
    url + "api/brands/sample/record?path=..%2Fsecret.json",
  );
  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), /private|\/tmp\/|\.codex/);
});

test("refresh and record previews do not modify workspace files or execute imported markup", async (t) => {
  const { root, brand, url } = await running(t);
  const path = join(brand, "work/draft.md");
  const hostile = '# Draft\n\n<script>fetch("https://example.com")</script>';
  await writeFile(path, hostile);
  const before = await readFile(path, "utf8");
  const response = await fetch(
    url + "api/brands/sample/record?path=work%2Fdraft.md",
  );
  const record = await response.json();
  assert.equal(record.content, hostile);
  assert.match(response.headers.get("content-type"), /application\/json/);
  await fetch(url + "api/brands/sample");
  assert.equal(await readFile(path, "utf8"), before);
  assert.deepEqual((await readdir(root)).sort(), ["brands"]);
});

test("stops with a useful error on a missing record and serves only known frontend files", async (t) => {
  const { url } = await running(t);
  assert.equal(
    (await fetch(url + "api/brands/sample/record?path=work%2Fmissing.md"))
      .status,
    404,
  );
  assert.equal((await fetch(url + "server.mjs")).status, 404);
  assert.equal(
    (await fetch(url + "api/brands/sample/record?path=dashboard.json")).status,
    403,
  );
  assert.equal(
    (
      await fetch(url + "api/brands/sample/record?path=work%2Fdraft.md", {
        method: "HEAD",
      })
    ).status,
    200,
  );
});
