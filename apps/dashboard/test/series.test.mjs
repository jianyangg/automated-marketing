import test from "node:test";
import assert from "node:assert/strict";
import { selectSeries } from "../series.mjs";
import { chartGeometry } from "../public/chart-model.mjs";

test("dated evidence is sorted; missing values remain gaps, never zeros", () => {
  const points = selectSeries(
    {
      rows: [
        { keys: ["2026-10-03"], n: 4 },
        { keys: ["2026-10-01"], n: 0 },
        { keys: ["2026-10-02"], n: null },
      ],
    },
    { pointer: "/rows", datePointer: "/keys/0", valuePointer: "/n" },
  );
  assert.deepEqual(
    points.map((p) => p.value),
    [0, null, 4],
  );
  assert.equal(points[0].date, "2026-10-01");
});

test("refuses undated aggregates, duplicate days and invalid dates", () => {
  const definition = {
    pointer: "/rows",
    datePointer: "/date",
    valuePointer: "/value",
  };
  for (const rows of [
    [{ date: "2026-02-30", value: 3 }],
    [{ value: 3 }],
    [
      { date: "2026-10-01", value: 3 },
      { date: "2026-10-01", value: 4 },
    ],
  ])
    assert.throws(() => selectSeries({ rows }, definition));
  assert.throws(() => selectSeries({ rows: 21 }, definition));
  assert.deepEqual(selectSeries({}, undefined), []);
});

test("chart uses real time spacing, breaks missing days, and gives zero a truthful baseline", () => {
  const chart = chartGeometry([
    { date: "2026-10-01", value: 0 },
    { date: "2026-10-02", value: 2 },
    { date: "2026-10-04", value: 4 },
    { date: "2026-10-05", value: null },
  ]);
  assert.equal(chart.segments.length, 2);
  assert.equal(chart.points[0].y, chart.bottom);
  assert.equal(
    chart.points[2].x - chart.points[1].x,
    2 * (chart.points[1].x - chart.points[0].x),
  );
  const zero = chartGeometry([{ date: "2026-10-01", value: 0 }]);
  assert.equal(zero.points[0].y, zero.bottom);
  assert.ok(zero.ticks.every((t) => Number.isFinite(t.y)));
  assert.equal(chartGeometry([]), null);
});
