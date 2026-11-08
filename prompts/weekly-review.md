# Weekly review

Where strategy changes. Run it once a week per brand, after a daily run's `pull`. With Claude Code, the `weekly-review` workflow runs the analyst and red team in parallel (`args: { brand, date }`); otherwise play those roles from [the team](team.md) yourself.

## 1. Check the numbers can be believed

For each funnel metric, ask whether the number matches a second source (server logs, the provider's own report, a test event). Record what you actually checked with `trust`. A broken north star outranks everything else.

## 2. Close what is due

`bet list --status running`. Close every bet whose score is keep, stop or insufficient (see the daily run). One line of rationale, the observation ids, nothing retold.

## 3. Find the constraint

`funnel` names the stage with the lowest share of its target. Ask whether that is really where the business is stuck: before fit, low return use usually matters more than low reach, even if reach is further from its target. If the targets are wrong, change them in `engine.json` and say why.

Consider the stage. Move it forward only when the numbers say so (`stage --set early-traction --evidence ...`): return use holding for several weeks, or the fit survey at 40% or more "very disappointed". Move it back when they fall away.

## 4. Choose at most one new bet

Fill one open slot, aimed at the constraint:

1. `playbook --rank` (add `--lever` to narrow it) lists tactics, your own results first once there are three or more.
2. Check `market`: which situation, which gap. If none fits, the bet is research or conversations first.
3. Write the bet: threshold from the funnel target and current level (a real step, not a hope), kill date 2 to 6 weeks out, minimum measured days, caps on money, agent spend and owner minutes, and `--risk`.
4. Red-team it: the strongest reason it fails, a competitor already doing it, platform rules, and a cheaper test that answers the same question. Revise or drop it.
5. `bet propose`, then `bet start`. Add its first tasks.

## 5. Report

Five lines at most: funnel and constraint, bets closed (and what they taught), the bet started, owner asks, and the next check date.

## Monthly additions

Run the market sweep (`market-sweep` workflow, or the competitor, customer, analyst and visibility roles by hand) and `scorecard`. Once a month also run `scorecard --all` and look at the engine itself: overridden verdicts, owner asks answered late, metrics left unverified, bets that never started. A repeated failure is an engine bug: fix it in the framework and add a replay case to `apps/engine/test/replay.test.mjs`.
