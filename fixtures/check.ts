/**
 * Runs the real import pipeline against the fixture PDFs, in Node, and scores
 * it against expected.json. Node 24 strips the TypeScript, so these are the
 * same modules the app ships - no reimplementation to drift out of sync.
 *
 *   node fixtures/check.ts [dict-2col|wordlist]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { fontLooksBold, itemsToWords } from '../src/lib/pdfsource.ts'
import { pageLines, stripRunningHeads } from '../src/lib/layout.ts'
import type { Line, PageWords } from '../src/lib/layout.ts'
import { STRATEGY_LABEL, assemble } from '../src/lib/dict.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const expected = JSON.parse(readFileSync(join(HERE, 'expected.json'), 'utf8'))

async function extract(file: string): Promise<{ pages: PageWords[]; lines: Line[]; fonts: string[] }> {
  const doc = await getDocument({
    data: new Uint8Array(readFileSync(join(HERE, file))),
    standardFontDataUrl: pathToFileURL(join(ROOT, 'node_modules/pdfjs-dist/standard_fonts/')).href,
    isEvalSupported: false,
  }).promise

  const pages: PageWords[] = []
  const perPage: { page: PageWords; lines: Line[] }[] = []
  const fonts = new Set<string>()

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: 1 })
    try {
      await page.getOperatorList()
    } catch {
      /* font names stay unresolved */
    }
    const content = await page.getTextContent()
    const resolve = (fontName: string): string => {
      try {
        if (page.commonObjs.has(fontName)) {
          const font = page.commonObjs.get(fontName) as { name?: string }
          if (font?.name) return font.name
        }
      } catch {
        /* fall through */
      }
      return content.styles?.[fontName]?.fontFamily ?? fontName
    }
    const isBold = (fontName: string) => {
      const name = resolve(fontName)
      if (n === 1) fonts.add(name)
      return fontLooksBold(name)
    }
    const items = content.items.filter((i: unknown) => typeof (i as { str?: string }).str === 'string')
    const words = itemsToWords(items as never, viewport.height, isBold)
    const pageWords: PageWords = { num: n, width: viewport.width, height: viewport.height, words, source: 'text' }
    pages.push(pageWords)
    perPage.push({ page: pageWords, lines: pageLines(pageWords).lines })
  }

  return { pages, lines: stripRunningHeads(perPage), fonts: [...fonts] }
}

const normalize = (s: string) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

async function run(name: string) {
  const { pages, lines, fonts } = await extract(`${name}.pdf`)
  const { entries, strategy, stats } = assemble(lines)
  const want = expected[name] as { word: string; pos: string | null; meaning: string }[]

  console.log(`\n=== ${name}.pdf ===`)
  console.log(`pages ${pages.length}  words ${pages.reduce((n, p) => n + p.words.length, 0)}  lines ${lines.length}`)
  console.log(`fonts on page 1: ${fonts.join(', ')}`)
  console.log(`strategy: ${strategy} (${STRATEGY_LABEL[strategy]})`)
  console.log(`extracted ${stats.total} entries, expected ${want.length}; flagged ${stats.flagged}, out of order ${stats.outOfOrder}`)

  const byWord = new Map(entries.map((e) => [normalize(e.word), e]))
  let wordHits = 0
  let meaningHits = 0
  let posHits = 0
  const misses: string[] = []
  for (const w of want) {
    const got = byWord.get(normalize(w.word))
    if (!got) {
      misses.push(w.word)
      continue
    }
    wordHits++
    if (normalize(got.meaning) === normalize(w.meaning)) meaningHits++
    else misses.push(`${w.word}: meaning differs\n      want: ${w.meaning}\n      got:  ${got.meaning}`)
    if (!w.pos || got.pos === w.pos) posHits++
  }

  const pct = (n: number) => ((n / want.length) * 100).toFixed(1) + '%'
  console.log(`headwords ${wordHits}/${want.length} (${pct(wordHits)})`)
  console.log(`meanings exact ${meaningHits}/${want.length} (${pct(meaningHits)})`)
  console.log(`part of speech ${posHits}/${want.length} (${pct(posHits)})`)
  const extra = entries.filter((e) => !want.some((w) => normalize(w.word) === normalize(e.word)))
  if (extra.length) console.log(`spurious entries: ${extra.slice(0, 8).map((e) => e.word).join(', ')}${extra.length > 8 ? ' …' : ''}`)
  if (misses.length) {
    console.log(`\nfirst problems:`)
    for (const m of misses.slice(0, 6)) console.log('  - ' + m)
  }
  return { wordHits, meaningHits, want: want.length }
}

const only = process.argv[2]
for (const name of only ? [only] : ['dict-2col', 'wordlist']) {
  await run(name)
}
