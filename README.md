# Automated Marketing

**A marketing partner for your business, powered by Codex.**

Codex researches your market, recommends what to do next, and prepares website copy, articles, emails, social posts, or a marketing plan. No marketing experience needed.

**Early stage:** instructions, templates, and a local read-only dashboard work today. Automatic publishing, scheduling, and results collection are not built yet.

## Get started

1. Open this project folder in Codex.
2. Share your website, a short business description, and a goal. Add useful documents or images.
3. Ask:

   > Help me market this business. Organize its files, research the market, recommend the most useful next step, and prepare the work for my review.

Codex organizes each business under `brands/`, keeping its work, decisions, results, and lessons linked.

Keep business-specific files inside `brands/`; Git excludes them from the public repository.

## Dashboard

With Node.js 22+, run `npm run dashboard` and open the printed local URL. No install or build step. See goal metrics, progress charts, the next move, and what past evidence changes; continue in Codex to act. [Dashboard guide](docs/dashboard.md).

## Two modes

**Use mode** is the default: ask for marketing help. Shared framework files stay unchanged.

**Edit mode** changes the machine: say “Edit mode: improve the research workflow.” It applies to that task, then returns to Use mode. These are agent instructions, not file locks. [Mode guide](docs/workspace-modes.md).

## How it works

Research → choose a priority → create the work → review → use it → learn from available results.

Codex handles the method and filing; you supply business facts, goals, constraints, and feedback. Publishing and spending require your permission. You need access to Codex; no additional AI service is required.

## Explore

[Agent instructions](AGENTS.md) · [Product plan](docs/PRD.md) · [Research and sources](docs/research/sources.md) · [Example business](examples/brands/harbor-repair/brand.md)

[MIT License](LICENSE).
