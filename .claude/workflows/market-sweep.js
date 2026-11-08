export const meta = {
  name: 'market-sweep',
  description: 'Monthly customer, competitor and AI-visibility sweep for one brand; records signals and gaps in the engine',
  whenToUse: 'Monthly per brand, or when the agenda says competitor pages or the AI-visibility check are due. args: { brand, date }',
  phases: [
    { title: 'Gather', detail: 'competitor watcher, customer researcher, user analyst and visibility auditor in parallel' },
    { title: 'Gaps', detail: 'gap finder turns the new signals into positioning and channel gaps' },
    { title: 'Critic', detail: 'completeness critic names what the sweep missed' },
  ],
}

// Roles are defined in prompts/team.md; each agent reads its own section.
// Every write goes through the engine CLI with --by <role>, so the brand's
// records show who found what. Nothing public is sent by any agent here.
const brand = args && args.brand
const date = args && args.date
if (!brand || !date) throw new Error('Pass args: { brand: "<folder under brands/>", date: "YYYY-MM-DD" }')

const engine = `npm run engine -- <command> --brand ${brand}`
const common = `You are one specialist on a marketing team for the brand "${brand}" (folder brands/${brand}/). Today is ${date}.
Read your role in prompts/team.md and follow its rules. Start with \`${engine.replace('<command>', 'market')}\` and \`${engine.replace('<command>', 'situation list')}\` to see what is already recorded, and do not record duplicates.
Write only through the engine CLI (${engine}) with --by set to your role name. Every public fact needs its https source.`

const REPORT = {
  type: 'object',
  properties: {
    recorded: { type: 'array', items: { type: 'string' }, description: 'engine ids and one-line summaries of what you recorded' },
    findings: { type: 'array', items: { type: 'string' }, description: 'what matters for the next bet, most important first' },
    problems: { type: 'array', items: { type: 'string' }, description: 'anything that failed, looked wrong, or could not be checked' },
  },
  required: ['recorded', 'findings', 'problems'],
}

const ROLES = [
  { role: 'competitor-watcher', task: 'Run `watch` for every recorded competitor, read each diff, and record real changes and the most repeated review complaints. If fewer than 3 competitors are recorded, add the ones customers would choose instead, with their homepage and pricing pages.' },
  { role: 'customer-researcher', task: 'For each recorded situation, find 3 to 8 fresh public descriptions of the problem in customers\' own words and record them as signals. Prefer recent sources.' },
  { role: 'user-analyst', task: 'Read the funnel (`funnel`) and recent observations. Record behavior signals for anything real users\' numbers show. Check whether each funnel metric can be trusted and say how you checked; record `trust` only when you actually verified or disproved it.' },
  { role: 'visibility-auditor', task: 'Use the brand\'s research/visibility-prompts.md (create it with 5 to 10 unbranded specific-need prompts if missing). Run each prompt on every assistant you can reach, recording each run with `visibility record`; then run `visibility report`.' },
]

phase('Gather')
// A barrier is right here: the gap finder needs every new signal at once.
const gathered = await parallel(ROLES.map((r) => () =>
  agent(`${common}\n\nYour role: ${r.role}.\n${r.task}`, { label: r.role, phase: 'Gather', schema: REPORT })
    .then((report) => ({ role: r.role, report }))))
const reports = gathered.filter(Boolean).filter((g) => g.report)
const missing = ROLES.map((r) => r.role).filter((role) => !reports.some((g) => g.role === role))
if (missing.length) log(`No report from: ${missing.join(', ')}`)

phase('Gaps')
const gaps = await agent(
  `${common}\n\nYour role: gap-finder. The other specialists just reported:\n${JSON.stringify(reports, null, 2)}\n\nRun \`signal list\` and \`gap list\`. Record new positioning or channel gaps that the signals support (each cites its signal ids). Do not restate existing gaps.`,
  { label: 'gap-finder', phase: 'Gaps', schema: REPORT })

phase('Critic')
const critic = await agent(
  `${common}\n\nYour role: completeness critic. Do not record anything. Given these reports:\n${JSON.stringify({ reports, gaps }, null, 2)}\n\nName what this sweep missed or got wrong: a competitor not watched, a situation with no fresh evidence, a claim without a source, an assistant not checked, a metric trusted without a check. Be specific and brief.`,
  { label: 'critic', phase: 'Critic', schema: { type: 'object', properties: { missed: { type: 'array', items: { type: 'string' } } }, required: ['missed'] } })

return { brand, date, reports, gaps, missed: critic ? critic.missed : ['critic did not report'], silentRoles: missing }
