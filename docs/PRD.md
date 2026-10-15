# Automated Marketing — reusable Codex CMO

Version 3.0 · October 13, 2026 · Status: specification for implementation

## 1. Product contract

A business owner clones the framework, opens it in Codex, and adds a folder containing business context and assets. Codex functions as the chief marketing officer: understand the business, investigate customers and alternatives, choose priorities, propose strategy, execute campaigns through available tools, and learn from outcomes.

The framework supplies repeatable workflows and durable operating state. It has no built-in business, audience, channel mix, account, budget, historical marketing program, or dependency on a particular computer. One operator may manage one or many independent brand folders.

Fresh strategy is the default. Existing marketing is optional evidence to evaluate critically. It does not determine the new strategy simply because it already exists.

The framework combines independently specified business-context, campaign, review, delivery, and learning contracts. Academic evidence informs methods; product documentation informs integration possibilities. Research findings, engineering adaptations, and locally tested results remain distinguishable. [Research methods](research/secondary-research.md), [Operational comparisons](research/comparative-analysis.md)

**Governing outcome:** improve a business's qualified acquisition or customer lifecycle with less operator effort. Creating more posts is not sufficient evidence of success.

## 2. Audience, scope, and product principles

Initial operators are entrepreneurs, maintainers, and small teams comfortable opening a project in Codex. Their businesses may sell software, local services, physical goods, expertise, or content. Optional modules support different conversion paths; no App Store or commerce fields are mandatory for a service business.

The framework is designed for later open-source distribution. This is not a hosted multi-tenant SaaS or a replacement CRM. It does not require a separate LLM API subscription. Codex remains the reasoning system and primary interface; deterministic software handles state, validation, rendering, external actions, and reporting calculations.

Principles:

1. Diagnose the goal and bottleneck before prescribing content.
2. Keep facts, hypotheses, preferences, and execution authority distinct.
3. Make one new brand useful through folder-based onboarding, without modifying framework code.
4. Prefer complete reviewable work to advice that creates another production task.
5. Separate preparation from external execution; degrade to useful manual output.
6. Make source context, decisions, versions, costs, and results inspectable.
7. Keep private business work separate from distributable framework code.
8. Never carry live authority into another installation through a copied folder or backup.

## 3. Release slices

| Slice                            | Usable product                                                                                                                                         | Required evidence                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| R1 — CMO and manual execution    | Folder onboarding, research/diagnosis, strategy, campaign or validation plan, complete export packs, observations, learning, session recovery          | Clean-clone workflow with a fictional unrelated business and no connectors |
| R2 — reliable organic automation | R1 plus automated delivery worker, one tested publisher, exact grants, calendar/worker, notices, bounded Autopilot, selected measurement/inbox imports | Fault tests, account commissioning, and supervised live cycle              |
| R3 — expansion                   | More formats/connectors, richer designer, CMS/email/app/commerce modules, optional paid execution                                                      | Separate use case, feasibility, economics, and authorization gates         |

R1 requires a small transactional runtime for durable versions and decisions; it does not require a running daemon, social credentials, image-generation service, or MCP installation. Before that runtime exists, the repository remains a specification even if its templates can be read in Codex. R2 is required before claiming automated publishing or Autopilot works.

Excluded: surveys, interviews, focus groups, customer recruitment, synthetic consumer panels, proprietary predictive-model training, mass cold outreach, public signup/billing, agency administration, a general CRM, a second chat application, and a mandatory infrastructure fleet. Published participant studies may inform methods; this framework does not conduct them. Research uses secondary sources and existing legitimate observations; LLMs evaluate artifacts rather than replacing sampled people.

## 4. First-run and ongoing journeys

### First clone

The owner opens the framework root in a supported local Codex client. Generic project guidance identifies the CMO workflow, current capabilities, and status. A setup/doctor operation checks pinned runtime, workspace access, optional tools, safe private paths, and supported platform. It makes no account connection, purchase, public write, autostart service, or recurring job.

