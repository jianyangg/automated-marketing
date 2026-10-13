# Comparative research: mechanisms for a reusable CMO

Reviewed October 13, 2026. Scope: public primary product/help/developer documentation. These sources are operational design comparisons, not the scientific evidence base; see the separate evidence library. These are documented mechanisms and vendor claims, not authenticated product tests or evidence of guaranteed marketing lift. The design implications below are original framework decisions.

## 1. Systems examined

| System | Documented mechanism | Evidence | Framework decision |
| --- | --- | --- | --- |
| Blaze | Separate automatic generation, publishing, and approval controls; rejected work remains editable | [Autopost controls](https://help.blaze.ai/en/articles/12515715-turn-automatic-content-publishing-on-or-off), [Approvals](https://help.blaze.ai/en/articles/12998604-how-to-use-approvals) | Preparation and execution need separate state and pause semantics |
| Ocoya | Assistant tools expose brands, profiles, drafts/calendar, context libraries, and workflows | [MCP feature documentation](https://www.ocoya.com/features/mcp) | Use brand-scoped intent tools, not raw provider APIs in prompts |
| Buffer | An idea/creation space, AI-assisted adaptation, scheduling, and data access through API/MCP | [Current feature overview](https://buffer.com/resources/buffer-features/), [AI help](https://support.buffer.com/articles/using-buffers-ai-assistant-qbBulfw9sn) | Preserve idea-to-artifact lineage and allow useful incremental assistance |
| Jasper | Distinct voice, knowledge, audiences, style/visual standards, and product truth | [Jasper IQ](https://help.jasper.ai/hc/en-us/articles/55085068545819-Jasper-IQ), [Product IQ](https://help.jasper.ai/hc/en-us/articles/55084686400539-Product-IQ) | Compose explicit context; do not hide everything in one brand prompt |
| HubSpot | Customer/brand foundations and a strategy-to-adaptation-to-distribution-to-learning loop | [Loop Marketing](https://knowledge.hubspot.com/campaigns/understand-loop-marketing?product=breeze) | Begin with objective and diagnosis, then campaign and learning |
| AirOps | Opportunity types include creating, refreshing, outreach, and community work | [Opportunities docs](https://docs.airops.com/insights/opportunities) | A CMO chooses an action class; new content is only one option |
| Postiz | Open-source publishing product with self-hosting, provider configuration, API, CLI, and agent access | [Overview](https://docs.postiz.com/introduction), [Self-hosting](https://docs.postiz.com/installation/docker-compose), [Repository](https://github.com/gitroomhq/postiz-app) | Keep publishing replaceable; assess reuse/integration before building a broad connector fleet |

## 2. Operational mechanisms

### Strategy and product truth are different records

Jasper Product IQ describes structured product claims/specifications, source-assisted draft fields, owner review, and recurring freshness checks; unavailable source attributes remain empty. Its Research Agent accepts a bounded objective, scope, timeframe, and source controls and produces cited material. Its campaign agent adapts a shared brief into multiple types of copy; that is not evidence of universal automatic publication. [Product IQ](https://help.jasper.ai/hc/en-us/articles/55084686400539-Product-IQ), [Research Agent](https://www.jasper.ai/agents/research), [Campaign Agent](https://www.jasper.ai/agents/multi-channel-campaign)

**Design implication:** verified price, experimental positioning, desired voice, and authority must be different records. Every artifact should expose the active context revisions. An inferred persuasive benefit cannot silently become a product fact.

### The CMO must close a decision loop

HubSpot's Loop documentation starts with customer/brand/data foundations and connects an objective, campaign story, core asset, and timed channel plan to adaptation, amplification, and evaluation. Its campaign reports distinguish goal progress, lifecycle/journeys, asset performance, costs, and attribution views. Availability depends on products/plans; the framework is not evidence of a free integrated implementation. [Loop Marketing](https://knowledge.hubspot.com/campaigns/understand-loop-marketing?product=breeze), [Campaign performance](https://knowledge.hubspot.com/campaigns/analyze-campaign-performance)

**Design implication:** a campaign needs a conversion destination and observation plan before distribution. The operating record must distinguish editorial acceptance, operational completion, and market outcomes. A weekly calendar is only one possible output of strategy.

### Opportunity selection precedes production

AirOps documents opportunity categories beyond new content, and its platform describes persistent review/version history and connections between opportunities, changes, and outcomes. These claims do not prove causal revenue lift. [Opportunities](https://docs.airops.com/insights/opportunities), [Platform](https://www.airops.com/platform)

**Design implication:** keep an opportunity backlog with evidence, effort, cash, attention, and a next validation step. A traffic-rich but conversion-poor business can receive destination work; an uncertain business can receive research or a wait decision.

### Autonomy is a set of controls

Blaze's help distinguishes stopping creation from stopping automatic publication and documents an approval queue. The exact effect on already scheduled work matters; a single ambiguous “Autopilot off” label is not enough. [Generation/publishing controls](https://help.blaze.ai/en/articles/12515715-turn-automatic-content-publishing-on-or-off), [Approvals](https://help.blaze.ai/en/articles/12998604-how-to-use-approvals)

**Design implication:** use separate preparation, queued execution, and live-campaign controls with a concrete preview of effects. There is no plan tier that removes essential approval controls from this framework.

### Assistant access can be a thin interface

Ocoya documents brand/profile/context/workflow operations over MCP. Buffer's current overview describes assistant access to its data and a public API, while its AI help focuses on drafting and adaptation. Neither is proof that an assistant can bypass product permissions or do every marketing job. [Ocoya MCP](https://www.ocoya.com/features/mcp), [Buffer features](https://buffer.com/resources/buffer-features/), [Buffer AI help](https://support.buffer.com/articles/using-buffers-ai-assistant-qbBulfw9sn)

**Design implication:** Codex does not need another chat frontend. A stable local tool contract can call a manual adapter, direct provider integration, or separately selected publishing service. The conversational interface and execution backend remain independent.

### Open source does not eliminate operational dependencies

Postiz documents self-hosting and provider setup alongside agent/API access. Its repository identifies an AGPL-3.0 license. Self-hosting still needs runtime services, credentials, upgrades, and actual provider access. [Self-hosting](https://docs.postiz.com/installation/docker-compose), [Repository](https://github.com/gitroomhq/postiz-app)

**Design implication:** compare an optional publishing-backend adapter with direct connector work using maintenance and deployment cost. Do not require Postiz's stack or copy its implementation into this project by default. Any actual dependency/source reuse needs an explicit license and maintenance decision.

## 3. Synthesis: what the framework adopts

| Mechanism | Placement | Proof it works |
| --- | --- | --- |
| Inspectable business context | R1 | Unknown facts remain unknown; active context is traceable |
| Goal/diagnosis/opportunity loop | R1 | A non-content action can outrank more posts |
| Shared campaign narrative and reuse | R1 | Core asset and adaptations retain sources and versions |
| Fresh onboarding | R1 | Unrelated business folder works without old strategy or author data |
| Bounded review and learned preferences | R1 | One-off edit and persistent rule remain distinct |
| Replaceable execution interface | R1/R2 | Manual export works before one commissioned publisher |
| Separated preparation/execution | R2 | Pause, notice, retry, and authority tests pass |
| Query-backed learning | R1/R2 | Observations/calculations/decisions remain distinguishable |
| Optional specialized modules | R3 writes; R1 briefs | Business type selects useful capability rather than inheriting all modules |

## 4. What not to import

Do not adopt vendor assertions about optimal cadence, best posting time, automatic improvement, revenue causality, unlimited capacity, or setup speed as framework guarantees. Do not infer current availability from an old launch article or inaccessible search result. Do not replicate commercial credits, customer lock-in, mandatory cloud signup, or proprietary model training merely because a reference product has them.

The distinct product thesis is a reusable local CMO operating system: business folder in, grounded decisions and complete work out, with durable learning and controlled execution.
