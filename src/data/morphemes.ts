/**
 * Latin and Greek word parts, for breaking a headword into its pieces.
 *
 * This is deliberately a table plus an analyzer rather than per-word
 * etymology: a table works on whatever a user imports, where hand-written
 * etymology only ever covers the words someone thought to write it for.
 *
 * Format per line: form | language | meaning
 * Roots list their main spelling variants separated by "/", so one entry
 * covers "duc" and "duct".
 */

export type Lang = 'Latin' | 'Greek' | 'Old English' | 'French'

export interface Morpheme {
  form: string
  lang: Lang
  gloss: string
}

const PREFIXES = `
a|Greek|not, without
an|Greek|not, without
ab|Latin|away from
ad|Latin|toward
ambi|Latin|both, around
amphi|Greek|both, around
ana|Greek|up, back
ante|Latin|before
anti|Greek|against
apo|Greek|away from
auto|Greek|self
bene|Latin|well, good
bi|Latin|two
cata|Greek|down
circum|Latin|around
co|Latin|together with
col|Latin|together with
com|Latin|together with
con|Latin|together with
contra|Latin|against
cor|Latin|together with
de|Latin|down, away, off
di|Latin|apart, away
dia|Greek|through, across
dis|Latin|apart, not
dys|Greek|bad, difficult
e|Latin|out of
ec|Greek|out of
ecto|Greek|outside
en|Greek|in, within
endo|Greek|inside
epi|Greek|upon, over
eu|Greek|good, well
ex|Latin|out of, former
extra|Latin|beyond
hemi|Greek|half
homo|Greek|same
hyper|Greek|over, excessive
hypo|Greek|under, too little
in|Latin|not, or into
inter|Latin|between
intra|Latin|within
intro|Latin|inward
macro|Greek|large
mal|Latin|bad
meta|Greek|beyond, change
micro|Greek|small
mis|Old English|wrongly
mono|Greek|one
multi|Latin|many
neo|Greek|new
non|Latin|not
ob|Latin|against, toward
omni|Latin|all
pan|Greek|all
para|Greek|beside, beyond
per|Latin|through, thoroughly
peri|Greek|around
poly|Greek|many
post|Latin|after
pre|Latin|before
pro|Latin|forward, in favour of
proto|Greek|first
pseudo|Greek|false
re|Latin|back, again
retro|Latin|backward
se|Latin|apart
semi|Latin|half
sub|Latin|under
super|Latin|above, beyond
sym|Greek|together with
syn|Greek|together with
tele|Greek|far off
trans|Latin|across
ultra|Latin|beyond
un|Old English|not
uni|Latin|one
`