A synthetic example demonstrates the local workflow without external credentials. Missing optional tools reduce available capability; missing required dependencies produce an actionable diagnosis. Installer commands and versions must match the actual shipped release.

### Add a business

The owner adds `brands/<business>/` containing any useful context/assets and asks Codex to onboard it. The workflow discovers files, creates a stable identity, asks only essential missing questions, distinguishes known facts from assumptions, and proposes a fresh diagnosis and strategy. It then produces one complete campaign pack or validation plan suited to the diagnosis.

No YAML editing, social account, prior marketing history, or custom framework branch is necessary. An empty or ambiguous folder can require basic business facts; it must not be filled with invented ones. [Folder contract](brand-workspaces.md)

### Run the CMO cycle

Goal → evidence → diagnosis → prioritized opportunity → strategy/campaign → deliverables → authorization → distribution → observations → decision. Every transition has a durable record and an explicit missing-input path. The right action can be research, offer clarity, destination repair, content refresh, organic distribution, lifecycle work, or waiting.

### Delegate ongoing work

Generation/research and publication are independently controlled. The owner can allow recurring preparation without enabling public execution, approve concrete batches, or enroll specific brand/accounts/content classes in a standing Autopilot policy. Setup alone never enrolls a brand. [Operating loop](cmo-operating-model.md)

### Resume, copy, or leave

A new Codex chat reads a compact operating brief and relevant brand state. Copies and restores preserve selected context/history but start suspended. Archive, export, upgrade, disconnect, and uninstall have explicit behavior for timers, jobs, account bindings, and retained data.

## 5. Primary interface and owner control

| Owner intent                                           | Reviewable result                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| “Act as CMO for this new business folder.”             | Fresh diagnosis, essential unknowns, strategy choices, first useful plan                                |
| “What is the most valuable marketing work this week?”  | Ranked opportunities, rationale, resources, displaced alternatives                                      |
| “Research this market and challenge our assumptions.”  | Bounded web investigation, traceable themes, contrary evidence, limits, and a decision                  |
| “Which of these concepts is stronger?”                 | Factual gates and internal rubric critique, order sensitivity, tradeoffs, or an inconclusive comparison |
| “This old marketing feels weak. Start again.”          | Preserved originals, fresh hypotheses, explicit reuse/rejection decisions                               |
| “Turn this guide into a campaign.”                     | Shared campaign brief, core asset, intentional channel adaptations, measurement plan                    |
| “Show what needs a decision.”                          | Concise changed items, concrete artifacts, blockers, requested decisions                                |
| “Approve these versions for these accounts next week.” | Scoped authorization and schedule receipts                                                              |
| “Let the approved routine run automatically.”          | Concrete policy proposal and explicit enrollment                                                        |
| “Stop publishing for this brand.”                      | Immediate suspension of pending deliveries, visible in-flight outcomes                                  |
| “What did we learn?”                                   | Comparable observations, uncertainty, continue/change/stop/wait decision                                |
| “Move this business to another computer.”              | Portable export and suspended-import/handover procedure                                                 |

Use small local views only where useful for owner input: OAuth, exact review, assets, spatial editing, and calendar manipulation. They share the same state and rules as chat. A host-verifiable chat approval can be recorded directly; otherwise a prepared local review snapshot supplies the trusted owner confirmation. Agent-authored approval flags are not authority.

The [read-only dashboard](dashboard.md), implemented October 15, shows goal metrics, dated progress charts, the next move and evidence-linked lessons, with records available on demand. It reads existing private records and metric selectors without an operational database, write endpoint or approval control. Values show their source/observation time and keep provider definitions separate. This view does not complete the planned execution runtime or grant any of its authority.

## 6. Functional requirements

R1/R2/R3 below are release commitments, not implementation status.

### FR-01 — Clean-clone bootstrap · R1

