import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fixture } from "./fixture.mjs";
import { readBrand } from "../workspace.mjs";

test("links curated next decision and lessons to evidence without conferring authority", async (t) => {
  const { root, brand } = await fixture(t);
  const config = {
    schemaVersion: 1,
    goalLabel: "More useful trials",
    summarySource: "reports/dashboard-summary.json",
    metrics: [
      {
        id: "active",
        role: "outcome",
        label: "Active users",
        unavailableReason: "External baseline not established.",
      },
      {
        id: "reach",
        label: "Reach",
        source: "reports/metrics.json",
        selector: { pointer: "/rows", sum: "impressions" },
        series: {
          pointer: "/rows",
          datePointer: "/date",
          valuePointer: "/impressions",
        },
      },
    ],
  };
  await writeFile(join(brand, "dashboard.json"), JSON.stringify(config));
  await writeFile(
    join(brand, "reports/dashboard-summary.json"),
    JSON.stringify({
      nextMove: {
        title: "Review the launch",
        reason: "Learn before increasing output.",
        source: "work/draft.md",
        status: "Planned",
      },
      lessons: [
        {
          title: "First effort",
          kind: "Observation",
          result: "Not measured",
          change: "Establish a baseline",
          source: "reports/learning.md",
        },
      ],
    }),
  );
  const result = await readBrand(root, "sample");
  assert.equal(result.goalLabel, "More useful trials");
  assert.equal(result.metrics[0].role, "outcome");
  assert.equal(result.metrics[0].value, null);
  assert.equal(result.metrics[0].note, "External baseline not established.");
  assert.deepEqual(result.metrics[1].series, []);
  assert.ok(result.metrics[1].seriesError);
  assert.equal(result.metrics[1].value, 3);
  assert.equal(result.nextMove.title, "Review the launch");
  assert.equal(result.lessons[0].result, "Not measured");
  assert.equal(result.mode, "read-only");
  config.summarySource = "../secret.json";
  await writeFile(join(brand, "dashboard.json"), JSON.stringify(config));
  const safe = await readBrand(root, "sample");
  assert.equal(safe.nextMove, null);
  assert.ok(safe.warnings.length);
});

test("series can reference separate saved evidence without summing daily unique users", async (t) => {
  const { root, brand } = await fixture(t);
  await writeFile(
    join(brand, "reports/daily.json"),
    JSON.stringify({
      observedAt: "2026-10-15T13:00:00Z",
      rows: [
        ["2026-10-08", 2],
        ["2026-10-09", null],
      ],
    }),
  );
  await writeFile(
    join(brand, "dashboard.json"),
    JSON.stringify({
      schemaVersion: 1,
      metrics: [
        {
          label: "Users",
          source: "reports/metrics.json",
          selector: { pointer: "/rows", sum: "impressions" },
          series: {
            source: "reports/daily.json",
            observedAtPointer: "/observedAt",
            pointer: "/rows",
            datePointer: "/0",
            valuePointer: "/1",
          },
        },
      ],
    }),
  );
  const metric = (
    await readBrand(root, "sample", { now: Date.parse("2026-10-15T14:00:00Z") })
  ).metrics[0];
  assert.equal(metric.value, 3);
  assert.deepEqual(metric.series, [
    { date: "2026-10-08", value: 2 },
    { date: "2026-10-09", value: null },
  ]);
  assert.equal(metric.seriesSource, "reports/daily.json");
  assert.equal(metric.seriesObservedAt, "2026-10-15T13:00:00.000Z");
  const config = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(join(brand, "dashboard.json"), "utf8"),
  );
  config.metrics[0].series.source = "../secret.json";
  await writeFile(join(brand, "dashboard.json"), JSON.stringify(config));
  const safe = (await readBrand(root, "sample")).metrics[0];
  assert.deepEqual(safe.series, []);
  assert.ok(safe.seriesError);
  assert.equal(safe.value, 3);
});