const ROOTS = `
act/ag|Latin|do, drive
aesthe|Greek|feeling, perception
alt|Latin|high
am/amic/amor|Latin|love, friend
anim|Latin|life, spirit
anthrop|Greek|human being
aqu|Latin|water
arch|Greek|chief, rule
aud/audit|Latin|hear
bell|Latin|war
bibli|Greek|book
bio|Greek|life
brev|Latin|short
cad/cas/cid|Latin|fall
cand|Latin|glow, white
cap/capt/cept|Latin|take, seize
carn|Latin|flesh
ced/cess|Latin|go, yield
chron|Greek|time
cis/cid|Latin|cut, kill
claim/clam|Latin|shout
clud/clus/clos|Latin|shut
cogn/gnos|Latin|know
corp|Latin|body
cred|Latin|believe
cur/curs/cour|Latin|run
dem|Greek|people
dic/dict|Latin|say, speak
doc/doct|Latin|teach
duc/duct|Latin|lead
dur|Latin|hard, lasting
err|Latin|wander
fac/fact/fect/fic|Latin|make, do
fer|Latin|carry, bear
fid|Latin|faith, trust
fin|Latin|end, limit
flect/flex|Latin|bend
flu/fluct|Latin|flow
form|Latin|shape
fort|Latin|strong
frag/fract|Latin|break
fug|Latin|flee
gen|Latin|birth, kind
grad/gress|Latin|step, go
graph/gram|Greek|write, draw
grat|Latin|pleasing, thankful
greg|Latin|flock, herd
hydr|Greek|water
ject|Latin|throw
jud/jur/jus|Latin|law, judge
jung/junct|Latin|join
lect/leg|Latin|read, choose
loc|Latin|place
log|Greek|word, reason
loqu/locut|Latin|speak
luc/lum|Latin|light
magn|Latin|great
man/manu|Latin|hand
mater/matr|Latin|mother
mem|Latin|mindful
ment|Latin|mind
meter/metr|Greek|measure
migr|Latin|move, wander
mit/miss|Latin|send
mon/monit|Latin|warn, advise
morph|Greek|shape
mort|Latin|death
mov/mot|Latin|move
mut|Latin|change
nasc/nat|Latin|born
nav|Latin|ship
nom/nym|Greek|name
nov|Latin|new
ocul|Latin|eye
oper|Latin|work
pac/plac|Latin|peace, please
pand/pans|Latin|spread
pater/patr|Latin|father
path|Greek|feeling, suffering
ped|Latin|foot
pel/puls|Latin|drive, push
pend/pens|Latin|hang, weigh, pay
phil|Greek|love
phon|Greek|sound
phot|Greek|light
plen/plet|Latin|full
plic/plex|Latin|fold
pon/pos|Latin|put, place
port|Latin|carry
pot|Latin|power
prehend/prehens|Latin|grasp
prob|Latin|test, prove
psych|Greek|mind, soul
quir/quis/quest|Latin|ask, seek
rect|Latin|straight, right
rog|Latin|ask
rupt|Latin|break
sci|Latin|know
scrib/script|Latin|write
sect|Latin|cut
sed/sess/sid|Latin|sit, settle
sent/sens|Latin|feel
sequ/secut|Latin|follow
serv|Latin|keep, serve
sign|Latin|mark, sign
sol|Latin|alone, or sun
solv/solut|Latin|loosen
somn|Latin|sleep
son|Latin|sound
spec/spect/spic|Latin|look
spir|Latin|breathe
stru/struct|Latin|build
tac/tic|Latin|silent
tang/tact/ting|Latin|touch
temp|Latin|time
ten/tain/tent|Latin|hold
tend/tens|Latin|stretch
term|Latin|end, boundary
terr|Latin|earth, or frighten
test|Latin|witness
therm|Greek|heat
tort|Latin|twist
tract|Latin|pull, draw
trud/trus|Latin|push
urb|Latin|city
vac|Latin|empty
ven/vent|Latin|come
ver|Latin|true
verb|Latin|word
vert/vers|Latin|turn
vid/vis|Latin|see
vinc/vict|Latin|conquer
viv/vit|Latin|life
voc/vok|Latin|call, voice
vol|Latin|wish, will
volv/volut|Latin|roll, turn
val/vail|Latin|strength, worth
grav|Latin|heavy
lev|Latin|light, raise
liber|Latin|free
lud/lus|Latin|play
simil/simul|Latin|like, same
cord|Latin|heart
vag|Latin|wander
plaud/plaus|Latin|clap, approve
scend/scens|Latin|climb
fus/fund|Latin|pour
gest|Latin|carry
her/hes|Latin|stick
nect/nex|Latin|bind
numer|Latin|number
ora|Latin|speak, pray
pugn|Latin|fight
sal/sult|Latin|leap
scrut|Latin|examine
sta/stat/stit|Latin|stand
turb|Latin|disturb
vor|Latin|devour
crypt|Greek|hidden
cosm|Greek|world, order
dox|Greek|opinion, belief
erg|Greek|work
geo|Greek|earth
icon|Greek|image
techn|Greek|skill, art
the/theo|Greek|god
top|Greek|place
xen|Greek|stranger
`