Ship generic root operating guidance, focused repo workflows, a pinned reproducible runtime, doctor/setup, a synthetic example, and honest capability/status reporting. Root guidelines and instruction-only workflow prompts exist now; runtime and skill packaging remain future implementation. Do not depend on personal plugins, previous chat, absolute home paths, or model API credentials.

**Acceptance:** a new supported machine reaches a useful local diagnosis/export using only published setup instructions; no external action or job is created by installation. Unsupported environments fail clearly or retain explicitly supported manual capability.

### FR-02 — Brand folders and lifecycle · R1

Discover arbitrary folders, create stable identity independent of path, validate/import files, detect changes, and support rename, fork, archive, export, and removal. Preserve originals and show conflicts. File changes are evidence updates, never implicit publishing instructions.

**Acceptance:** an unrelated fourth business requires no code change. Unchanged scans are idempotent; duplicate IDs are blocked; missing folders suspend execution. Copies/imports do not transfer live accounts, grants, or timers.

### FR-03 — Grounded business context · R1

Maintain separate product/service truth, customers/audience hypotheses, voice, visual preferences, proof, exclusions, and goals. Material claims carry sources, dates, verification status, and relevant availability/market limits. Owner corrections remain reviewable.

**Acceptance:** unknown price stays unknown; prelaunch functionality remains gated; deleting a positioning hypothesis does not delete product facts. Each artifact records the context revisions used.

### FR-04 — Customer, market, and competitor research · R1

Use bounded research briefs with objective, scope, source constraints, timeframe, effort, and expected decisions. Consider customer problems, triggers, objections, substitutes, satisfied incumbent users, and doing nothing. Store citations and contradictory evidence.

Use existing Codex web/search/browser capabilities proactively through FR-25–26. Keep method evidence separate from brand-market evidence. No new surveys, interviews, focus groups, recruitment, or synthetic panels.

**Acceptance:** conclusions distinguish observation from interpretation and public-corpus counts from market prevalence. Tool/network absence produces an incomplete-research state and useful next tasks; LLM reactions cannot fill the gap.

### FR-05 — Goal and bottleneck diagnosis · R1

Define the business outcome, conversion path, baseline or missing baseline, plausible constraint, evidence, and next decision. Evaluate product/offer readiness, customer access, destination quality, acquisition, activation, and retention where relevant.

**Acceptance:** high traffic with weak conversion can prioritize proof/destination work over more awareness. The diagnosis can return “insufficient evidence” with a validation plan rather than confident speculation.

### FR-06 — Fresh strategy and positioning · R1

Propose target audience, situation/problem, proposition, reasons to believe, alternatives, channel rationale, and testable positioning. Existing marketing is optional historical input, evaluated rather than inherited. Record adoption and review conditions for strategy decisions. Superseding strategy identifies affected campaigns, queued work, and policies; hold incompatible future execution until an explicit retain/revise decision and any required renewed authority.

**Acceptance:** a folder containing poor old copy is not treated as an approved voice. Retained/replaced/unresolved elements have reasons. Strategies remain hypotheses until supported by real outcomes.

### FR-07 — Opportunity and portfolio prioritization · R1

Maintain opportunities across research, offer/destination repair, creation, refresh/reuse, distribution, inbound/lifecycle, and product feedback. Compare impact hypotheses, confidence, effort, cash, dependencies, reversibility, and learning value. Allocate finite operator attention across brands using minutes/hours per planning window, committed owner tasks, estimated remaining effort, and actual effort when available. Replan when capacity or dependencies change; unknown capacity remains provisional.

**Acceptance:** a weekly plan explains a selected action against an alternative. Adding a brand cannot silently multiply cadence or exceed resources. Scores are judgment aids, not invented forecasts.

### FR-08 — Campaign and content lineage · R1

