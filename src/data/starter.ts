import type { RawEntry } from '../db'

/**
 * The built-in deck, so the app does something useful before any import.
 * Alphabetical, spanning a-z. Definitions written for this project; free to
 * use and redistribute.
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
facetious	adjective	joking about something that deserves to be taken seriously
fallacious	adjective	based on faulty reasoning; misleading
fastidious	adjective	very attentive to detail; hard to please
fervent	adjective	showing intense and passionate feeling
fickle	adjective	changing loyalty or affection without good reason
flout	verb	to openly disregard a rule or convention
fortuitous	adjective	happening by chance, often luckily
frugal	adjective	sparing with money or resources
furtive	adjective	done quietly to avoid being noticed
futile	adjective	pointless; incapable of producing any result
garrulous	adjective	excessively talkative about trivial things
germane	adjective	genuinely relevant to the matter at hand
gregarious	adjective	sociable; fond of company
guile	noun	cunning used to deceive
hackneyed	adjective	worn out by overuse; unoriginal
harbinger	noun	a sign of something about to happen
haughty	adjective	arrogantly superior toward others
heresy	noun	a belief that contradicts accepted doctrine
hiatus	noun	a pause or gap in continuity
hubris	noun	excessive pride that invites downfall
iconoclast	noun	a person who attacks cherished beliefs or institutions
idiosyncrasy	noun	a peculiar habit or feature of one person
immutable	adjective	unchanging and unable to be changed
impeccable	adjective	flawless; without any fault
impetuous	adjective	acting quickly without thought or care
implacable	adjective	impossible to appease or soften
inadvertent	adjective	unintentional; done without noticing
incessant	adjective	continuing without pause
incisive	adjective	showing sharp, clear thinking
incongruous	adjective	out of place; not in harmony with its surroundings
indigenous	adjective	originating naturally in a particular place
indolent	adjective	habitually idle; averse to effort
ineffable	adjective	too great to be put into words
inexorable	adjective	impossible to stop or persuade
ingenuous	adjective	innocent and unguarded; frank
innocuous	adjective	harmless; unlikely to offend
insidious	adjective	spreading harm gradually and unnoticed
insipid	adjective	lacking flavour, interest, or vigour
intransigent	adjective	refusing to compromise
intrepid	adjective	fearless in the face of danger
inundate	verb	to overwhelm, or to flood
irascible	adjective	easily provoked to anger
judicious	adjective	showing good judgment and sense
juxtapose	verb	to place side by side for contrast
laconic	adjective	using very few words
languid	adjective	lacking energy; pleasantly slow
laud	verb	to praise highly
lethargic	adjective	sluggish and lacking energy
levity	noun	lightness of manner, especially when seriousness is expected
loquacious	adjective	very talkative
lucid	adjective	clearly expressed, or clear-headed
magnanimous	adjective	generous and forgiving, especially toward a rival
malevolent	adjective	wishing harm to others
malleable	adjective	easily shaped, or easily influenced
meticulous	adjective	showing great care over every detail
mitigate	verb	to make something bad less severe
mollify	verb	to soothe the anger of
morose	adjective	gloomy and sullen
mundane	adjective	ordinary and dull; of the everyday world
munificent	adjective	extremely generous
myriad	noun	a countless number of things
nebulous	adjective	vague and ill-defined
nefarious	adjective	wicked; criminal in intent
neophyte	noun	a beginner at something
nonchalant	adjective	calmly unconcerned
nuance	noun	a subtle difference in meaning or feeling
obdurate	adjective	stubbornly refusing to change an opinion
obfuscate	verb	to make something unclear on purpose
oblivious	adjective	entirely unaware of what is happening
obsequious	adjective	excessively eager to please or obey
obsolete	adjective	no longer in use; out of date
obstinate	adjective	stubbornly refusing to change course
ominous	adjective	suggesting that something bad is coming
opaque	adjective	impossible to see through, or hard to understand
opulent	adjective	luxurious and costly
ostentatious	adjective	designed to impress; showy
ostracize	verb	to exclude someone from a group
palpable	adjective	so intense it feels almost physical
paragon	noun	a perfect example of a quality
paucity	noun	a shortage; too small an amount
pedantic	adjective	overly concerned with minor rules and details
penchant	noun	a strong liking for something
perfunctory	adjective	done without care, merely as a duty
pernicious	adjective	causing harm in a gradual, hidden way
perspicacious	adjective	having keen insight, especially into people
pertinent	adjective	directly relevant
pervasive	adjective	spreading widely through every part
placate	verb	to calm someone's anger
plausible	adjective	seeming reasonable, though possibly untrue
pragmatic	adjective	dealing with things practically rather than ideally
precarious	adjective	unstable; dependent on chance
preclude	verb	to make impossible in advance
predilection	noun	a natural preference for something
prescient	adjective	knowing what will happen before it does
pristine	adjective	in its original, unspoiled condition
prodigal	adjective	wastefully extravagant
prolific	adjective	producing a great deal
propensity	noun	a natural inclination to behave a certain way
prosaic	adjective	plain and unimaginative
provincial	adjective	narrow in outlook; of the regions rather than the capital
prudent	adjective	acting with care for the future
pugnacious	adjective	eager to argue or fight
quell	verb	to put an end to, usually by force
querulous	adjective	habitually complaining
quiescent	adjective	inactive or at rest for the time being
quintessential	adjective	representing the purest example of its kind
quixotic	adjective	idealistic to the point of being impractical
rancor	noun	long-held bitterness or resentment
rebuke	verb	to criticize sharply
recalcitrant	adjective	stubbornly resisting authority
reciprocal	adjective	given and received in equal measure
redundant	adjective	more than is needed; superfluous
refute	verb	to prove a claim wrong with evidence
relegate	verb	to consign to a lower rank or position
repudiate	verb	to reject or disown formally
resilient	adjective	able to recover quickly from difficulty
reticent	adjective	unwilling to say much
rhetoric	noun	the art of persuasive speech, or language empty of substance
rudimentary	adjective	basic and undeveloped
ruminate	verb	to think something over at length
sagacious	adjective	showing deep wisdom and good judgment
salient	adjective	most noticeable or important
sanguine	adjective	cheerfully optimistic, especially in bad circumstances
scrupulous	adjective	careful to do what is right, down to the detail
scrutinize	verb	to examine closely and critically
servile	adjective	excessively submissive
soporific	adjective	tending to induce sleep
specious	adjective	seeming right but actually false
sporadic	adjective	occurring at irregular intervals
spurious	adjective	not genuine; based on false reasoning
squander	verb	to waste something valuable
stagnant	adjective	not flowing or developing
staunch	adjective	loyal and firm in commitment
stoic	adjective	enduring pain or hardship without complaint
strident	adjective	loud and harsh; forcefully insistent
subjugate	verb	to bring under domination
succinct	adjective	expressed clearly in few words
superfluous	adjective	more than is needed; unnecessary
supplant	verb	to take the place of something displaced
surreptitious	adjective	done secretly to escape notice
sycophant	noun	a person who flatters the powerful for advantage
taciturn	adjective	saying little by nature
tangential	adjective	only loosely connected to the subject
temerity	noun	boldness that borders on recklessness
tenacious	adjective	holding firmly; persistent
tentative	adjective	provisional; done without confidence
tenuous	adjective	very weak or slight
terse	adjective	brief to the point of curtness
thwart	verb	to prevent someone from achieving something
timorous	adjective	nervous and easily frightened
torpor	noun	sluggish inactivity
tractable	adjective	easy to control or manage
transient	adjective	lasting only a short time
trepidation	noun	anxiety about what is to come
trite	adjective	dulled by overuse; lacking freshness
truculent	adjective	aggressively defiant
ubiquitous	adjective	present everywhere at once
unequivocal	adjective	leaving no doubt; admitting one meaning only
untenable	adjective	impossible to defend against objection
usurp	verb	to seize a position or power wrongfully
vacillate	verb	to waver between choices
vapid	adjective	offering nothing of interest; flat
vehement	adjective	showing strong, forceful feeling
venerate	verb	to regard with deep respect
veracity	noun	truthfulness; accuracy
verbose	adjective	using more words than necessary
viable	adjective	capable of working or surviving
vicarious	adjective	experienced indirectly, through someone else
vigilant	adjective	watchful for danger
vilify	verb	to speak about with abusive disparagement
vindicate	verb	to clear of blame, or to justify
virulent	adjective	bitterly hostile, or severely poisonous
vociferous	adjective	expressing opinions loudly and insistently
volatile	adjective	liable to change rapidly and unpredictably
wary	adjective	cautious about possible danger
whimsical	adjective	playfully odd; given to sudden fancies
wistful	adjective	quietly longing for something lost
zealous	adjective	filled with intense enthusiasm for a cause
zenith	noun	the highest point reached
`

export const STARTER_PACK: RawEntry[] = TSV.trim()
  .split('\n')
  .map((line) => {
    const [word, pos, meaning] = line.split('\t')
    return { word, pos, meaning }
  })
  .filter((e) => e.word && e.meaning)

export const STARTER_NAME = 'Core vocabulary (a-z)'
