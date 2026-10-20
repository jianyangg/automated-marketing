# Autonomous secondary-research protocol

Version 1.0 · October 13, 2026. Use existing public material and owner-supplied records. No surveys, interviews, focus groups, recruitment, or primary-data collection service is required or proposed by this framework. Reading published studies that used those methods is secondary research; recreating their data collection is outside scope.

The agent should actively use its available web search/open tools when a marketing decision needs external evidence. Do not wait for the owner to supply papers. A custom crawler, paid research product, separate LLM, or browser automation stack is not a prerequisite. This is a transparent, bounded desk review, not a claim to have conducted an exhaustive systematic review.

## 1. Two evidence questions

**Method evidence:** what does published research support about a marketing technique, in which task/population/channel, with which limitations?

**Business evidence:** what existing public sources and supplied business facts say about this offer, relevant customer situations, alternatives, proof, objections, and reachable places?

A good general paper does not prove this business has a particular problem. A competitor website describes its own positioning, not whether that positioning caused success. Keep these questions linked but separate.

**Firsthand founder/operator experience** can also inform a practical adaptation. Prefer the founder's own dated account, original interview or attributable case record with a concrete action, context and observed result. Verify who is speaking and what was actually done; seek failures, costs, incentives and contrary cases. Do not turn secondhand growth stories, unattributed screenshots or AI-generated advice into founder evidence. Record these sources as practitioner experience, separate from scholarly findings and this brand's outcomes; survivorship, self-reporting and different channels limit transfer. An interesting founder tactic justifies a bounded hypothesis when relevant, not a guaranteed growth claim.

## 2. Research-run contract

Save a brief before substantial searching: decision, question, business/context, geography/language/timeframe, inclusion/exclusion criteria, query families, effort cap, expected output, and what evidence could change the decision. Unknown scope remains explicit.

Use the owner's existing resources and available included tools. Do not purchase access, enter private accounts, collect personal profiles, or create recurring jobs merely to finish a review. No human-contact plan is produced when evidence is missing; return a narrower provisional decision or wait.

## 3. Search, retrieve, and challenge

1. **Orient:** identify terms, competing explanations, and candidate primary sources. Use review/meta-analysis literature to find relevant work, then inspect the studies behind material recommendations when possible.
2. **Search deliberately:** combine mechanism/task/outcome and context terms. Add contradiction/null/boundary/replication queries. Search beyond one publisher, vendor, platform, or SEO listicle. Platform facts require current official documentation; empirical effectiveness requires appropriate scholarly/primary evidence.
3. **Retrieve:** open the actual page or accessible author/institutional copy. Record DOI/title/authors/year, publication status, access level, and exact relevant section. An indexed snippet is a lead, not full-paper inspection. Abstract-only access supports only the statements actually available; inaccessible detail remains unverified.
4. **Appraise:** distinguish randomized evidence, meta-analysis, observational association, conceptual argument, working paper, vendor claim, and model simulation. Judge method quality and directness separately; a peer-reviewed experiment in another task is still an uncertain transfer.
5. **Check provenance:** deduplicate articles, syndicated coverage, reused datasets, and repeated claims. Several pages repeating one study are one source lineage. Retractions/corrections/current versions must be checked when available and relevant.
6. **Test applicability:** match product/category, audience, language, channel/format, funnel stage, timing, and measured outcome. Record what changes in this use case and what could reverse the recommendation.
7. **Synthesize:** write bounded finding → proposed adaptation → expected mechanism → limitation → acceptance check. Do not import a study effect size as this campaign's forecast.
8. **Stop or continue:** stop at the effort cap or when the decision-relevant mechanisms, contrary evidence, and remaining gaps are documented and another query family is not changing the decision. Record search limits; do not call this statistical saturation or proof of absence.

## 4. Evidence types and use

