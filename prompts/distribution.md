# Distribution: find how to get anything in front of the people who need it

Use for any proposal ("grow this app", "launch this product", "fill this event", "sell this service") and whenever a channel review says the current lever is not moving the north star. Work autonomously: decide, execute within authority, report results.

## 1. Classify the proposal (minutes, from the brand's own files and the live product)

Business model and price, audience and where they spend attention, stage (pre-PMF with no audience / some users / growing), assets (site pages, free tools, content, lists, founder presence, app-store listing), constraints (budget, identity rules, what the owner will and will not do). Check the live product and site yourself; existing assets are often the cheapest lever.

## 2. Study comparables from primary sources

Find 5–10 companies that were at the same stage in the same category and got traction. Prefer founder-stated sources: retrospectives, interviews, launch threads, revenue posts. For each, record the exact sequence of tactics, reported numbers with dates, the source, and why it may not transfer (era, funding, existing audience, platform). Seek counter-evidence: tactics founders say failed. Save to `research/<date>-comparables/` and add any new, well-sourced tactic to the shared [playbook](../playbooks/early-traction.json) (`npm run engine -- playbook`).

Copying winners is survivorship-biased. A borrowed tactic is a hypothesis until this business's own numbers support it.

## 3. Map venues and demand

Where the audience already asks for help: specific communities (with their self-promotion rules quoted), newsletters and blogs that cover the category, directories and launch sites, and search queries a small site could realistically rank for. Save to `research/<date>-venues/`.

## 4. Choose and improve

Score candidate tactics on: evidence strength and transfer, audience presence, time to a readable signal, cost, whether you can execute it yourself, and fit with this product's specific edge. Then improve on the copy: combine tactics (a free tool that is also the community contribution and the press hook), use assets competitors lack, and time it to seasonal intent.

Pick at most three concurrent tests. Each gets a hypothesis, a tagged variable (`--variable tactic=<playbook id>`), a success threshold and a kill date, recorded with `decide --verdict wait` and `--review-at`.

## 5. Execute

- **API channels** (Threads today): `propose` → `publish` under the owner's grant.
- **Site and product changes** (pages, tools, copy): prepare them in the product repository on a branch, verify locally, and leave them ready for the owner to merge. Never deploy to production unasked.
- **Person-only channels** (communities, launch sites, directories, outreach, newsletters): `propose --channel <venue>` with the exact ready-to-use content, then `publish --via manual`. The handoff holds the account until a person posts and you record the `receipt`. Never automate posting where the platform expects a person, and never pose as an unaffiliated user. Disclose "we built" in the brand's voice.

## 6. Learn

`pull`, then on each review date compare against the threshold and `decide` with evidence. Results stay in the brand's private engine state, grouped by the `tactic=<playbook id>` variable, so the next decision for this brand starts from what actually worked here. The shared playbook takes only public-source evidence; never copy a brand's private results into it.
