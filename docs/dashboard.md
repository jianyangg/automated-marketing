# Local dashboard

A visual view of progress toward each business's goal. Metrics and trends come first, followed by the next move and the evidence behind it. Codex remains the place to discuss and act.

## Run

Requires Node.js 22+. No install or build step.

```sh
npm run dashboard
# Fictional example, free port:
npm run dashboard -- --demo --port 0
```

Open the printed local URL. Refresh rereads saved files; it does not query providers. A single business opens automatically; `?brand=<folder-name>` selects another existing workspace.

## What appears

- **Metrics:** goal outcome first, then supporting measures. Select a card to inspect its trend. Definitions, exact windows and evidence expand beneath each metric.
- **Progress:** dated observations with a zero-inclusive axis, real date spacing, hover values and an accessible daily-value table. Gaps remain gaps. A total alone cannot produce a trend.
- **Next move:** one action, reason, recorded status and review time. A due review is highlighted; it does not trigger execution.
- **Learning:** observed results or research findings → the change they support. Supporting records open on demand.

Returns, conversions and percentage improvements remain unknown unless valid evidence establishes them. Different providers' identities and date windows are not a conversion funnel.

## Private workspace contract

Keep business-specific files under ignored `brands/<business>/`. Generic dashboard code and fictional fixtures belong in the public framework.

`index.md` remains the operating brief: title, `**Confirmed goal:**`, `**Next action:**`, `Record | Status` links and `## Current dependencies` bullets. All linked work remains available in a collapsed records section.

Optional `dashboard.json` configures up to twelve metrics:

```json
{
  "schemaVersion": 1,
  "goalLabel": "More appointment requests",
  "summarySource": "reports/dashboard-summary.json",
  "metrics": [
    {
      "id": "requests",
      "role": "outcome",
      "label": "Appointment requests",
      "source": "reports/observations.json",
      "selector": { "pointer": "/requests" },
      "observedAtPointer": "/observedAt",
      "periodPointer": "/dateRange",
      "series": {
        "pointer": "/daily",
        "datePointer": "/date",
        "valuePointer": "/requests"
      },
      "note": "Recorded requests, not completed appointments."
    }
  ]
}
```

Selectors use JSON Pointer (`~1` escapes slash, `~0` escapes tilde). A scalar selector reads a finite number; `"sum": "field"` sums a nonempty array only if every row has a numeric field. Never sum daily distinct users into weekly unique people.

`periodPointer` accepts two string bounds or an object with `from/to` or `since/until`. Optional `period` is fallback context. Exact bounds remain in metric details; the compact display abbreviates dates.

A series requires a row array, unique ISO dates and finite values or null gaps. Duplicate/invalid dates or a missing series source disable that chart without hiding the aggregate. Missing calendar days break the line. The dashboard never interpolates or infers growth. For array rows, use pointers such as `/0` and `/1`. Optional `series.source` and `series.observedAtPointer` read a separate saved JSON file; its provenance remains distinct. Without a numeric source, use `unavailableReason` to explain a measurement gap.

Observation time stays separate from file-read time. Snapshots over 36 hours old are marked in metric details; this is a display reminder, not a scientific freshness threshold. Unknown or future observation timestamps never appear fresh.

## Evidence and decisions

`summarySource` optionally points to a concise private JSON projection of existing decisions and learning:

```json
{
  "nextMove": {
    "title": "Review the first campaign",
    "reason": "Measure response before increasing output.",
    "status": "Awaiting results",
    "reviewAt": "2026-10-16T09:00:00-04:00",
    "source": "work/campaigns/first-campaign/results.md"
  },
  "lessons": [
    {
      "title": "First campaign",
      "kind": "Observation",
      "result": "Results are not measured yet.",
      "change": "Establish a baseline before choosing a winner.",
      "source": "reports/learning.md"
    }
  ]
}
```

Codex maintains this short projection alongside the operating brief. Link each conclusion to the authoritative record; do not copy entire reports or treat a display status as a second delivery ledger. Maximum six learning rows. Missing summaries fall back to the index without inventing findings.

Records render a safe Markdown subset: headings, paragraphs, tables, lists, quotes, code and links. Raw HTML stays inert text. JSON evidence is formatted for inspection. Complex nested Markdown is not a full document publishing engine.

## Scope and privacy

The server binds to `127.0.0.1` with an unpredictable temporary session URL, same-origin/Host checks, no-store responses and a restrictive content policy. GET/HEAD only. There are no publishing, approval, spend, edit, model, telemetry or provider endpoints.

Only selected brand text records in declared locations can be previewed. Traversal, hidden paths, unrelated root files, symlink escapes and records over 2 MB are rejected. Keep credentials outside brand files. Do not expose or tunnel the dashboard publicly or share its session URL. This is a local convenience boundary, not isolation from processes running as the same OS user.

## Checks

`npm test` covers evidence selectors, missing/zero values, chart geometry and gaps, summary fallback, Markdown parsing, workspace isolation, sessions/origins and read-only requests. HTTP tests need local listening ports. Visual review belongs to the owner; no browser automation is required.
