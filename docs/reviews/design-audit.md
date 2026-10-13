# Design audit

Specification reviewed October 13, 2026. This record concerns design completeness; it does not certify unimplemented software or provider integrations.

## Review method

Use separate architecture, strategic-CMO, and clean-clone/acceptance perspectives. First identify failure counterexamples; revise the contracts; then challenge the revised pack in a second pass. Maintain one reconciled specification rather than several competing designs.

## Round 1: material findings and resolution

| Finding | Required correction | Resolution and acceptance evidence |
| --- | --- | --- |
| Product coupled to predetermined businesses | Generic owner/business contract and no author dependencies | PRD FR-01–03; T01–04, T11 |
| Folder onboarding was only an aspiration | Identity, schema, import/diff, rename/fork/remove/export rules | Brand workspace contract; T04–10 |
| Existing marketing could become inherited strategy | Fresh mode; historical material only by choice and critical review | FR-06; T33 |
| CMO started from content volume | Goal, diagnosis, opportunity choices, resource tradeoffs | FR-04–08; T12, T32–35 |
| Brand folders and database had unclear authority | Source inputs versus committed state versus explicit snapshot imports | Architecture sections 4–5; T05–06, T15 |
| Copy/restore could reactivate publication | Suspended imports, installation identity, reconciliation, explicit handover | FR-21; T10, T23–24, T40 |
| macOS assumptions undermined portability | Secret-store interface and tested-platform release target | FR-01, FR-19; T01–03, T26 |
| Private data could enter an open-source release | Actual ignore rules plus staged/history/package audits | FR-24; T09, T31 |
| Owner-trust bootstrap was incomplete | Local owner session; host-verifiable input or exact local review | FR-12; architecture section 7; T14–15 |
| Scheduler/connector lifecycle was underspecified | Owned service/timer operations and versioned capability contract | FR-21–22; T38–40 |
| Measurement reimports could change totals | Report/observation keys, corrections, units and missing-data states | FR-17; T20–22 |
| First usable release mixed with full automation | R1 manual CMO, R2 reliable automation, R3 expansion | PRD section 3; delivery stages and acceptance slices |
| Model/tool limits had no recovery behavior | Partial artifacts, capability fallback, no paid-model substitution | FR-19–20; T27–29 |
| Broad research needed a synthesis | Primary comparisons and explicit adopted/rejected mechanisms | Comparative research; strategy/operating contracts |

## Round 2

Independent architecture, CMO, and acceptance rereading found the following narrower gaps. The revised specification includes the listed corrections; final correction closure received a primary-editor consistency pass rather than an additional independent sign-off.

| Finding | Correction | Coverage |
| --- | --- | --- |
| Replacement strategy could leave old work running | Hold incompatible campaigns/deliveries/policies until retain/revise decision | FR-06; T33 |
| Validation was promised without a full contract | First-class question/method/evidence/tasks/authority/outcome/decision item | FR-08; T44 |
| End-to-end lineage was not directly tested | Backward and forward retrieval after fresh-chat recovery/export | T11, T36 |
| Attention budgeting could be prose only | Planning-window capacity, committed/remaining effort, and replanning | FR-07; T34 |
| Manual closure conflicted with R2-only labeling | FR-14 split into R1 manual records and R2 automated recovery | T18–19 |
| Raw copied identity could preserve execution | Nonexported host-secret/root binding and independent execution checkpoint | FR-21; T40 |
| Grants omitted action/resource/recipient scope | Typed action envelope validated above adapters | FR-12; T46 |
| Source edits could evade stored freshness flags | Rehash relevant dependencies or bounded fresh inventory before execution | FR-08; T47 |
| Local session security was mistaken for human provenance | Trusted owner-interaction adapter required only for R2; session/CSRF alone insufficient | FR-12; T50 |
| Lost computer could make recovery impossible | Provider access revocation/rotation, reconciliation, new enrollment and future authority | FR-21; T48 |
| Suspension/manual/blocked states were incomplete | Explicit recoverable states and orthogonal suspension preserving uncertainty | T16, T18, T30, T49 |
| Uninstall could accidentally publish a backlog | Stop new claims/planners first; wait only for in-flight work | T38 |
| Recovery targets lacked commissioning evidence | Declared backup/data-loss/retention/restore objectives before R2 | FR-21; T45 |
| Several requirements had nominal or missing test coverage | Add design/rights/rollback, editorial preferences, and optional-module cases | T41–43 |

## Supplied agent guidance

The root `AGENTS.md` provides the default CMO role, session-start routine, workflow routing, truth/authority/privacy rules, quality review, and concise communication. Ten focused prompts cover session start, onboarding, strategy, research, validation, campaigns, concept evaluation, review, learning, and formatting. They guide manual work now and explicitly distinguish unimplemented runtime/tools. The [research upgrade review](research-upgrade.md) covers the later evidence/protocol additions.

The [synthetic walkthrough](prompt-walkthrough.md) applies them to a service business without accounts/assets, ambiguous conversion evidence, and contradicted historical strategy. It is a prompt-contract exercise, not a software or marketing success test.

## Document validation

- Local Markdown links and code fences checked.
- Original specification: twenty-four requirement IDs and fifty unique acceptance IDs checked. The research upgrade extends this to twenty-eight and sixty-six; its validation is recorded separately.
- Every requirement has explicit scenario references.
- Public docs/prompts/templates checked for author-specific brands, home paths, accounts, and inherited budget dependencies.
- Git ignore behavior tested in an isolated temporary repository for private roots/secrets and public examples/guidance.

These checks passed. No runtime, platform, publishing, restoration, or business-outcome tests were represented as completed.

## Evidence boundaries

Current repository checks can validate document links, references, requirement/test coverage, public-path hygiene, synthetic examples, and ignore behavior. Runtime correctness, supported-platform setup, connector permissions, notice transport, and real campaign effectiveness require future implementation/pilot evidence. The initial public framework uses MIT; dependency/source terms remain part of later release reviews.
