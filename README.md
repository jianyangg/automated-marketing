# Automated Marketing

**A marketing partner for your business, powered by Codex.**

Codex researches your market, recommends what to do next, and prepares website copy, articles, emails, social posts, or a marketing plan. No marketing experience needed.

**Early stage:** instructions, templates, and a local read-only dashboard work today. This repository has no built-in publisher or scheduler; Codex can use its own scheduled tasks and tools you connect.

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
