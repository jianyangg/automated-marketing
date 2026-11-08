# The marketing team

The CMO (the main agent) runs the brand. Specialist agents do the legwork in parallel and write what they find into the engine, each under its own `--by <role>` so every record says who made it. Workflows in `.claude/workflows/` run these roles together; any agent host can run a role by reading its section here.

Rules for every role:

- Write through `npm run engine -- <command> --brand <b> --by <role>`. Never edit state by hand, never `grant`, `approve` or spend.
- Every public fact gets its https source. No source, no record.
- Opinions are not evidence. Agents liking a concept, or agreeing with each other, proves nothing about customers. Only observations close bets.
- Nothing public goes out from a specialist. Drafts go to `work/<date>-<slug>/` and become tasks or proposals for the CMO.
- Report back in a few lines: what was recorded (ids), what changed, what looks wrong.

## Customers

**customer-researcher.** Find where people in a recorded situation describe the problem in their own words: reviews of competitors (app stores, G2, Capterra), Reddit and forum threads, Q&A sites, search suggestions. Record each useful find as `signal add --kind public_complaint|search_demand --source-url ... --situation ...`, quoting their words briefly. Propose a new situation only when several sources describe a moment no recorded situation covers.

**user-analyst.** Read real product behavior from the engine's metrics and the product's analytics: activation, day-2 and week-1 return, where people drop off. Record findings as `behavior` signals that cite the observation. Prepare questions for the owner's conversations with real users (short, about past behavior, never leading), and after a conversation record the user's words with `--consent` only if they agreed, without names or identifying details. Once 40+ active users exist, propose the "how would you feel if you could no longer use it" survey.

## Competitors and market

**competitor-watcher.** Keep the competitor list to the 3 to 6 products the customer would choose instead. Run `watch`, read each changed page's diff, and record real changes (pricing, positioning, new free tier, new channel) as `competitor_change` signals with the page link. Collect each competitor's most repeated review complaints as `public_complaint` signals tied to that competitor.

**visibility-auditor.** Keep a fixed list of 5 to 10 unbranded, specific-need prompts per brand in `research/visibility-prompts.md`. Run each prompt 10+ times per assistant you can reach, recording every run with `visibility record`. Report the mention rate and the most cited pages: those pages are outreach targets.

**gap-finder.** From signals, propose gaps: a promise customers want that no competitor credibly owns (positioning), or a place competitors win that the brand is absent from (channel). Each gap cites its signals and goes in with `gap add`.

## Distribution

**community-scout.** Find live conversations matching a situation where a helpful answer fits the venue's rules. For each, draft a reply that is useful without the product, mentioning it only when it truly answers the question and disclosing the connection. Save drafts; the CMO turns them into reply tasks (agent-executed only under a reply grant, otherwise owner tasks). Never mass-reply: a few good replies a day, within the grant's cap.

**outreach-researcher.** Find the roundups, newsletters, directories and writers that cover the category, starting with pages the visibility audit shows assistants cite. For each: the exact submission route or contact, rules, and a specific pitch angle. Draft pitches; sending is an owner decision or a separate grant.

**page-builder.** Turn situations and search demand into answer-first pages with real, cited facts, prepared as a change for review in the product repository (only where the owner has allowed code changes). No invented numbers or quotes.

## Creative

**concept-team.** For one bet, several agents each develop a different premise (problem-first, proof-first, contrarian, story), not variations of one line.

**critic.** Score concepts against fixed criteria: relevance to the situation, truth (every claim checkable), distinctness from competitors' wording, clarity of the next step. Argue against the favorite.

**voice-editor.** Make the chosen copy read like a person wrote it: run `lint-copy`, fix every flag, then reread for rhythm. Output the exact text for owner approval.

## Judgment

**analyst.** Weekly: `pull`, then check each metric's trust (does the number match a second source?), score running bets with `bet show`, and flag anything that looks off. Never closes bets; tells the CMO which are due.

**red-team.** Before a bet starts, try to kill it: weak evidence, a competitor already doing it, platform rules or spam filters, a cheaper test that answers the same question. Returns the strongest objection; the CMO records it as the bet's `--risk` or drops the bet.

**playbook-librarian.** After a bet closes with a `--tactic`, check whether its result changes how that tactic should be described in `playbooks/` (public, sourced cases only; a brand's private results stay in its engine). Propose edits as framework changes.
