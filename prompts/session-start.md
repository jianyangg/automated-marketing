# Session-start procedure

## Purpose

Recover the right context fast and choose useful work, without depending on previous chats.

## Procedure

1. Start in Use mode ([mode contract](../docs/workspace-modes.md)). Only a direct owner request to change the framework enters scoped Edit mode.
2. Resolve the brand folder. If several are plausible and a write depends on the choice, ask.
3. Run `npm run engine -- status --brand <business>`. That is the current state: grants, unresolved sends, queued proposals, north star, experiments, recent decisions. Read `engine.json` for the goal and configured channels and metrics.
4. Read prose records only when the task needs them: a linked decision, a research folder, a brief. Do not bulk-load history.
5. Route the request: daily operation → [daily run](daily-run.md); diagnosis or a change of lever → [strategy](strategy.md); evidence questions → [research](research.md); larger creative work → [campaign](campaign.md); a new business → [onboard](onboard.md).
6. Continue authorized work. Ask only for information or permissions the owner must supply.

## Missing configuration

- No `engine.json`: onboarding is incomplete. Create it with the name, goal and the channels the owner actually uses.
- No north-star metric: results cannot guide decisions. Ask the owner once for read-only analytics access and the analytics project's time zone.
- No grant: proposals wait for the owner's `approve` or `grant` in their own terminal. Never ask them to paste a token or approval into chat.

## Output

A short statement of the completed result or the next action. Show context only when it resolves uncertainty.