const SUFFIXES = `
able|Latin|able to be
ible|Latin|able to be
acious|Latin|given to, full of
acy|Latin|state or quality
al|Latin|relating to
ance|Latin|state of
ence|Latin|state of
ant|Latin|one who, or doing
ent|Latin|doing, being
ary|Latin|relating to
ate|Latin|to make, or having
cide|Latin|killing
cracy|Greek|rule by
crat|Greek|ruler
ectomy|Greek|surgical removal
en|Old English|made of, to make
esce|Latin|beginning to
escent|Latin|beginning to
ferous|Latin|bearing
fy|Latin|to make
gamy|Greek|marriage
graphy|Greek|writing about
ian|Latin|relating to
ic|Greek|relating to
ify|Latin|to make
ile|Latin|tending to
ine|Latin|relating to
ion|Latin|act or state of
ism|Greek|doctrine or practice
ist|Greek|one who
ity|Latin|state or quality
ive|Latin|tending to
ize|Greek|to make
latry|Greek|worship of
logy|Greek|study of
ment|Latin|result or means of
meter|Greek|measuring device
oid|Greek|resembling
ology|Greek|study of
ose|Latin|full of
osis|Greek|condition or process
ous|Latin|full of
pathy|Greek|feeling, disease
phile|Greek|lover of
phobia|Greek|fear of
phone|Greek|sound
scope|Greek|instrument for viewing
ship|Old English|state or skill of
tude|Latin|state or quality
ure|Latin|act or result of
y|Latin|state or quality
`

function parse(block: string): Morpheme[] {
  return block
    .trim()
    .split('\n')
    .map((line) => {
      const [form, lang, gloss] = line.split('|')
      return { form, lang: lang as Lang, gloss }
    })
    .filter((m) => m.form && m.gloss)
}

/** One root entry per spelling variant, each remembering the family's gloss. */
function parseRoots(block: string): Morpheme[] {
  const out: Morpheme[] = []
  for (const m of parse(block)) {
    for (const variant of m.form.split('/')) out.push({ ...m, form: variant })
  }
  return out
}

export const PREFIX_LIST = parse(PREFIXES)
export const ROOT_LIST = parseRoots(ROOTS)
export const SUFFIX_LIST = parse(SUFFIXES)

/**
 * Words the analyzer gets wrong, or where the real story is worth telling.
 * A short list of corrections beats loosening the rules for everything.
 */
export const OVERRIDES: Record<string, { lang?: Lang; parts: { form: string; gloss: string }[]; note?: string }> = {
  ephemeral: { lang: 'Greek', parts: [{ form: 'epi-', gloss: 'for' }, { form: 'hemera', gloss: 'a day' }], note: 'lasting but a day' },
  cacophony: { lang: 'Greek', parts: [{ form: 'kakos-', gloss: 'bad' }, { form: 'phone', gloss: 'sound' }] },
  eulogy: { lang: 'Greek', parts: [{ form: 'eu-', gloss: 'well' }, { form: 'logos', gloss: 'speech' }] },
  euphemism: { lang: 'Greek', parts: [{ form: 'eu-', gloss: 'well' }, { form: 'pheme', gloss: 'speaking' }] },
  equanimity: { lang: 'Latin', parts: [{ form: 'aequus', gloss: 'even' }, { form: 'animus', gloss: 'mind' }] },
  altruism: { lang: 'Latin', parts: [{ form: 'alter', gloss: 'other' }, { form: '-ism', gloss: 'doctrine' }] },
  candid: { lang: 'Latin', parts: [{ form: 'candidus', gloss: 'white, clear' }] },
  capricious: { lang: 'Latin', parts: [{ form: 'capra', gloss: 'goat' }], note: 'as skittish as a goat' },
  banal: { lang: 'French', parts: [{ form: 'ban', gloss: 'compulsory service' }], note: 'common to everyone, so commonplace' },
  arduous: { lang: 'Latin', parts: [{ form: 'arduus', gloss: 'steep, high' }] },
  austere: { lang: 'Greek', parts: [{ form: 'austeros', gloss: 'harsh, dry' }] },
  enigma: { lang: 'Greek', parts: [{ form: 'ainos', gloss: 'fable, riddle' }] },
  apathy: { lang: 'Greek', parts: [{ form: 'a-', gloss: 'without' }, { form: 'pathos', gloss: 'feeling' }] },
  anomaly: { lang: 'Greek', parts: [{ form: 'an-', gloss: 'not' }, { form: 'homalos', gloss: 'even' }] },
  dearth: { lang: 'Old English', parts: [{ form: 'deore', gloss: 'dear, costly' }], note: 'scarcity makes things dear' },
}
