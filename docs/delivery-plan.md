# Delivery plan and release gates

Specification, October 13, 2026. This document defines future implementation evidence; none of the planned runtime, connector, or clean-machine tests has passed merely because it is listed here. Root agent guidelines and instruction-only workflow prompts are supplied; they support manual work without proving the runtime.

## 1. Product assessment

**Promising after narrowing.** The useful product is a reusable CMO operating loop around the owner's existing Codex workflow. Its advantage is persistent business context, decisions, completed artifacts, and controlled execution without a separate reasoning service.

The first adopter is a Codex-using owner with a concrete business and limited marketing time. A release must prove it helps an unrelated new owner, rather than relying on its author's products, assets, account setup, or conversation memory. Broad hosted agency administration and proprietary predictive models are distractions from that test.

There is no required paid business model for the framework. Optional services can still create cost. The initial investment must be justified by time saved, better decisions, and qualified customer outcomes; open source does not make connector maintenance free.

## 2. Three releases and seven implementation stages

The release slices R1/R2/R3 match the PRD. The seven stages below are dependencies within those slices; they are not seven independently promised product launches.

| Stage | Release | Deliverable | Exit evidence |
| --- | --- | --- | --- |
| S0 Contract/fixtures | R1 | Generic folder/schema/state contracts, source/private boundaries, synthetic business, acceptance fixtures | No author coupling or implied executable status |
| S1 Bootstrap/state | R1 | Pinned runtime/lockfile, doctor/setup, brand import, SQLite versions, snapshot/export, focused project guidance | Clean install and no-credential example on declared platforms |
| S2 CMO loop | R1 | Goal/evidence/diagnosis/opportunities, secondary-research records, fresh strategy, distinct concepts, bounded critique, campaign/export, observation/learning, resume brief | Unrelated business completes a supervised manual cycle; evidence and critique remain distinct |
| S3 Review/lifecycle | R1 | Exact versions/reviews, scoped exports, idempotent metrics, backup/restore/migration, private release audit | R1 acceptance matrix passes, with restore suspended |
| S4 One execution path | R2 | Secret-store/owner trust, first official adapter, manual/API closure, attempts/reconciliation, worker lifecycle | Approved account test plus fault/expiry/identity tests |
| S5 Delegation | R2 | Independent preparation/execution, notices, bounded Autopilot, recurring-task ownership, safe handover | Supervised enrolled-brand cycle and all R2 fault cases |
| S6 Expansion | R3 | Selected modules/connectors/design capabilities and optional remote/paid execution | Business case and new capability contracts tested separately |

An indicative R1 build/pilot can take four to six focused weeks; R2 depends on provider access, notice/trust choices, and actual operating results. These are estimates, not deadlines. Do not wait for broad API approval to produce usable R1 work.

## 3. Implementation epics

| Epic | Requirements | Build now | Avoid until needed |
| --- | --- | --- | --- |
| Bootstrap/brand packages | FR-01–03, FR-20–21, FR-24 | Generic workflow entry, package schema, diffs, identities, snapshots/private boundaries | Personal setup dependencies, hosted signup |
| CMO strategy | FR-04–08 | Evidence, diagnosis, opportunity decisions, strategy/campaign contracts | Proprietary scoring model or automatic confidence inflation |
| Research/creative critique | FR-25–28 | Source/corpus/evaluation versions and lineage, existing Codex tools, transparent coding/rubrics | Custom crawler, survey/panel system, paid judge, uncalibrated demand prediction |
| Production/editorial | FR-09–11 | Complete manual packs, real proof, editable templates, feedback/lineage | Full general-purpose design/video suite |
| Measurement/learning | FR-16–18 | Manual imports, metric definitions/corrections, product feedback, decisions | Universal person-level attribution or custom CRM |
| Authority/resources | FR-12, FR-19 | Exact review records, trusted execution grants, capacity/cost reservations | Shared enterprise roles and blanket autonomous authority |
| Delivery/adapters | FR-13–15, FR-22 | Manual adapter, one verified publisher, recovery and owned worker | Twelve unverified connectors or compulsory cloud stack |
| Business expansion | FR-23 | Useful module briefs/output contracts | Actual CMS/email/store/ad writes without commissioning |

