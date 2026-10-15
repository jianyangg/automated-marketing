import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "marketing-dashboard-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const brand = join(root, "brands", "sample");
  await mkdir(join(brand, "reports"), { recursive: true });
  await mkdir(join(brand, "work"), { recursive: true });
  await writeFile(
    join(brand, "index.md"),
    `# Sample Workshop

Updated: 2026-10-14

**Confirmed goal:** More useful trials.

**Next action:** Review the [draft](work/draft.md).

| Record | Status |
| --- | --- |
| [First campaign](work/draft.md) | Prepared; unlaunched |
| [Learning](reports/learning.md) | No measured outcomes |

## Current dependencies

- Confirm the offer before publication.
`,
  );
  await writeFile(
    join(brand, "work/draft.md"),
    "# Draft\n\nExample copy, not published.",
  );
  await writeFile(
    join(brand, "reports/learning.md"),
    "# Learning\n\nNo launch yet.",
  );
  await writeFile(
    join(brand, "reports/metrics.json"),
    JSON.stringify({
      observedAt: "2026-10-14T12:00:00Z",
      rows: [{ impressions: 3 }, { impressions: 0 }],
      zero: 0,
    }),
  );
  await writeFile(
    join(brand, "dashboard.json"),
    JSON.stringify({
      schemaVersion: 1,
      metrics: [
        {
          label: "Search impressions",
          source: "reports/metrics.json",
          selector: { pointer: "/rows", sum: "impressions" },
          observedAtPointer: "/observedAt",
          period: "October 8–14",
          note: "A snapshot, not customers.",
        },
      ],
    }),
  );
  return { root, brand };
}
