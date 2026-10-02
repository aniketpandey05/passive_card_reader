import type { RawEntry } from '../db'

/**
 * A 100-word starter deck so the app does something useful before any import.
 * Alphabetical a-e, so it behaves like a slice of a real dictionary.
 * Definitions written for this project; free to use and redistribute.
 */
const TSV = `
abate	verb	to become less intense or widespread; to reduce something
aberration	noun	a departure from what is normal or expected
abhor	verb	to regard with disgust and hatred
abstain	verb	to choose not to do or take something
accolade	noun	an award, or an expression of praise
acumen	noun	sharp judgment and quick insight
adamant	adjective	refusing to be persuaded; unshakably firm
admonish	verb	to warn or reprimand gently but firmly
adversity	noun	a difficult or unpleasant situation
aesthetic	adjective	concerned with beauty, or with the appreciation of beauty
affable	adjective	friendly and easy to talk to
alleviate	verb	to make pain or a problem less severe
aloof	adjective	distant and uninvolved; emotionally cool
altruism	noun	unselfish concern for the welfare of others
ambiguous	adjective	open to more than one interpretation; unclear
ambivalent	adjective	having mixed or contradictory feelings about something
anachronism	noun	something placed in the wrong historical period
analogous	adjective	comparable in some useful respect
anecdote	noun	a short personal story used to illustrate a point
animosity	noun	strong hostility or ill will
anomaly	noun	something that deviates from the standard or expected
antipathy	noun	a deep-seated dislike
apathy	noun	lack of interest, enthusiasm, or concern
appease	verb	to pacify someone by giving in to their demands
arbitrary	adjective	based on personal whim rather than reason or rule
arcane	adjective	understood by very few; mysteriously obscure
arduous	adjective	requiring great effort; strenuous
articulate	adjective	able to express thoughts clearly and fluently
ascetic	noun	a person who practices severe self-discipline and abstinence
assiduous	adjective	showing great care and persistent effort
astute	adjective	shrewd; quick to see an advantage
audacious	adjective	boldly daring, sometimes to the point of recklessness
augment	verb	to make greater by adding to it
auspicious	adjective	suggesting a favorable outcome; promising
austere	adjective	severely simple and plain; stern in manner
banal	adjective	so unoriginal as to be boring
belie	verb	to give a false impression of; to contradict
benevolent	adjective	kind and generous toward others
bolster	verb	to support or strengthen
brevity	noun	shortness of speech or writing; conciseness
cacophony	noun	a harsh, discordant mixture of sounds
candid	adjective	truthful and straightforward, even when it is awkward
capricious	adjective	given to sudden changes of mood or behavior
castigate	verb	to reprimand severely
caustic	adjective	bitingly sarcastic; corrosive
censure	verb	to express strong formal disapproval
circumspect	adjective	cautious; wary of risk and consequence
clandestine	adjective	kept secret, usually because it is improper
coalesce	verb	to come together to form one whole
cogent	adjective	clear, logical, and convincing
complacent	adjective	smugly satisfied, and so unaware of danger
conciliatory	adjective	intended to placate or win goodwill
condone	verb	to accept or overlook behavior that is wrong
conundrum	noun	a confusing and difficult problem
corroborate	verb	to confirm with supporting evidence
credulous	adjective	too ready to believe things; easily deceived
cryptic	adjective	mysterious in meaning; deliberately obscure
culpable	adjective	deserving blame
cursory	adjective	hasty and not thorough
dearth	noun	a scarcity or lack of something
debunk	verb	to expose the falseness of a claim or belief
decorum	noun	behavior that is proper and in good taste
deference	noun	polite respect, and submission to another's judgment
deleterious	adjective	causing harm or damage
delineate	verb	to describe or outline precisely
deride	verb	to mock or ridicule with contempt
desultory	adjective	lacking a plan or purpose; jumping from one thing to another
deter	verb	to discourage someone from acting, usually by instilling doubt
diatribe	noun	a bitter, forceful verbal attack
didactic	adjective	intended to teach, often in a heavy-handed moral way
diffident	adjective	shy and lacking self-confidence
digress	verb	to stray from the main subject
dilatory	adjective	slow to act; causing delay
disparage	verb	to belittle or speak of slightingly
disparate	adjective	essentially different and unrelated
dissemble	verb	to hide one's true motives or feelings
docile	adjective	easily managed and willing to be taught
dogmatic	adjective	asserting opinions as if they were beyond question
dubious	adjective	doubtful; questionable in quality or truth
ebullient	adjective	overflowing with enthusiasm and energy
eclectic	adjective	drawing on a wide and varied range of sources
efficacy	noun	the power to produce the intended result
egregious	adjective	outstandingly bad; shockingly wrong
elicit	verb	to draw out a response or reaction
eloquent	adjective	fluent and persuasive in speech or writing
elucidate	verb	to make clear by explaining
emulate	verb	to imitate, especially in order to match or surpass
enervate	verb	to drain of energy and vitality
engender	verb	to give rise to; to bring about
enigma	noun	a person or thing that is mysterious and hard to understand
ephemeral	adjective	lasting a very short time
equanimity	noun	calmness and composure under strain
erudite	adjective	having or showing deep scholarly knowledge
esoteric	adjective	understood only by a small group with special knowledge
eulogy	noun	a speech of high praise, especially for someone who has died
euphemism	noun	a mild word substituted for one thought harsh or blunt
exacerbate	verb	to make a bad situation worse
exemplary	adjective	serving as a desirable model; outstandingly good
exhaustive	adjective	thorough and complete, leaving nothing out
exonerate	verb	to clear of blame or accusation
`

export const STARTER_PACK: RawEntry[] = TSV.trim()
  .split('\n')
  .map((line) => {
    const [word, pos, meaning] = line.split('\t')
    return { word, pos, meaning }
  })
  .filter((e) => e.word && e.meaning)

export const STARTER_NAME = 'Starter pack (a-e)'