Write meaningful tests before implementing each invariant. Use synthetic fixtures and sanitized provider examples, then an explicitly approved real-account commissioning test for behavior that fixtures cannot establish.

## 4. Cost and effort model

No separate required model API. Codex subscription capacity, included tools, computer availability, operator attention, optional services, and maintenance are all finite.

| Cost | Initial requirement | Decision rule |
| --- | --- | --- |
| Separate LLM service | None | No automatic paid fallback when Codex is unavailable |
| Local runtime/SQLite | Required for R1 | No recurring software service; machine/maintenance still cost time/resources |
| Existing selected assets/templates | Preferred | Ask for genuine proof; never fabricate customer evidence to avoid capture work |
| Research/media tools | Capability-dependent | Use available tools; disclose gaps; quote a paid alternative before selection |
| Public media hosting | Some API delivery formats | Reuse a verified owner-approved route or choose a separately costed service |
| Notice delivery | R2 Autopilot | Require a working scoped route; no assumed free email sender |
| Social/API requests | Connector-dependent | Verify action-specific rates and reserve costs |
| Remote worker | Optional | Justify against actual local uptime failures |
| Ads | Excluded from initial execution | Separate ad-account budget/authority and controls |

Cash-minimal R1 target: no new recurring service commitments. This is a design target, not a guarantee that an owner's chosen optional tool is free. New installations start with zero billable execution authority, not an inherited dollar ceiling. The owner chooses budgets during commissioning.

```text
Recurring cash = selected fixed services + metered operations + optional media/ad spend
Effective cost = recurring cash + maintenance hours × operator time value
Net operating value = effort avoided + conservatively supported business contribution - effective cost
```

Do not count every sale as marketing contribution. When attribution is unavailable, use effort and learning value honestly. Portfolio planning budgets attention and cash across brands; adding a brand does not multiply production automatically.

## 5. Validation program

Use three synthetic business classes: a local service with no assets/accounts, a prelaunch software tool with release limits, and an established product with exposure but weak conversion. Add a fourth arbitrary business in the acceptance run without changing code.

R1 validation tests the folder contract, context freshness, diagnosis, campaign/export completeness, ownership/review, measurement imports, fresh-chat recovery, privacy packaging, and suspended export/restore. R2 adds actual account identity, worker lifecycle, notice, ambiguous writes, mirror/manual crossover, cost races, sleep/DST, and handover.

Research/critique fixtures add abstract-only access, duplicated evidence, contrary findings, ambiguous attribute language, rare issues, invented market prevalence, paraphrase diversity, irrelevant novelty, placement mismatch, position-sensitive judges, same-model correlation, source corrections, and causal overclaims. Prompt walkthroughs establish only instruction coverage; implemented validation and real behavior need their own tests. No new surveys, interviews, recruitment, or synthetic consumer panels.

Owner visual acceptance remains necessary for creative output. No Playwright or iOS compilation is required by the framework's default verification path. Optional product-engineering work is separately scoped.

[Acceptance suite](acceptance.md) maps each scenario to requirements and release slices.

## 6. Failure map

Likelihood/severity are planning judgments.

