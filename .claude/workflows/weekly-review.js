export const meta = {
  name: 'weekly-review',
  description: 'Weekly bet review for one brand: analyst scores the funnel and bets, red team attacks each proposed bet',
  whenToUse: 'Once a week per brand, before the CMO closes, starts or proposes bets. args: { brand, date }',
  phases: [
    { title: 'Score', detail: 'analyst pulls metrics, checks trust, scores running bets' },
    { title: 'Red team', detail: 'one skeptic per proposed bet' },
  ],
}

// Produces the inputs for the CMO's weekly decisions. It never closes, starts
// or drops a bet itself: verdicts stay with the CMO, and the engine checks them
// against the numbers.
const brand = args && args.brand
const date = args && args.date
if (!brand || !date) throw new Error('Pass args: { brand: "<folder under brands/>", date: "YYYY-MM-DD" }')
const engine = `npm run engine -- <command> --brand ${brand}`

phase('Score')
const analysis = await agent(
  `You are the analyst on the marketing team for brand "${brand}" (brands/${brand}/), today ${date}. Read the analyst role in prompts/team.md.
Run \`${engine.replace('<command>', 'pull')}\`, then \`status\`, \`bet list --status running\` and \`bet list --status proposed\` (same CLI). For each funnel metric, say whether its numbers can be believed and how you know; record \`trust\` with --by analyst only for checks you actually made. For each running bet, report its score and whether it is due to close. Do not close or start bets.`,
  { label: 'analyst', phase: 'Score', schema: {
    type: 'object',
    properties: {
      funnel: { type: 'array', items: { type: 'string' } },
      dueToClose: { type: 'array', items: { type: 'object', properties: { bet: { type: 'string' }, score: { type: 'string' }, evidence: { type: 'array', items: { type: 'integer' } } }, required: ['bet', 'score', 'evidence'] } },
      proposed: { type: 'array', items: { type: 'object', properties: { bet: { type: 'string' }, title: { type: 'string' }, hypothesis: { type: 'string' } }, required: ['bet', 'title', 'hypothesis'] } },
      concerns: { type: 'array', items: { type: 'string' } },
    },
    required: ['funnel', 'dueToClose', 'proposed', 'concerns'],
  } })
if (!analysis) return { brand, date, error: 'analyst did not report' }

phase('Red team')
const limit = 5
if (analysis.proposed.length > limit) log(`Red-teaming the first ${limit} of ${analysis.proposed.length} proposed bets; the rest were not reviewed.`)
const attacks = await parallel(analysis.proposed.slice(0, limit).map((b) => () =>
  agent(`You are the red team for brand "${brand}" (brands/${brand}/), today ${date}. Read the red-team role in prompts/team.md.
Try to kill this proposed bet: ${JSON.stringify(b)}. Use \`${engine.replace('<command>', `bet show ${b.bet}`)}\`, the market records (\`market\`, \`signal list\`), and the web. Look for weak evidence, a competitor already doing it, platform rules or spam filters that would sink it, and a cheaper test that answers the same question. Default to "drop" when unsure.`,
    { label: `red-team ${b.bet}`, phase: 'Red team', schema: {
      type: 'object',
      properties: { bet: { type: 'string' }, recommendation: { type: 'string', enum: ['start', 'revise', 'drop'] }, strongestObjection: { type: 'string' }, cheaperTest: { type: 'string' } },
      required: ['bet', 'recommendation', 'strongestObjection', 'cheaperTest'],
    } })))

return { brand, date, analysis, redTeam: attacks.filter(Boolean) }