| Evidence type | Can support | Cannot establish alone |
| --- | --- | --- |
| Research synthesis/experiment | A mechanism in studied conditions | Universal tactics, current platform behavior, this brand's lift |
| Existing public statements/reviews | What those sources say; vocabulary and candidate problems | Population prevalence, representative segments, willingness to pay |
| Competitor/official product material | Published offer/features/claims at an observed time | Customer satisfaction or causal performance |
| Supplied first-party aggregate records | Defined observed activity under known limits | Causal attribution without an adequate identification design |
| Conceptual framework | A useful organizing lens/hypothesis | Empirical confirmation |
| LLM analysis/simulation | Theme/copy critique, scenarios, alternatives, sensitivity | Human respondents, independent validation, purchase probabilities |

Use plain labels for `finding`, `interpretation`, `design adaptation`, and `local result`. Record confidence rationale instead of a model-generated probability. Research-backed means there is relevant bounded evidence; it does not mean guaranteed or proven for every business.

## 5. Public-language corpus

Use this optional analysis when customer wording or category alternatives matter. The review-mining and review-selection evidence in the [library](evidence-library.md) supports both its usefulness and its limits.

Define a corpus plan: venues, query terms, category/alternatives, date/language filters, inclusion criteria, per-source effort limits, and unavailable sources. Seek positive, negative, mixed, incumbent-satisfied, and no-change accounts; do not search only for pain. Balance source slices where feasible, but do not call this representative sampling.

Store each observation with source URL, date accessed/published where known, a short necessary excerpt or paraphrase, product/context, directly stated problem/desired consequence/alternative/objection, and analyst interpretation in separate fields. Avoid unnecessary identities. Deduplicate reposts/quoted comments and track source lineage. Search snippets are marked excerpt-only and cannot establish missing context.

Code with a small inspectable codebook. Retain the row IDs behind every theme and negative case. LLMs can propose codes; the agent must revisit cited rows for key conclusions and record ambiguous/miscoded examples. A second correlated model pass is a consistency check, not independent human coding reliability.

Counts mean “in the collected corpus,” with an explicit denominator and acquisition rules. They are not customer percentages or market-size estimates. Sparse/one-venue evidence produces hypotheses. Do not generate missing rows, balance an observed sample with simulated consumers, infer sensitive traits, or invent a demographic segment.

## 6. Positioning from secondary evidence

Build a source-linked matrix: observable alternative, stated promise, verified capability/proof, situation/objection, price/availability if verified, and uncertainty. Compare against satisfied substitutes and doing nothing. Choose a problem/benefit/proof pairing the business can actually substantiate.

A descriptive analyst map is allowed when axes come from explicit source criteria. Label it as an analyst synthesis. Without suitable real input data, do not claim consumer-perception MDS, PCA, factor analysis, conjoint utilities, segment sizes, preference shares, or willingness-to-pay estimates. LLM ratings cannot manufacture the missing consumer measurements.

Tie each positioning hypothesis to an evidence row and a credible reason to believe. Differentiate through useful truth and demonstrated mechanisms, not unsupported superlatives or cosmetic word changes. Low evidence can still justify a reversible draft direction; it cannot justify false certainty.

## 7. Research artifacts and update policy

Keep private business work under its brand folder:

```text
research/<run-id>/
  brief.md
  search-log.md
  evidence.md
  observations.jsonl        # Optional real-source rows; no synthetic padding
  synthesis.md
```

The supplied [templates](../../templates/research/README.md) define the portable fields. Sources themselves are not copied wholesale into the public framework. Retain only necessary excerpts/summaries and links, with access/copyright/privacy limits.

A conclusion links to its sources, corpus rows, method version, and affected strategy/campaign. Set review triggers for product changes, newer contradictory findings, platform changes, stale sources, or actual outcomes. New evidence opens a versioned revision; it does not silently rewrite approved work. [PRD](../PRD.md) defines current acceptance requirements and the unimplemented runtime boundary.
