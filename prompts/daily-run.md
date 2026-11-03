# Daily run

One pass of the operating loop for one brand. Every command is `npm run engine -- <command> --brand <business>`. Each step that needs judgment states its rule. The engine enforces the rest.

## 1. Recover state

Run `status`. If `unresolved` is not empty:

- `unknown` or `attempting`: run `reconcile`. If it stays unresolved, do not publish to that account today; say so once.
- `handoff`: the post was handed to a person. Check whether it is live. If it is, record `receipt <action> --url <live url>`; if it is confirmed not posted, record `receipt <action> --absent`.

## 2. Read results

Run `pull`. Errors are per source: a failing source (for example an expired token) is reported, not retried in a loop. If the Threads token is within about 10 days of its 60-day expiry, or a pull fails with an auth error, run `refresh-token --channel threads`.

## 3. Decide

Read `status.northStar`, `status.experiments` and the per-post readings in `status.latest`.

Working rules. These are operating defaults, not research findings; change them with evidence:

- **Too little data:** fewer than 5 posts in a variable group, or a median under 50 views, means `wait`. Do not declare a winning hook from 1–20 views.
- **Variable comparison:** when two values of the same variable each have at least 5 posts, compare median views. A difference under 2× is noise at this scale; treat it as a tie.
- **North star first:** views matter only as a route to the north star. Engagement that rises while the north star stays flat is not progress.

Record what you concluded with `decide --verdict <keep|change|stop|wait> --rationale "<one sentence>" --evidence <observation ids>`. Only `wait` may cite no evidence. Record a decision only when something was concluded, not every run.

### Channel review

Every 14 days of posting on a channel, run a channel review. Look at the north-star trend (`last7` against `prior7`, with known days), median views per post, and any clicks.

- If the north star has not risen and median views stay under 50, posting on this channel is not the constraint you can move. Record `decide --verdict change`, then run the [distribution procedure](distribution.md) to choose a different lever: the landing page and first-run experience, search pages, a community where the audience already asks for help, lifecycle email, or a referral loop. Prepare that work instead of more posts on the same channel.
- If views are healthy but the north star is flat, the problem is the message-to-product path. Audit the destination before changing creative.
- If the north star rose, `keep` what changed and keep testing one variable at a time.

## 4. Propose one action

Propose one post per allowed slot, varying exactly one thing from recent posts:

```sh
npm run engine -- propose --brand <b> --channel threads --account <handle> \
  --hypothesis "<what this tests and why>" --variable hook=question \
  --text-file work/<date>-<slug>/threads.txt [--asset work/<date>-<slug>/image.png=https://<public copy>]
```

- Threads allows 500 characters. Images need a public https copy of the exact file (the engine checks its hash). Without one, post text-only.
- Write the copy for the audience. State only verified product facts. No invented proof.
- When posting is not the lever (see channel review), the action is the non-posting work. Prepare it in `work/<date>-<slug>/` and record the decision.

## 5. Publish

Run `publish <action>`. It succeeds only under an owner grant (daily cap, expiry and failure pause enforced) or a one-off owner approval.

- `not_authorized`: leave the proposal queued and tell the owner once that it awaits `approve <action>` in their terminal.
- `daily_cap`: today's allowance is used; stop.
- `paused` or repeated `failed`: read the error, fix the cause if it is in the content, and tell the owner. Only a new owner grant lifts a pause.
- No adapter for the channel: `publish <action> --via manual`. A person posts the exact content, then you record the `receipt`.

## 6. Close

Run `brief`. Report in at most three lines: what shipped (with its link), what the north star and latest post readings say, and the next action. Do not restate unchanged blockers.