Every campaign specifies goal, audience, problem, proposition, proof, core asset/offer, conversion destination, channel rationale, deliverables, dependencies, resources, observation window, and exit criteria. Link the brief to adaptations, approvals, deliveries, observations, and decisions. A validation plan is a first-class alternative with question/hypothesis, evidence needed, secondary method, source criteria, tasks, effort, authority needs, observations, exit condition, and decision; distribution can be explicitly not applicable.

**Acceptance:** missing proof/destination becomes a task or blocker. A material fact correction identifies affected future work without rewriting history. Before execution, recheck relevant local dependency digests/missing files or a policy-bounded fresh inventory; remote-source freshness has its own explicit age/evidence rule. One core asset can produce several intentional adaptations.

### FR-09 — Complete production and reuse · R1

Produce usable copy, media/compositions where available, alt text, links, calls to action, scripts, and instructions. Support useful text-only output and owner asset requests. Track parent asset, context, version, and channel adaptation. Bound batch production and preserve partial completion.

**Acceptance:** each requested deliverable is complete, explicitly blocked, or deferred. No fabricated product screen, person, testimonial, customer outcome, or numeric claim. A failed image tool cannot erase completed copy or force a paid fallback.

### FR-10 — Suggestions and editorial learning · R1

Offer explained suggestions with approve, revise, defer, reject, replace, and optional reasons. Distinguish per-artifact edits from persistent preferences; allow review/removal and channel scope. Keep approval rate separate from market response.

**Acceptance:** rejection preserves history; deferral is not dislike; a one-off edit does not silently become a brand-wide rule.

### FR-11 — Assets, design, and creative versions · R1/R3

R1 supports source metadata, real evidence, reusable editable templates, crop/resize, text, asset replacement, immutable exports, and rollback. R3 adds richer layers and optional transformations as justified. Verify rights and identity before public use.

**Acceptance:** exports can be reproduced from saved inputs. A flattened image is not falsely presented as recovered editable layers. Editing approved media creates a new version and invalidates affected authority.

### FR-12 — Owner authority and cost scope · R1/R2

R1 records explicit concrete manual-handoff approval where supplied. R2 enforces external execution through trusted owner grants bound to typed action, target resources, recipient/audience list version or bounded selector, exact versions, assets, links, stable accounts, timing, and allowed cost. Batch grants enumerate bundles. Standing policies are separately activated.

**Acceptance:** changing scope requires appropriate renewed authority. No imported file, tool result, model-generated flag, or silence creates a grant. Reconnecting as another remote account invalidates incompatible authority.

### FR-13 — Calendar, scheduling, and workflow controls · R2

Use one concept with per-channel deliveries, explicit manual/automatic origin, IANA timezone, UTC execution, and distinct proposed/authorized/scheduled/published states. Support reschedule, cancel, and emergency stop. Reconcile provider-managed cross-posting.

**Acceptance:** mirror plus standalone publishing cannot duplicate a post. Missed slots, DST, and in-flight cancellation follow declared rules. Stopping generation is distinguishable from stopping queued execution.

### FR-14 — Publication and recovery · R1/R2

R1 provides manual export, actual-publication closure, content/account matching, and receipt confidence. R2 adds automatic attempts, official adapters, and remote reconciliation. Use tested official adapters or complete manual exports. Persist attempts and remote IDs, reconcile uncertain results before retrying, and retain per-destination receipts. Manual closure records actual content/account and confidence. Remote edits/deletions remain visible history.

**Acceptance:** timeout after success cannot trigger blind duplicate publication; partial success retries only safe failed deliveries. Unknown manual outcomes block competing API attempts. Deleted remote work is not automatically reposted.

### FR-15 — Bounded Autopilot · R2

Maintain a configurable rolling plan, initially fourteen days, through explicitly activated preparation and execution policies. Scope brand, accounts, content classes, cadence/windows, source freshness, resources, and notice semantics. Provide concrete advance notice; a proposed twenty-four-hour window is configurable by policy.

Offer individual review and deliberately enrolled delegated organic publication. Advance notice, explicit local authority, and failure handling define the execution contract independently of any commercial platform.

