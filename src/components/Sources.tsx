/**
 * Where the words come from, named in the app rather than only in the repo.
 *
 * Wiktionary's text is CC BY-SA, which asks for attribution wherever the
 * content goes; the others ask for their notice to travel with them. A
 * reader deserves to know whose definition they are reading in any case.
 */
const SOURCES = [
  {
    name: 'WordNet 3.0',
    what: 'Definitions, synonyms and opposites.',
    terms: 'Princeton University. Used under the WordNet licence.',
  },
  {
    name: 'Wiktionary',
    what: 'Word origins and related words, via kaikki.org.',
    terms: 'CC BY-SA 3.0.',
  },
  {
    name: "Webster's Revised Unabridged Dictionary (1913)",
    what: 'The Webster 1913 dictionary.',
    terms: 'Public domain. Not the modern Merriam-Webster, which is not used here.',
  },
  {
    name: "Roget's Thesaurus (1911)",
    what: 'The concepts and their word groups.',
    terms: 'Public domain.',
  },
  {
    name: 'Google Web Trillion Word Corpus',
    what: 'Frequency ranks, used to choose which words are worth a card.',
    terms: 'Open data.',
  },
  {
    name: 'pdf.js and Tesseract',
    what: 'Reading PDFs and recognising scanned pages, on this device.',
    terms: 'Apache 2.0.',
  },
]

export default function Sources() {
  return (
    <div className="setting">
      <div className="label">
        <b>Where the words come from</b>
      </div>
      <ul className="sources">
        {SOURCES.map((source) => (
          <li key={source.name}>
            <b>{source.name}</b>
            <span>{source.what}</span>
            <span className="terms">{source.terms}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
