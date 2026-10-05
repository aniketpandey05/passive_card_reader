/**
 * Latin and Greek word parts, for breaking a headword into its pieces.
 *
 * This is deliberately a table plus an analyzer rather than per-word
 * etymology: a table works on whatever a user imports, where hand-written
 * etymology only ever covers the words someone thought to write it for.
 *
 * Format per line: form | language | meaning | example words (roots only)
 * Roots list their main spelling variants separated by "/", so one entry
 * covers "duc" and "duct".
 *
 * The examples matter more than they look. A deck of a few hundred words
 * rarely holds two relatives of the same root, so without them the family
 * cross-reference would almost never appear - and seeing the family is the
 * whole point of learning a root.
 */

export type Lang = 'Latin' | 'Greek' | 'Old English' | 'French'

export interface Morpheme {
  form: string
  lang: Lang
  gloss: string
  /**
   * Shared identity for spelling variants of one root, so "spec", "spect" and
   * "spic" count as the same family and their words find each other.
   */
  family?: string
  /** Everyday words built on this root, shown as the family cross-reference. */
  examples?: string[]
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
act/ag|Latin|do, drive|agent, agenda, agile, react
aesthe|Greek|feeling, perception|aesthetic, anaesthetic
alt|Latin|high|altitude, altar, exalt
am/amic/amor|Latin|love, friend|amiable, amorous, enamoured
anim|Latin|life, spirit|animal, unanimous, animated
anthrop|Greek|human being|anthropology, philanthropy, misanthrope
aqu|Latin|water|aquarium, aquatic, aqueduct
arch|Greek|chief, rule|monarch, anarchy, architect
aud/audit|Latin|hear|audible, audience, audition
bell|Latin|war|rebel, belligerent, bellicose
bibli|Greek|book|bibliography, bible, bibliophile
bio|Greek|life|biology, biography, symbiosis
brev|Latin|short|brief, abbreviate, brevity
cad/cas/cid|Latin|fall|cascade, accident, decadent
cand|Latin|glow, white|candle, candid, incandescent
cap/capt/cept|Latin|take, seize|capture, accept, receptive
carn|Latin|flesh|carnivore, incarnate, carnal
ced/cess|Latin|go, yield|precede, recession, concede
chron|Greek|time|chronic, synchronize, chronicle
cis/cid|Latin|cut, kill|incision, precise, homicide
claim/clam|Latin|shout|exclaim, clamour, proclaim
clud/clus/clos|Latin|shut|include, seclusion, closet
cogn/gnos|Latin|know|recognize, diagnosis, incognito
corp|Latin|body|corpse, corporation, corporal
cred|Latin|believe|credit, incredible, creed
cur/curs/cour|Latin|run|current, excursion, recur
dem|Greek|people|democracy, epidemic, demographic
dic/dict|Latin|say, speak|dictate, predict, verdict
doc/doct|Latin|teach|doctor, document, indoctrinate
duc/duct|Latin|lead|conduct, educate, induce
dur|Latin|hard, lasting|endure, durable, duration
err|Latin|wander|error, erratic, aberration
fac/fact/fect/fic|Latin|make, do|factory, effect, proficient
fer|Latin|carry, bear|transfer, refer, fertile
fid|Latin|faith, trust|confide, fidelity, infidel
fin|Latin|end, limit|finish, infinite, define
flect/flex|Latin|bend|reflect, flexible, deflect
flu/fluct|Latin|flow|fluid, influence, fluctuate
form|Latin|shape|reform, uniform, formation
fort|Latin|strong|fortify, comfort, fortitude
frag/fract|Latin|break|fragile, fracture, fragment
fug|Latin|flee|refugee, fugitive, centrifugal
gen|Latin|birth, kind|generate, genius, congenital
grad/gress|Latin|step, go|gradual, progress, digress
graph/gram|Greek|write, draw|autograph, diagram, telegram
grat|Latin|pleasing, thankful|gratitude, congratulate, ingratiate
greg|Latin|flock, herd|gregarious, congregate, segregate
hydr|Greek|water|hydrant, dehydrate, hydraulic
ject|Latin|throw|inject, reject, projectile
jud/jur/jus|Latin|law, judge|judge, jury, justice
jung/junct|Latin|join|junction, conjunction, adjoin
lect/leg|Latin|read, choose|collect, legible, elect
loc|Latin|place|local, dislocate, locate
log|Greek|word, reason|logic, dialogue, prologue
loqu/locut|Latin|speak|eloquent, soliloquy, colloquial
luc/lum|Latin|light|lucid, illuminate, translucent
magn|Latin|great|magnify, magnitude, magnate
man/manu|Latin|hand|manual, manufacture, manuscript
mater/matr|Latin|mother|maternal, matrimony, matriarch
mem|Latin|mindful|memory, commemorate, memoir
ment|Latin|mind|mental, demented, mention
meter/metr|Greek|measure|thermometer, symmetry, diameter
migr|Latin|move, wander|migrate, immigrant, emigrate
mit/miss|Latin|send|transmit, mission, dismiss
mon/monit|Latin|warn, advise|monitor, admonish, premonition
morph|Greek|shape|metamorphosis, amorphous, morphology
mort|Latin|death|mortal, mortuary, immortal
mov/mot|Latin|move|motion, remove, motive
mut|Latin|change|mutate, commute, immutable
nasc/nat|Latin|born|native, prenatal, renaissance
nav|Latin|ship|navy, navigate, circumnavigate
nom/nym|Greek|name|synonym, anonymous, pseudonym
nov|Latin|new|novel, innovate, renovate
ocul|Latin|eye|binocular, ocular, monocle
oper|Latin|work|operate, cooperate, opus
pac/plac|Latin|peace, please|pacify, placid, complacent
pand/pans|Latin|spread|expand, expansive
pater/patr|Latin|father|paternal, patriot, patron
path|Greek|feeling, suffering|sympathy, pathetic, apathy
ped|Latin|foot|pedal, pedestrian, expedite
pel/puls|Latin|drive, push|expel, repulse, compulsive
pend/pens|Latin|hang, weigh, pay|pendant, suspend, pension
phil|Greek|love|philosophy, bibliophile, philanthropy
phon|Greek|sound|telephone, symphony, phonetic
phot|Greek|light|photograph, photon, photosynthesis
plen/plet|Latin|full|plenty, complete, replenish
plic/plex|Latin|fold|complicate, duplex, implicate
pon/pos|Latin|put, place|compose, deposit, postpone
port|Latin|carry|transport, portable, export
pot|Latin|power|potent, potential, omnipotent
prehend/prehens|Latin|grasp|comprehend, apprehend
prob|Latin|test, prove|probe, probable, reprobate
psych|Greek|mind, soul|psychology, psychic
quir/quis/quest|Latin|ask, seek|inquire, inquisitive, request
rect|Latin|straight, right|correct, rectify, erect
rog|Latin|ask|interrogate, arrogant, derogatory
rupt|Latin|break|erupt, interrupt, rupture
sci|Latin|know|science, conscious, omniscient
scrib/script|Latin|write|describe, manuscript, inscription
sect|Latin|cut|dissect, section, intersect
sed/sess/sid|Latin|sit, settle|sediment, session, reside
sent/sens|Latin|feel|sentiment, sensitive, consent
sequ/secut|Latin|follow|sequence, consecutive, obsequious
serv|Latin|keep, serve|preserve, servant, reservoir
sign|Latin|mark, sign|signal, designate, significant
sol|Latin|alone, or sun|solitude, solo, solar
solv/solut|Latin|loosen|dissolve, solution, absolve
somn|Latin|sleep|insomnia, somnolent
son|Latin|sound|sonic, resonate, dissonance
spec/spect/spic|Latin|look|inspect, spectacle, conspicuous
spir|Latin|breathe|respire, inspire, conspire
stru/struct|Latin|build|construct, structure, instrument
tac/tic|Latin|silent|tacit, reticent, taciturn
tang/tact/ting|Latin|touch|tangible, contact, contingent
temp|Latin|time|temporary, contemporary, tempo
ten/tain/tent|Latin|hold|retain, tenant, detention
tend/tens|Latin|stretch|extend, tension, intense
term|Latin|end, boundary|terminate, determine, terminal
terr|Latin|earth, or frighten|territory, terrain, subterranean
test|Latin|witness|testify, protest, testament
therm|Greek|heat|thermal, thermostat, hypothermia
tort|Latin|twist|distort, torture, contortion
tract|Latin|pull, draw|attract, extract, tractor
trud/trus|Latin|push|intrude, protrusion, obtrusive
urb|Latin|city|urban, suburb, urbane
vac|Latin|empty|vacant, evacuate, vacuum
ven/vent|Latin|come|convene, prevent, advent
ver|Latin|true|verify, veracity, verdict
verb|Latin|word|verbal, proverb, verbatim
vert/vers|Latin|turn|convert, reverse, diversion
vid/vis|Latin|see|video, evident, revise
vinc/vict|Latin|conquer|convince, victory, invincible
viv/vit|Latin|life|survive, vivid, vital
voc/vok|Latin|call, voice|vocal, invoke, advocate
vol|Latin|wish, will|voluntary, benevolent, malevolent
volv/volut|Latin|roll, turn|revolve, evolution, convoluted
val/vail|Latin|strength, worth|valid, prevail, evaluate
grav|Latin|heavy|gravity, grave, aggravate
lev|Latin|light, raise|elevate, alleviate, levitate
liber|Latin|free|liberty, liberal, deliberate
lud/lus|Latin|play|elude, illusion, ludicrous
simil/simul|Latin|like, same|similar, assimilate, simultaneous
cord|Latin|heart|cordial, accord, discord
vag|Latin|wander|vagrant, vague, extravagant
plaud/plaus|Latin|clap, approve|applaud, plausible, applause
scend/scens|Latin|climb|ascend, descent, transcend
fus/fund|Latin|pour|confuse, refund, profuse
gest|Latin|carry|digest, congestion, gesture
her/hes|Latin|stick|adhere, cohesion, inherent
nect/nex|Latin|bind|connect, annex, nexus
numer|Latin|number|numeral, enumerate, innumerable
ora|Latin|speak, pray|oral, orator, adore
pugn|Latin|fight|repugnant, pugnacious, impugn
sal/sult|Latin|leap|assault, resilient, exult
scrut|Latin|examine|scrutiny, inscrutable
sta/stat/stit|Latin|stand|stable, station, constitute
turb|Latin|disturb|turbulent, perturb, turbine
vor|Latin|devour|carnivore, voracious, devour
crypt|Greek|hidden|cryptic, encrypt, apocryphal
cosm|Greek|world, order|cosmos, cosmic, microcosm
dox|Greek|opinion, belief|orthodox, paradox, doxology
erg|Greek|work|energy, ergonomic, synergy
geo|Greek|earth|geography, geology, geometry
icon|Greek|image|icon, iconic, iconoclast
techn|Greek|skill, art|technique, technology, polytechnic
the/theo|Greek|god|theology, atheist, theocracy
top|Greek|place|topic, topography, utopia
xen|Greek|stranger|xenophobia, xenon
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
      const [form, lang, gloss, examples] = line.split('|')
      return {
        form,
        lang: lang as Lang,
        gloss,
        examples: examples ? examples.split(',').map((w) => w.trim()).filter(Boolean) : undefined,
      }
    })
    .filter((m) => m.form && m.gloss)
}

/** One root entry per spelling variant, each remembering its family and gloss. */
function parseRoots(block: string): Morpheme[] {
  const out: Morpheme[] = []
  for (const m of parse(block)) {
    const variants = m.form.split('/')
    for (const variant of variants) out.push({ ...m, form: variant, family: variants[0] })
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