**Acceptance:** unknown/failed notice submission blocks automatic execution; material edits restart notice or require exact approval. Disable returns automatic pending work to drafts while preserving owner-scheduled work. Autopilot cannot expand its own authority.

### FR-16 — Inbound conversations and product feedback · R1/R2

R1 permits manual/source-linked entry and draft replies; R2 imports selected supported channels. Classify questions, objections, complaints, and repeated friction into linked content, positioning, or product opportunities. Public replies/sensitive actions remain separately authorized.

**Acceptance:** unsupported inbox coverage is not displayed as an empty inbox. A repeated product issue produces a concrete product brief, not a claim that the product was fixed. No cold outreach is authorized by an inbound message.

### FR-17 — Measurement commissioning and integrity · R1/R2

Define observable conversion, data source, metric/unit, denominator, window, lag, attribution, and privacy limits before claiming success. Support idempotent manual report imports in R1; automate selected sources in R2. Store raw observations, corrections, calculations, and interpretations separately.

Label conclusions descriptive, attributed, associational, or causally identified. Record identification assumptions and confounders for the latter; path attribution cannot become incrementality. No new participant research is required. [Measurement evidence E10–11](research/evidence-library.md)

**Acceptance:** repeated import does not change totals. Suppressed/delayed/unavailable are not zero. Different currencies/definitions/windows are not silently combined. Clicks do not become installs or attributable revenue.

### FR-18 — Experiments and decisions · R1

Specify hypothesis, changed variable, eligible comparison, metric, evidence needed, review window, and stop condition. Record continue/change/stop/wait with uncertainty, next action/date, and affected future work. Separate editorial, operational, and market outcomes.

Learning can use passive outcomes or an already authorized ordinary campaign comparison; participant recruitment is outside scope. Existing credible experiments may support bounded causal findings. Internal concept scores, sharing, purchase intent, and actual buying remain different measures.

**Acceptance:** tiny incomparable results cannot declare a winner. Better engagement cannot establish business success when conversion quality declined or is unknown. Learning is recoverable in a new chat.

### FR-19 — Resource and capability limits · R1/R2

Track finite Codex/tool capacity, owner attention, optional service expenses, and future media spend separately. Reserve billable costs atomically; block unknown pricing or unapproved top-ups. Persist partial work when reasoning/tools fail.

**Acceptance:** no separate model API is required; included capacity is not described as unlimited. The worker executes only committed authorized work when Codex is unavailable and cannot invent new copy or grants. Missing tools retain usable supported paths.

### FR-20 — Durable operating protocol · R1

Apply [Use/Edit modes](workspace-modes.md). New chats default to Use: business work stays private and cannot implicitly rewrite the framework. A direct owner framework-change request permits only a bounded Edit task; completion/cancellation returns to Use. Modes are instruction boundaries, not a security sandbox or execution authority. Acceptance scenarios T67–T72 cover the distinction.

A new Codex session reads workspace status, current goal/strategy, top opportunities, active campaigns, upcoming work, blockers, and decisions. Keep focused repo workflows and compact brand context; retrieve evidence as needed. Record every material transition outside chat history.

