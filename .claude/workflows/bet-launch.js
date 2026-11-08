export const meta = {
  name: 'bet-launch',
  description: 'Creative work for one running bet: competing concepts, critic panel, voice edit; returns copy ready for owner approval',
  whenToUse: 'When a running bet needs public copy (posts, listings, pitches, page text). args: { brand, bet, date, asset }',
  phases: [
    { title: 'Concepts', detail: 'three premises developed independently' },
    { title: 'Critique', detail: 'two critics score every concept' },
    { title: 'Edit', detail: 'voice editor finishes the winner' },
  ],
}

// The output is a draft for the owner to read word for word. Nothing here
// proposes, approves or publishes anything.
const brand = args && args.brand
const bet = args && args.bet
const date = args && args.date
const asset = (args && args.asset) || 'the copy this bet needs'
if (!brand || !bet || !date) throw new Error('Pass args: { brand, bet, date, asset? }')
const context = `Brand "${brand}" (brands/${brand}/), today ${date}. The bet: run \`npm run engine -- bet show ${bet} --brand ${brand}\`, and read its situation and gap with \`situation list\`, \`signal list --situation <id>\` and \`gap list\`. Read brands/${brand}/brand.md for verified product facts and voice. Deliverable: ${asset}.`

const PREMISES = [
  'problem-first: open on the exact moment the customer is in, in their own words from the signals',
  'proof-first: open on something checkable the product does, shown not claimed',
  'contrarian: open on a common belief in the category the signals suggest is wrong',
]
const CONCEPT = { type: 'object', properties: { premise: { type: 'string' }, copy: { type: 'string' }, claims: { type: 'array', items: { type: 'string' } } }, required: ['premise', 'copy', 'claims'] }

phase('Concepts')
const concepts = (await parallel(PREMISES.map((p, i) => () =>
  agent(`${context}\nYou are on the concept team (prompts/team.md). Develop ONE concept from this premise: ${p}. List every factual claim the copy makes.`,
    { label: `concept ${i + 1}`, phase: 'Concepts', schema: CONCEPT })))).filter(Boolean)
if (!concepts.length) return { brand, bet, error: 'no concepts produced' }

phase('Critique')
const SCORES = { type: 'object', properties: { scores: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, relevance: { type: 'integer' }, truth: { type: 'integer' }, distinct: { type: 'integer' }, nextStep: { type: 'integer' }, against: { type: 'string' } }, required: ['index', 'relevance', 'truth', 'distinct', 'nextStep', 'against'] } } }, required: ['scores'] }
const panels = (await parallel([0, 1].map((n) => () =>
  agent(`${context}\nYou are critic ${n + 1} (prompts/team.md). Score each concept 1-5 on relevance to the situation, truth (every claim checkable against brand.md or a source; any unverifiable claim scores 1), distinctness from competitors' wording, and clarity of the next step. Argue against the strongest one. Concepts (index = position):\n${JSON.stringify(concepts, null, 2)}`,
    { label: `critic ${n + 1}`, phase: 'Critique', schema: SCORES })))).filter(Boolean)
// Both critics must score every concept; a missing score could otherwise
// let an unreviewed concept beat one that failed the truth check.
if (panels.length < 2) return { brand, bet, concepts, panels, error: 'fewer than two critics reported; nothing was chosen' }
const complete = concepts.map((_, i) => panels.every((p) => p.scores.some((x) => x.index === i)))
const totals = concepts.map((_, i) => {
  if (!complete[i]) return -1000
  return panels.reduce((sum, p) => {
    const s = p.scores.find((x) => x.index === i)
    // Truth is a gate, not a weight: a concept with an unverifiable claim cannot win.
    return sum + (s.truth <= 1 ? -100 : s.relevance + s.truth + s.distinct + s.nextStep)
  }, 0)
})
const winner = totals.indexOf(Math.max(...totals))
if (totals[winner] < 0) return { brand, bet, concepts, panels, error: 'no concept was fully scored and passed the truth check' }

phase('Edit')
const final = await agent(`${context}\nYou are the voice editor (prompts/team.md). Finish this concept so it reads like a person wrote it. Run \`npm run engine -- lint-copy --text "<copy>" --brand ${brand}\` and fix every flag, then reread for rhythm. Keep only claims that are verified in brand.md or a cited source. The critics' objections to address:\n${JSON.stringify(panels.map((p) => p.scores.find((s) => s.index === winner)), null, 2)}\nConcept:\n${JSON.stringify(concepts[winner], null, 2)}`,
  { label: 'voice editor', phase: 'Edit', schema: { type: 'object', properties: { copy: { type: 'string' }, lintClean: { type: 'boolean' }, claims: { type: 'array', items: { type: 'string' } } }, required: ['copy', 'lintClean', 'claims'] } })

return { brand, bet, winner: concepts[winner].premise, final, runnersUp: concepts.filter((_, i) => i !== winner).map((c) => c.premise), totals }
