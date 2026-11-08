# Onboard a business from a folder

## Inputs

Selected private business folder and any directly supplied business goals/context. Follow `docs/brand-workspaces.md` for package identity, privacy, and lifecycle rules.

## Procedure

1. Inventory selected files and classify product/service facts, media/proof, voice preferences, constraints, historical marketing, and unknowns. Preserve originals.
2. Establish minimum context: what is offered, for whom/where, current availability, desired business outcome, conversion destination, and important constraints. Ask only essential missing questions; unknown optional fields remain unknown.
3. Create `engine.json` with the business name, confirmed goal, and only the channels and metrics the owner actually has. A metric needs its analytics project's real time zone; ask rather than assume. Credentials go into the Keychain by the owner (`npm run engine -- --help` names the commands); never into files or chat. Add a `funnel`: the stages from first contact to return use, one metric each, and a target daily average agreed with the owner (metrics without an API use `"provider": "manual"` and are recorded with `observe`). Then record the first customer situations and 3 to 5 competitors (`situation add`, `competitor add`), and start with a measurement bet if the north star has never been verified.
4. Default to fresh strategy. Existing marketing is historical-unreviewed input only if deliberately supplied. Identify what appears useful, contradicted, obsolete, or untested; do not inherit audience, cadence, channel, or voice approval.
5. Research current customers/problems/alternatives with a bounded brief when tools permit. Keep owner input, independent evidence, interpretation, and synthetic fixture data distinct.
6. Propose a diagnosis and a small set of strategy choices. Select a first campaign or validation plan based on the bottleneck, proof, access, and available attention.
7. Run `npm run engine -- brief --brand <business>` to generate `index.md`, the compact operating brief. File complete reviewable first work in its appropriate research/work location. List exact missing assets, measurement, or account tasks without treating them as completed. Create only useful records; the owner need not design the filing structure.

## Deliverables

Source inventory; known facts/unknowns; goal/conversion map; diagnosis/counterevidence; initial strategy and prioritized work; complete campaign or validation plan; compact resume brief.

## Review

Test whether this onboarding would work for an unrelated service business with no social account or analytics. Reject invented facts, forced software/app fields, inherited authority, hidden external paths, and new recurring costs.
