# CMO workflow prompts

`AGENTS.md` routes the agent to the relevant procedure. Execution and records go through the engine (`npm run engine -- --help`). These procedures cover the judgment around it.

| Prompt | Job |
| --- | --- |
| [Session start](session-start.md) | Recover state from the engine and pick the work |
| [Daily run](daily-run.md) | Reconcile, read results, work the agenda and the running bets' tasks, brief |
| [Weekly review](weekly-review.md) | Check metric trust, close due bets, find the constraint, start at most one bet |
| [Team](team.md) | Specialist agent roles and the rules every role follows |
| [Distribution](distribution.md) | Work out how to reach the audience for any proposal, from comparables and venues |
| [AI visibility](ai-visibility.md) | Get recommended by AI assistants, measured as mention rate |
| [Onboard](onboard.md) | Add an unrelated business from a private folder |
| [Strategy](strategy.md) | Diagnose the constraint and choose the lever |
| [Research](research.md) | Investigate the web, appraise sources, and build traceable secondary evidence |
| [Validation](validation.md) | Resolve uncertainty without forcing a campaign |
| [Campaign](campaign.md) | Produce complete, connected deliverables |
| [Concept evaluation](concept-evaluation.md) | Critique artifacts with calibrated limits and bias checks |
| [Review](review.md) | Challenge business fit, truth, and readiness |
| [Learn](learn.md) | Turn observed results into a decision |
| [Response format](response-format.md) | Keep operator updates concise and customer copy self-contained |

Prompts never grant account access or authorize publishing or spending. Only the owner's `grant` or `approve`, typed in their own terminal, does.
