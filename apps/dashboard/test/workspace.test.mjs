import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, symlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { listBrands, readBrand, readRecord } from "../workspace.mjs";
import { selectMetric, observationTime } from "../metrics.mjs";
import { fixture } from "./fixture.mjs";

test("reads goal, attention, recorded work and source-backed results without inventing execution", async (t) => {
  const { root } = await fixture(t);
  const data = await readBrand(root, "sample", {
    now: Date.parse("2026-10-16T12:00:00Z"),
  });
  assert.equal(data.name, "Sample Workshop");
  assert.equal(data.goal, "More useful trials.");
  assert.equal(data.attention.length, 1);
  assert.equal(data.work[0].status, "Prepared; unlaunched");
  assert.equal(data.history[0].title, "Learning");
  assert.equal(data.metrics[0].value, 3);
  assert.equal(data.metrics[0].stale, true);
  assert.equal(data.metrics[0].source, "reports/metrics.json");
  assert.equal(data.mode, "read-only");
});

test("listing uses directory names only, and empty/invalid data remains usable", async (t) => {
  const { root, brand } = await fixture(t);
  await mkdir(join(root, "brands/other"));
  await mkdir(join(root, "brands/.hidden"));
  assert.deepEqual(await listBrands(root), [{ id: "other" }, { id: "sample" }]);
  await writeFile(join(brand, "dashboard.json"), "not JSON");
  const data = await readBrand(root, "sample");
  assert.equal(data.goal, "More useful trials.");
  assert.deepEqual(data.metrics, []);
  assert.ok(data.warnings.length);
  const empty = await readBrand(root, "other");
  assert.equal(empty.goal, null);
  assert.deepEqual(empty.attention, []);
});

test("metrics are re-read, missing sources stay unknown and zero stays zero", async (t) => {
  const { root, brand } = await fixture(t);
  await writeFile(
    join(brand, "reports/metrics.json"),
    JSON.stringify({ rows: [{ impressions: 9 }] }),
  );
  assert.equal((await readBrand(root, "sample")).metrics[0].value, 9);
  await writeFile(
    join(brand, "dashboard.json"),
    JSON.stringify({
      schemaVersion: 1,
      metrics: [
        {
          label: "Unknown",
          source: "reports/missing.json",
          selector: { pointer: "/value" },
        },
      ],
    }),
  );
  const metric = (await readBrand(root, "sample")).metrics[0];
  assert.equal(metric.value, null);
  assert.ok(metric.error);
  assert.equal(selectMetric({ count: 0 }, { pointer: "/count" }), 0);
  assert.equal(
    selectMetric({ rows: [] }, { pointer: "/rows", sum: "count" }),
    null,
  );
  assert.equal(
    selectMetric(
      { rows: [{ count: 1 }, {}] },
      { pointer: "/rows", sum: "count" },
    ),
    null,
  );
  assert.equal(selectMetric({}, { pointer: "/missing" }), null);
});

test("record reads reject traversal, credential paths, symlink escapes and another brand", async (t) => {
  const { root, brand } = await fixture(t);
  await writeFile(
    join(root, "secret.json"),
    '{"private":"not for this brand"}',
  );
  await symlink(join(root, "secret.json"), join(brand, "reports/escape.json"));
  for (const path of [
    "../secret.json",
    "/secret.json",
    "reports/escape.json",
    ".git/config",
    ".env",
    "work/../../secret.json",
    "reports/secret.key",
  ]) {
    await assert.rejects(readRecord(root, "sample", path));
  }
  await assert.rejects(readBrand(root, "../sample"));
  await assert.rejects(readBrand(root, "missing"));
  await symlink(brand, join(root, "brands/alias"));
  assert.equal(
    (await listBrands(root)).some((b) => b.id === "alias"),
    false,
  );
  await assert.rejects(readBrand(root, "alias"));
});

test("metric selectors accept finite numeric evidence, with correct JSON-pointer escapes", () => {
  assert.equal(
    selectMetric({ "a/b": { "~value": 7 } }, { pointer: "/a~1b/~0value" }),
    7,
  );
  for (const value of [null, "7", true, {}, Infinity]) {
    assert.equal(selectMetric({ value }, { pointer: "/value" }), null);
  }
  assert.equal(selectMetric({}, { pointer: "/__proto__/polluted" }), null);
});

test("oversized records are refused and future timestamps cannot masquerade as fresh", async (t) => {
  const { root, brand } = await fixture(t);
  await writeFile(join(brand, "reports/large.txt"), "x".repeat(2_000_001));
  await assert.rejects(readRecord(root, "sample", "reports/large.txt"), {
    status: 413,
  });
  assert.deepEqual(
    observationTime({ date: "2099-01-01T00:00:00Z" }, "/date", Date.now()),
    { observedAt: null, stale: null },
  );
});

test("reporting bounds come from the saved source when a period pointer is supplied", async (t) => {
  const { root, brand } = await fixture(t);
  await writeFile(
    join(brand, "reports/metrics.json"),
    JSON.stringify({
      total: 7,
      range: { since: "2026-10-08T00:00:00Z", until: "2026-10-15T00:00:00Z" },
    }),
  );
  await writeFile(
    join(brand, "dashboard.json"),
    JSON.stringify({
      schemaVersion: 1,
      metrics: [
        {
          label: "Count",
          source: "reports/metrics.json",
          selector: { pointer: "/total" },
          periodPointer: "/range",
        },
      ],
    }),
  );
  const data = await readBrand(root, "sample");
  assert.equal(
    data.metrics[0].period,
    "2026-10-08T00:00:00Z → 2026-10-15T00:00:00Z",
  );
});

test("invalid JSON configuration shapes never hide the usable operating brief", async (t) => {
  const { root, brand } = await fixture(t);
  for (const value of [null, [], 5, { schemaVersion: 99, metrics: [] }]) {
    await writeFile(join(brand, "dashboard.json"), JSON.stringify(value));
    const data = await readBrand(root, "sample");
    assert.equal(data.goal, "More useful trials.");
    assert.deepEqual(data.metrics, []);
    assert.ok(data.warnings.length);
  }
});
