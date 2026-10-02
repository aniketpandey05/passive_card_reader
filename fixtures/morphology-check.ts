/**
 * Precision and recall for the word-part analyzer.
 *
 *   npm run check:parts
 *
 * The negative cases matter more than the positive ones: a missing breakdown
 * costs a hint, a wrong one teaches a false etymology.
 */
import { analyze, describe } from '../src/lib/morphology.ts'
import { STARTER_PACK } from '../src/data/starter.ts'

/** Words that should break down, with a fragment the output must contain. */
const SHOULD_WORK: [string, string][] = [
  ['benevolent', 'wish'],
  ['circumspect', 'look'],
  ['credulous', 'believe'],
  ['elucidate', 'light'],
  ['ambivalent', 'strength'],
  ['aesthetic', 'feeling'],
  ['cryptic', 'hidden'],
  ['digress', 'step'],
  ['complacent', 'peace'],
  ['benediction', 'say'],
  ['introspect', 'look'],
  ['misanthropy', 'human'],
  ['monologue', 'word'],
  ['pseudonym', 'name'],
  ['retrospective', 'look'],
  ['transcribe', 'write'],
  ['incredible', 'believe'],
  ['extract', 'pull'],
  ['biology', 'life'],
  ['chronology', 'time'],
  ['democracy', 'people'],
  ['philanthropy', 'love'],
  ['subvert', 'turn'],
  ['convene', 'come'],
  ['dictionary', 'say'],
]

/** Words that must NOT get a breakdown: plain English, or coincidental parts. */
const SHOULD_STAY_QUIET = [
  'person',
  'water',
  'mother',
  'window',
  'garden',
  'morning',
  'brother',
  'shoulder',
  'hundred',
  'yesterday',
  'kitchen',
  'thunder',
  'blanket',
  'summer',
  'finger',
  'basket',
  'candle',
  'silver',
  'number',
  'winter',
  'sister',
  'daughter',
  'husband',
  'friendly',
  'careful',
  'happily',
]

let truePositives = 0
const wrongGloss: string[] = []
const missed: string[] = []

for (const [word, expected] of SHOULD_WORK) {
  const got = analyze(word)
  if (!got) {
    missed.push(word)
    continue
  }
  const line = describe(got)
  if (line.includes(expected)) truePositives++
  else wrongGloss.push(`${word}: expected "${expected}" in -> ${line}`)
}

const falsePositives: string[] = []
for (const word of SHOULD_STAY_QUIET) {
  const got = analyze(word)
  if (got) falsePositives.push(`${word} -> ${describe(got)}`)
}

console.log(`\npositives: ${truePositives}/${SHOULD_WORK.length} correct`)
if (missed.length) console.log(`  no breakdown offered: ${missed.join(', ')}`)
for (const w of wrongGloss) console.log(`  WRONG ${w}`)

console.log(`\nnegatives: ${SHOULD_STAY_QUIET.length - falsePositives.length}/${SHOULD_STAY_QUIET.length} correctly stayed quiet`)
for (const f of falsePositives) console.log(`  FALSE POSITIVE ${f}`)

// How much of the real deck gets a hint.
const covered = STARTER_PACK.filter((e) => analyze(e.word))
console.log(`\nstarter pack: ${covered.length}/${STARTER_PACK.length} words get a breakdown`)
for (const e of covered.slice(0, 12)) console.log(`  ${e.word.padEnd(14)} ${describe(analyze(e.word)!)}`)
