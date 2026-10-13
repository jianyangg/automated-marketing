# Structured LLM critique and sensitivity analysis

Purpose: use the existing Codex model to find defects, compare communication choices, and improve artifacts without surveys or a second required model service. This is internal analysis, not a replacement dataset of human respondents. The [evidence library](evidence-library.md) separates positive findings about task-specific synthetic methods from limits and judge biases.

## 1. Allowed jobs

- Check whether the supplied artifact states a clear offer, supported benefit, proof, and next action.
- Identify unsupported assertions, confusing language, overlooked objections, missing context, and poor alignment with a documented use situation.
- Compare concepts against an explicit rubric and alternative interpretations.
- Explore evidence-grounded scenarios and inspect how conclusions change under different plausible assumptions.

Do not ask for a simulated survey or output consumer purchase percentages, willingness to pay, preference share, market size, conversion forecasts, demographic truth, or confidence intervals from model votes. More generations are more analyses, not more independent people.

## 2. Freeze inputs and gate facts first

Save candidate versions and evidence references. Before judging, declare a maximum pass/call/time budget appropriate to the task and available capacity; track consumption. Check factual claims, product availability, asset rights, identity, required format, destination, and prohibited claims using sources and deterministic tooling where possible. Taste scores cannot override a failed fact/rights gate.

Prepare an explicit rubric before viewing score patterns. Suggested dimensions: comprehension, relevance to the documented situation, specificity/proof, differentiation from cited alternatives, brand/offer recognition, useful next action, and contextual appropriateness. Use anchored ordinal judgments such as meets/partial/fails/unknown, with a cited phrase and concrete reason. Weights are an owner/design choice, not an empirically calibrated probability.

## 3. Compare without false independence

Use neutral candidate labels and equal presentation. Conceal generator/brand prestige labels from a reviewer when possible. A reviewer that already saw the generation is not genuinely blind: record `same_context` rather than claiming blindness.

Whenever pairwise preference influences a decision, initiate A/B and B/A comparisons, using isolated context when available. If reversal cannot be completed, mark the preference provisional and the order check incomplete. Ask for dimension-specific defects before an overall preference. Prevent verbosity from winning by default: compare equivalent information/format and require evidence of task value. If the ranking changes with order or framing, mark it unstable; preserve a tie/unknown or revise before claiming a preferred internal option.

Independent context does not make the underlying model independent. Role prompts and sub-agents may remain correlated, share training priors, and favor familiar style. Extra judge passes are only used when their decision value justifies attention/tool capacity, within delegation permissions. No paid-model fallback is implied.

## 4. Ground scenarios in real-source observations

Use a small explicit scenario matrix: problem/use situation, available alternatives, knowledge at the point of exposure, objection, and desired consequence. Link each assumption to public/supplied evidence or label it a hypothesis. Do not invent sensitive attributes, biographies, or fictional interviews to supply missing market data.

Ask “what in this copy could be unclear under this scenario?” rather than “what percentage of people like this will buy?” Counterfactual scenarios expose robustness limits; they are not observed customer segments. Preserve disagreements and plausible interpretations instead of averaging them into a fake demand score.

## 5. Evaluation record

Record evaluation ID; artifact/context/rubric versions or hashes when tooling supports them; generator/judge identity/version when exposed (otherwise unknown); same/isolated context; candidate order; scenario assumptions; dimension judgments; concrete cited defects; dissent; stability result; chosen revision; declared effort limits/consumption; and calibration task/domain/reference data/evaluation separation or unknown status.

Separate `internal_preference`, `rule_violation`, `unresolved_question`, and `observed_market_result`. The first cannot be promoted to the last by repetition. No automatic publication, spend, price selection, or strategy adoption follows from a model verdict.

## 6. Calibration and stopping

Known-defect fixtures assess only detection of those tested defects; preserve misses and false alarms. They provide no audience-prediction calibration. Existing real outcomes may support a task-specific comparison only with their definitions, attribution limits, and population/domain recorded. Record whether evaluation examples were separate from prompt/rubric development; reused examples are not held-out validation. Without suitable separate reference evidence, mark that task uncalibrated. Neither fixture success nor a correlation with past outcomes establishes universal prediction or causal validity.

Stop when actionable defects and the meaningful disagreements are clear or the declared effort is spent. Preserve partial findings and incomplete checks at the limit. Do not repeat judges until they endorse a favorite. A stable preference is still internal; an unstable or missing-evidence case can return inconclusive and a reversible next step. No human survey is required to make honest bounded progress.
