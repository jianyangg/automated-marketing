# Automated Marketing

**A marketing partner for your business, powered by Codex.**

Codex researches your market, recommends what to do next, and prepares website copy, articles, emails, social posts, or a marketing plan. No marketing experience needed.

**Early stage:** a local engine records every proposal, permission, post and result, and publishes to Threads through Meta's official API. Other channels use a manual handoff. Codex's own scheduled tasks run the daily loop.

## Get started

1. Open this project folder in Codex.
2. Share your website, a short business description, and a goal. Add useful documents or images.
3. Ask:

   > Help me market this business. Organize its files, research the market, recommend the most useful next step, and prepare the work for my review.

Codex organizes each business under `brands/`, keeping its work, decisions, results, and lessons linked.

Keep business-specific files inside `brands/`; Git excludes them from the public repository.

## Keep it moving

You shouldn't need to prompt every work session. Tell Codex:

> Work on my marketing every weekday at 9 AM in my time zone. Research the market, check results, carry out the most useful action within my permissions, and improve the plan. Tell me when something useful happens or you need my help.

Codex should reuse an existing schedule, agree what it may do publicly and when to interrupt you, and track what shipped, what happened, and what changes next. Improvements draw on research, real founders' experience and your results. Local tasks need your computer on and Codex running. [Operating loop](docs/cmo-operating-model.md#7-cadence-and-attention).

## Engine

Each business keeps its state in `brands/<business>/.state/engine.sqlite`. Codex runs `npm run engine -- <command> --brand <business>` (`--help` lists commands). Three steps are yours, because the engine accepts permission only from you at your own terminal:

1. **Connect Threads.** Create a Meta app with the Threads use case (permissions `threads_basic`, `threads_content_publish`, `threads_manage_insights`), add `https://localhost:8443/callback` as a redirect URI and your account as a tester. Then sign in once; the token goes straight into the Keychain:

   ```sh
   npm run engine -- connect threads --brand <business> --app-id <threads-app-id>
   ```

2. **Connect analytics (optional, recommended).** For Mixpanel, store a service account as `{"username": "...", "secret": "..."}` with `security add-generic-password -U -s automated-marketing -a <business>/mixpanel -w`, and tell Codex the project's time zone.
3. **Grant permission.** For example, one post a day for 30 days, paused after two failures:

   ```sh
   npm run engine -- grant --brand <business> --channel threads --account <handle> --max-per-day 1 --timezone America/New_York --pause-after-failures 2 --expires 2026-12-31 --statement "One original post per day to @<handle> on Threads"
   ```

   Or approve posts one at a time with `npm run engine -- approve <action> --brand <business>`.

## Dashboard

See your key numbers, progress, next move, and lessons learned. Ask Codex: **“Open my dashboard.”**

**Make it yours.** No coding knowledge needed—tell Codex what you want to see:

> Edit mode: Customize my dashboard. Put my most important numbers first, show weekly progress, and use my brand colours.

Codex handles the changes. Keep asking for adjustments until it feels right. For everyday marketing, say **“Use mode.”**

Prefer the terminal? Run `npm run dashboard` with Node.js 22+. [Dashboard guide](docs/dashboard.md).

## Two modes

**Use mode** is the default: ask for marketing help. Shared framework files stay unchanged.

**Edit mode** changes the machine: say “Edit mode: improve the research workflow.” It applies to that task, then returns to Use mode. These are agent instructions, not file locks. [Mode guide](docs/workspace-modes.md).

## How it works

Research → choose a priority → create the work → review → use it → learn from available results.

Codex handles the method and filing; you supply business facts, goals, constraints, and feedback. Publishing and spending require your permission, which can cover a clearly defined ongoing activity. You need access to Codex; no additional AI service is required.

## Explore

[Agent instructions](AGENTS.md) · [Product plan](docs/PRD.md) · [Research and sources](docs/research/sources.md) · [Example business](examples/brands/harbor-repair/brand.md)

[MIT License](LICENSE).