Codex owns workspace organization: one compact brand index, stable campaign/task/research records, material decision/version history, and evidence-linked lessons. Consult comparable earlier work before new planning, rechecking applicability and truth. Preserve owner inputs and reviewed versions; avoid root-level draft sprawl, duplicate summaries, and chat dumps. The [workspace stewardship contract](brand-workspaces.md#10-workspace-stewardship-and-learning) applies to manual records now and generated runtime views later.

**Acceptance:** no past transcript or author memory is necessary to resume. Default updates highlight meaningful changes and decisions. A session must not load all private brands simply to work on one.

### FR-21 — Backup, upgrade, export, and uninstall · R1/R2

Version package/database/export/connector contracts. Back up before migration, validate asset manifests, handle interrupted upgrades, and export brand-only data. Imports/restores start suspended; reconnect identity, reconcile remote outcomes, and obtain future authority before resumption. Explicitly manage worker/timer installation and removal. Executable enrollment is bound outside copied project state to a host-local secret, canonical workspace root, and execution epoch; mismatch suspends the worker. Before R2 enrollment, declare backup cadence, maximum tolerated data loss, retention/storage limit, and a tested restore-time objective.

**Acceptance:** restore cannot republish stale jobs; copy cannot create a second active publisher. Uninstall stops owned timers/processes and revokes local execution without deleting remote posts. Failed backup/migration preserves recoverable data.

### FR-22 — Extensible execution adapters · R1/R2

Ship manual export first, then one tested publisher. Define descriptor/capability, connection/identity/health, validate/prepare, execute/status/reconcile, optional metrics/inbox, cost, and disconnect contracts. Extensions use application authorization and isolation checks.

**Acceptance:** adding a connector does not require brand-specific domain branches. Publishing access does not imply DMs/analytics. Extensions are trusted local code and are not falsely described as sandboxed plugins.

### FR-23 — Optional business and channel modules · R1/R3

R1 can prepare complete briefs/copy/change packs for website conversion, search content, email/lifecycle, apps, commerce, and service lead generation. Actual CMS/email/store/paid writes are separately commissioned R3 adapters. Module activation follows the business objective, not its mere availability.

**Acceptance:** a local service needs no App Store configuration. A campaign can improve a destination or refresh existing content instead of making a new social post. Consent and business-specific evidence requirements apply when the relevant module is used.

### FR-24 — Open-source distribution and quality · R1 onward

Separate public framework/templates/fictional examples from private workspaces, state, logs, secrets, and exports. Supply actual ignore rules, release allowlist/data scan, supported-platform matrix, reproducible setup, and maintainer documentation. Original framework content uses the [MIT License](../LICENSE); inspect the terms of third-party sources/dependencies before incorporating them.

**Acceptance:** a clean release has no personal home paths, real accounts/assets, inherited grants, or business-specific budgets. Docs match actual shipped commands. New-user and adversarial review are repeatable quality gates, with resolved findings traced to tests.

### FR-25 — Autonomous secondary-research runs · R1

Codex uses its available research tools to investigate a bounded decision without a new search service or model subscription. Record question, query/source plan, dates, limits, actual sources opened, inclusion/exclusion, countersearch, methods/outcomes, access level, publication status, applicability, and stopping rationale. Follow the [research protocol](research/secondary-research.md); distinguish research findings, vendor facts, public observations, and proposed transfers. Store source revisions and affected decisions; corrections or changed applicability mark dependent conclusions for review without silently rewriting history.

**Acceptance:** summaries cannot imply full-text inspection when only an abstract was read. Contradictory evidence and unresolved gaps survive synthesis. Exhausted tools preserve partial work; no new surveys or synthetic customer responses substitute for missing evidence.

### FR-26 — Traceable public-language and positioning analysis · R1

Build a selected corpus of public reviews, discussions, competitor documentation, and existing legitimate observations. Preserve source/date/version, permitted minimal excerpt or paraphrase, raw statement versus interpretation, deduplication group, context, valence, theme codebook, and coverage limits. Include contrary/positive evidence and rare consequential issues. Produce source-backed alternative/attribute matrices and candidate audience/situation hypotheses.

**Acceptance:** duplicates cannot inflate theme counts. Ambiguous attributes retain contextual meaning; corpus percentages are not market prevalence. An analyst positioning map is not measured consumer perception, MDS/PCA, conjoint, preference, willingness-to-pay, or market share. No simulated population fills missing groups.

### FR-27 — Evidence-informed creative development · R1

Use a source-grounded brief and deliberately different customer situations, promises, proof mechanisms, or narratives when alternatives matter. Separate exploration from refinement; review conceptual duplication across the batch and relevant past work. Assess originality and appropriateness independently, with truth/proof, brand connection, placement intent, interruption, production effort, and CTA burden. Keep sharing usefulness distinct from qualified acquisition. [Creative protocol](research/creative-development.md)

**Acceptance:** paraphrases count as one direction; irrelevant novelty does not pass. Creative scores cannot become sales/viral forecasts. Candidate limits and review passes are bounded engineering choices, not scientifically established optimal quotas.

### FR-28 — Bounded LLM concept critique · R1

Use existing Codex to inspect clarity, relevance, proof, objections, differentiation, context, and next action. Freeze inputs, an anchored rubric, and a maximum pass/call/time budget; track consumed effort. Check facts/rights/availability before taste. Initiate both orders whenever pairwise preference influences a decision; incomplete reversal makes a preference provisional. Allow ties, abstention, and unstable results. Hide generation rationale where feasible and disclose same-context/shared-model limits. Persist candidate/evidence/rubric revisions, order, available model metadata, findings, dissent, task/domain calibration/reference data/development separation or unknown status, and decision. [Evaluation protocol](research/llm-evaluation.md)

**Acceptance:** a preferred candidate with a failed factual gate is held. Reversed rankings stay inconclusive; correlated agents are not independent respondents. No synthetic purchase rates, WTP, respondent counts, confidence intervals, demand validation, or predicted lift. Defect-fixture success applies only to that task. Critique never creates publishing/spending authority; optional critic failure retains drafts and owner review.

## 7. Data and technical quality

SQLite is authoritative for reviewed operating state and transactional execution. Brand folders hold selected source inputs and portable snapshots. Source edits enter through validated diffs; output edits never silently overwrite approved database state. Credentials are referenced through a portable secret-store abstraction. [Architecture](architecture.md)

Required properties: brand isolation; immutable content and authority; local idempotency; stop-and-reconcile on ambiguous remote writes; reproducible metric calculations; private-by-default data; recoverable state; keyboard-accessible owner views; clear failure and resume paths.

Scheduled local Codex work depends on computer/app availability and plan permissions. Continuous reasoning is not guaranteed. Preauthorized committed deliveries can use a separate deterministic worker; remote delivery is optional and separately costed. [Official scheduling documentation](https://developers.openai.com/codex/app/automations)

## 8. Success and readiness

Proposed engineering targets, not promised business lift:

| Measure               | Release target                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| New-user independence | All required R1 tests pass on the declared supported environments without author files/history                                       |
| New-brand extension   | Folder/context only; zero framework code changes                                                                                     |
| First value           | One grounded diagnosis and complete campaign or validation plan in a supervised onboarding session                                   |
| Research integrity    | Decision claims trace to inspected sources, with counterevidence, access/applicability limits, and no manufactured customer evidence |
| Creative review       | Conceptual alternatives, relevance/proof gates, and model-order sensitivity remain inspectable; no audience-prediction claim         |
| Control               | Every external delivery traceable to exact owner authority or enrolled policy                                                        |
| Publication tests     | Zero unauthorized or duplicate deliveries in the tested failure scenarios                                                            |
| Measurement tests     | Reimports/corrections/unknowns preserve truthful totals and definitions                                                              |
| Portability           | A brand export imports on a clean runtime suspended, with verified hashes and no secrets/live authority                              |
| Operator value        | After four recurring cycles, review plus maintenance is lower than the recorded prior workflow                                       |
| Marketing value       | Evidence of qualified demand or a better-informed decision; targets set after the business baseline                                  |

Release coverage and fault scenarios are in [Acceptance suite](acceptance.md). Staged implementation, costs, risks, and open-source gates are in [Delivery plan](delivery-plan.md).

## 9. Unresolved implementation decisions

The runtime/lockfile version, production secret-store implementations, first real publisher, notification route, and trusted owner-interaction implementation are not yet selected. These are explicit build/commissioning gates. The framework license is MIT. No account, budget, purchase, schedule, or publication permission is supplied by this PRD.
