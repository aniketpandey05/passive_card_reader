/**
 * Runs the OCR half of the pipeline in Node, on the scanned fixture both
 * crooked and straightened, to measure what deskewing actually buys.
 *
 *   npm run check:ocr
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createWorker } from 'tesseract.js'
import type { Line, PageWords, Word } from '../src/lib/layout.ts'
import { pageLines, stripRunningHeads } from '../src/lib/layout.ts'
import { STRATEGY_LABEL, assemble } from '../src/lib/dict.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const expected = JSON.parse(readFileSync(join(HERE, 'expected.json'), 'utf8'))['scanned'] as {
  word: string
  meaning: string
}[]

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

/** Same mapping as src/lib/ocr.ts, minus the browser canvas. */
function wordsFrom(data: Awaited<ReturnType<Awaited<ReturnType<typeof createWorker>>['recognize']>>['data'], scale: number): Word[] {
  const words: Word[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = word.text?.trim()
          if (!text) continue
          const { x0, x1, y0, y1 } = word.bbox
          words.push({ str: text, x: x0 / scale, y: y1 / scale, w: (x1 - x0) / scale, size: (y1 - y0) / scale || 10, bold: false })
        }
      }
    }
  }
  return words
}

const worker = await createWorker('eng', 1)

async function run(file: string, label: string) {
  const { data } = await worker.recognize(join(HERE, file), {}, { blocks: true, text: false })
  const scale = 200 / 72 // the fixture is rendered at 200 dpi
  const words = wordsFrom(data, scale)
  const page: PageWords = { num: 1, width: 1167 / scale, height: 1654 / scale, words, source: 'ocr' }
  const lines: Line[] = stripRunningHeads([{ page, lines: pageLines(page).lines }])
  const { entries, strategy, stats } = assemble(lines)

  const got = new Map(entries.map((e) => [normalize(e.word), e]))
  let exact = 0
  let found = 0
  for (const want of expected) {
    const hit = got.get(normalize(want.word))
    if (!hit) continue
    found++
    if (normalize(hit.meaning) === normalize(want.meaning)) exact++
  }

  console.log(`\n--- ${label} ---`)
  console.log(`strategy: ${strategy} (${STRATEGY_LABEL[strategy]})`)
  console.log(`entries ${entries.length} (expected ${expected.length}), flagged ${stats.flagged}`)
  console.log(`headwords found ${found}/${expected.length}, meanings exact ${exact}/${expected.length}`)
  const runOns = entries.filter((e) => e.flags.includes('long'))
  if (runOns.length) console.log(`run-ons flagged: ${runOns.map((e) => e.word).join(', ')}`)

  for (const want of expected) {
    const hit = got.get(normalize(want.word))
    if (!hit) {
      console.log(`  MISSING  ${want.word}`)
    } else if (normalize(hit.meaning) !== normalize(want.meaning)) {
      console.log(`  DIFFERS  ${hit.word}${hit.flags.length ? ' [' + hit.flags.join(',') + ']' : ' [not flagged]'}`)
      console.log(`           got: ${hit.meaning}`)
    }
  }
  return { entries: entries.length, found, exact }
}

const crooked = await run('scanned-skewed.png', 'as scanned (0.4 degrees off)')
const straight = await run('scanned-deskewed.png', 'after deskewing')
await worker.terminate()

console.log(
  `\ndeskew effect: entries ${crooked.entries} -> ${straight.entries}, ` +
    `headwords ${crooked.found} -> ${straight.found}, exact meanings ${crooked.exact} -> ${straight.exact}`,
)
