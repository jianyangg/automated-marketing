# AI visibility: get recommended by assistants

Use alongside the [distribution procedure](distribution.md) for any brand that wants to be named when people ask an assistant for a product like theirs. Evidence and sources: `npm run engine -- playbook` (tactics `earned-list-inclusion`, `specific-need-pages`, `search-indexing`, `entity-mentions`, `ai-mention-tracking`).

## What actually moves it

Assistants mostly recommend what third-party pages already say. For a category, find which domains they cite (category trackers, or run the prompts below and record the citations) and treat those pages as the target, ahead of the brand's own site. Small brands appear on specific-need questions long before generic "best X" ones.

## Procedure

1. **Baseline.** Write 10–20 unbranded prompts a real buyer would ask, weighted to specific needs the product meets ("a to-do list that limits me to three priorities", not "best to-do app"). Run each 10+ times per available engine. Record per engine: `observe --metric ai_mention_rate:<engine> --value <share of runs naming the brand> --unit share --source <engine>-probe`, and keep the cited URLs in `research/<date>-ai-visibility/`. An engine you cannot access is recorded `--value unavailable`.
2. **Entry ticket.** Confirm search crawlers are allowed and the site is indexed (Search Console, Bing Webmaster Tools, IndexNow). Owner account steps are handoffs.
3. **Earned presence.** From the cited-URL list, prepare inclusion pitches for roundups and listings, and genuine community answers where the brand is truly relevant. All of it is public copy: owner approves the exact text.
4. **Own pages.** For the top specific needs, answer-first pages with real cited statistics and quotations. Never invent numbers or quotes.
5. **Entity.** One consistent name; `sameAs` links in Organization schema to real profiles and listings.
6. **Monthly.** Rerun the same prompts, compare mention rate per engine, `decide` with the observation ids. Keep AI visibility separate from signups; it is a leading indicator, not the goal.

## Do not

Hide instructions for models in pages, keyword-stuff, fake freshness dates, or expect llms.txt or per-bot robots rules to change anything.
