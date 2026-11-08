# Daily run

One pass for one brand. Every command is `npm run engine -- <command> --brand <business>`; writes take `--by <role>` (the CMO is `cmo`). The engine enforces the rules; this page covers the judgment.

## 1. Recover state

Run `status`. Unresolved deliveries come first:

- `unknown` or `attempting`: run `reconcile`. If it stays unresolved, send nothing else to that account today; say so once.
- `handoff`: a person was asked to post it. If it is live, `receipt <action> --url <link>`; if it is confirmed not posted, `receipt <action> --absent`.

## 2. Read results

Run `pull`. A failing source is reported, not retried in a loop. If the Threads token is near expiry or a pull fails on auth, run `refresh-token --channel threads`. Record manual metrics (search clicks, site visits from a dashboard) with `observe`.

## 3. Work the agenda

`status.agenda` is ranked by fixed rules. Take items from the top:

- **reconcile / measure / verify**: a number nobody can trust makes every later step guesswork. Verify a metric end to end (fire a test event, compare with a second source) and record `trust` with the note on how. If it needs real work, it is a measurement bet.
- **close**: the bet's score says keep, stop or insufficient. Close it with `bet close` citing the observations it was judged on. Disagreeing with the score needs `--override` and the reason the numbers mislead. `insufficient` can be extended once with `bet extend`.
- **budget**: a bet over a cost cap. Decide whether it is still worth it; say so in the brief.
- **bet**: a slot is open. Starting bets is a weekly decision ([weekly review](weekly-review.md)); on a daily run, note it and move on unless the slot has been open since the last review.
- **task**: a running bet has no agent work queued. Add the next concrete task (`task add`).
- **publish**: an approved or granted post inside a running bet. Run `publish`.
- **research / watch / visibility**: market records are missing or stale. Do the cheap part now; the monthly sweep does the rest.

## 4. Do the bets' work

For each running bet, finish its open agent tasks: draft the listing, research the outreach targets, build the page change, prepare the conversation questions, write the post. Close each with `task done --result`; anything that went public (post, reply, listing, pitch, page, email, ad) is closed with its live link, and an agent reply's slot is reserved when its task is added, so add reply tasks only for replies you are about to send. Public copy goes to the owner word for word (run `lint-copy` first) unless a grant covers it; then it becomes an owner task or a proposal (`propose --bet <bet>`). Record agent spend and owner time with `cost`.

A post is proposed only as a task of a running bet that uses posting. Withdraw proposals that will never go out (`withdraw <action> --reason`) so the owner's inbox shows only real asks.

## 5. Close

Run `brief`. Report in at most three lines: the funnel numbers and constraint, what shipped (with links), and the next move. Mention owner asks only when new or newly overdue.