| Failure | Likelihood | Severity | Early warning | Response |
| --- | --- | --- | --- | --- |
| CMO becomes a generic post factory | High | High | Every diagnosis recommends more content | Test destination/research/wait scenarios; prioritize actual bottleneck |
| New owner cannot reproduce setup | High | High | Hidden account/path/tool assumptions | Clean-machine gates and pinned dependencies |
| Brand folder aliases another business | Medium | High | Duplicate identity/path bindings | Explicit rename/fork handling and uniqueness checks |
| Poor old strategy becomes the default | High | High | New plan echoes supplied claims without review | Fresh mode and historical-unreviewed classification |
| Generated personas are mistaken for research | Medium | High | No source-backed audience evidence | Separate internal critique from observations; prohibit synthetic market metrics |
| Research is cited outside its studied context | High | High | Story/judge/service effects become sales forecasts | Record design/outcome/applicability limits and counterevidence |
| A judge rewards familiar or first-presented copy | High | Medium | Order reversal changes rank; style beats proof | Factual gates, neutral labels, reverse-order comparison, abstention |
| Facts become stale before publication | High | High | Price/release changes not propagated | Dependency invalidation and eligibility checks |
| Copied/restored state republishes work | Medium | High | Pending queue resumes on another machine | Suspended imports, reconciliation, explicit handover |
| Private data enters public repository | Medium | High | Real folders/staged artifacts in release | Actual ignore rules plus tracked/package audit |
| Provider approval blocks execution | High | Medium | Unresolved permissions or account type | Complete manual output; fewer connectors |
| Remote timeout leads to duplicates | Medium | High | Unknown result treated as failure | Stop-and-reconcile, never blind retry |
| Human/API delivery paths collide | Medium | High | Export already posted during retry | Manual closure and competing-path hold |
| Local uptime or Codex limits interrupt work | High | Medium | Overdue queue or unfinished reasoning | Durable partial state, grace/expiry, optional remote delivery only if justified |
| Sparse outcomes create false winners | High | High | No denominator/comparable window | Inconclusive/wait decision and better tests |
| Tools/reads cost more than useful value | Medium | High | Billable loops grow without decisions | Quotes, atomic reservations, attention/cash stop rules |
| Maintenance erases founder time savings | High | High | Connector support exceeds avoided work | Simplify/drop low-value adapters |
| Context or secrets cross brands | Medium | High | Wrong link/account/asset in artifact | Scoped reads, IDs, foreign keys, secret-store boundary |
| Inbox/lifecycle sends inappropriate promises | Medium | High | Unreviewed claims/refunds/advice | Draft-first, escalations, scoped reply authority |
| Large scope delays first useful campaign | High | High | Infrastructure with no complete pack | R1 manual-value gate before R2 expansion |

## 7. Stop and narrow criteria

- Any unauthorized write/spend or duplicate delivery suspends affected execution until cause and regression coverage are resolved.
- Unsupported material claims block their dependency path; fresh truth comes before higher volume.
- If a new owner cannot onboard an unrelated brand without a maintainer, R1 is not ready.
- If four recurring cycles do not reduce review plus maintenance against the operator's recorded baseline, remove the least useful machinery.
- If fewer than half of twenty reviewed concepts/production briefs are usable without major factual or structural rework, improve diagnosis/context/templates before increasing output. This is a proposed workflow threshold, not a marketing statistic.
- When qualified exposure is missing, revise distribution; when qualified exposure exists but useful response does not, investigate proposition/destination/fit. Do not conflate the two.
- Stop an optional service at its approved boundary unless a recorded cost/benefit review supports continuation. A new project/month does not reset finite authorizations automatically.

## 8. Open-source release contract

Original framework content uses the [MIT License](../LICENSE). Document dependency/source terms before incorporating third-party material; a link or citation does not relicense its target. Ship only an allowlisted framework, schemas, generic workflows, docs, templates, and synthetic fixtures. Inspect the final archive and tracked history, not only `.gitignore`.

Require reproducible setup on declared OS/runtime versions, exact command/docs parity, fixture/export/restore tests, private-data/secret scan, feature status, supported adapter matrix, migration/rollback procedure, contribution/security reporting guidance, and an explicit unsupported/deferred list.

The release archive must not include real brand workspaces, credentials, raw messages, metrics, screenshots, personal home paths, author account IDs, grants, active schedules, or private archives. Publication requires an explicit owner request and an audit of the actual release candidate.

## 9. Review protocol

Run two distinct design passes before implementation: an independent challenge of product/architecture/new-user assumptions, then adversarial rereading of the revised contracts and acceptance coverage. Record material gaps, resolutions, remaining uncertainty, and test mapping. Repeat those reviews when scope or execution authority changes materially.

Optional specialist sub-agents improve critique and evidence coverage. They do not replace a single authoritative decision or required real-system testing. [Design audit](reviews/design-audit.md)
