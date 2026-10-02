/**
 * Page layout reconstruction, shared by both sources of text.
 *
 * pdf.js (text layer) and Tesseract (OCR) both hand back positioned words, so
 * everything downstream - columns, running heads, hyphenation, entries - is
 * written once here against one normalized shape.
 *
 * Coordinates are top-down: y grows toward the bottom of the page, and y is the
 * text baseline, which is what line clustering wants.
 */

export interface Word {
  str: string
  x: number
  y: number
  w: number
  /** Font size in page units. */
  size: number
  bold: boolean
}

export interface PageWords {
  num: number
  width: number
  height: number
  words: Word[]
  source: 'text' | 'ocr'
}

export interface Line {
  page: number
  column: number
  /** Baseline, top-down. */
  y: number
  x0: number
  x1: number
  size: number
  /** How many leading words are bold - the usual headword signal. */
  boldRun: number
  text: string
  words: Word[]
}

export interface Column {
  x0: number
  x1: number
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Columns show up as vertical bands that almost no word overlaps. Counting
 * across every word on the page means a one-off gap inside a single line is
 * filled in by its neighbours, and only real gutters stay empty.
 */
export function detectColumns(page: PageWords, forced?: number): Column[] {
  const full: Column[] = [{ x0: 0, x1: page.width }]
  if (forced === 1) return full
  if (!page.words.length) return full

  const binWidth = Math.max(page.width / 400, 1)
  const bins = new Array(Math.ceil(page.width / binWidth)).fill(0)
  for (const w of page.words) {
    const from = Math.max(0, Math.floor(w.x / binWidth))
    const to = Math.min(bins.length - 1, Math.floor((w.x + w.w) / binWidth))
    for (let i = from; i <= to; i++) bins[i]++
  }

  // A running head spans the gutter, so "empty" has to tolerate a few crossings.
  const peak = Math.max(...bins)
  const emptyAt = (i: number) => bins[i] <= Math.max(1, peak * 0.02)

  const minGutter = Math.max(page.width * 0.025, 6)
  const gaps: Column[] = []
  let runStart: number | null = null
  for (let i = 0; i < bins.length; i++) {
    if (emptyAt(i)) {
      if (runStart === null) runStart = i
    } else if (runStart !== null) {
      gaps.push({ x0: runStart * binWidth, x1: i * binWidth })
      runStart = null
    }
  }
  if (runStart !== null) gaps.push({ x0: runStart * binWidth, x1: bins.length * binWidth })

  // Margins are gaps too; only interior ones split columns.
  const left = bins.findIndex((_, i) => !emptyAt(i))
  if (left === -1) return full
  let right = bins.length - 1
  while (right > left && emptyAt(right)) right--

  const gutters = gaps.filter((g) => g.x0 > left * binWidth && g.x1 < right * binWidth && g.x1 - g.x0 >= minGutter)

  const bounds = [left * binWidth, ...gutters.flatMap((g) => [g.x0, g.x1]), (right + 1) * binWidth]
  const columns: Column[] = []
  for (let i = 0; i < bounds.length; i += 2) columns.push({ x0: bounds[i], x1: bounds[i + 1] })

  if (forced && forced > 1) {
    // The user overrode detection: cut the ink area into equal columns.
    const x0 = left * binWidth
    const span = (right + 1) * binWidth - x0
    return Array.from({ length: forced }, (_, i) => ({ x0: x0 + (span * i) / forced, x1: x0 + (span * (i + 1)) / forced }))
  }
  if (!columns.length || columns.length > 4) return full
  return mergeSlivers(columns, page.width)
}

/**
 * A numbered list leaves a narrow strip of "1." "2." "3." with a clear gap after
 * it, which looks exactly like a gutter. Real text columns are a big fraction of
 * the page, so anything thin gets folded back into its neighbour.
 */
function mergeSlivers(columns: Column[], pageWidth: number): Column[] {
  if (columns.length < 2) return columns
  const minWidth = Math.max(pageWidth * 0.12, 40)
  const out = columns.map((c) => ({ ...c }))
  for (let i = 0; i < out.length; i++) {
    if (out[i].x1 - out[i].x0 >= minWidth) continue
    if (i + 1 < out.length) {
      out[i + 1].x0 = out[i].x0
      out.splice(i, 1)
      i--
    } else if (i > 0) {
      out[i - 1].x1 = out[i].x1
      out.splice(i, 1)
      i--
    }
  }
  return out.length ? out : columns
}

/**
 * Stitch words back into text. Whether a gap is a space depends on the font
 * size, since PDFs position each run rather than storing spaces reliably.
 */
export function joinWords(words: Word[]): string {
  let text = ''
  words.forEach((w, i) => {
    if (i > 0) {
      const prev = words[i - 1]
      const gap = w.x - (prev.x + prev.w)
      const alreadySpaced = /\s$/.test(prev.str) || /^\s/.test(w.str)
      if (!alreadySpaced && gap > w.size * 0.18) text += ' '
    }
    text += w.str
  })
  return text.replace(/\s+/g, ' ').trim()
}

/** Group a column's words into baseline-aligned lines, left to right. */
function clusterLines(words: Word[], page: PageWords, column: number): Line[] {
  if (!words.length) return []
  const sizes = words.map((w) => w.size).filter(Boolean)
  const tolerance = Math.max(median(sizes) * 0.45, 1.5)

  const byY = [...words].sort((a, b) => a.y - b.y || a.x - b.x)
  const groups: Word[][] = []
  let current: Word[] = [byY[0]]
  for (let i = 1; i < byY.length; i++) {
    if (Math.abs(byY[i].y - current[current.length - 1].y) <= tolerance) current.push(byY[i])
    else {
      groups.push(current)
      current = [byY[i]]
    }
  }
  groups.push(current)

  return groups.map((group) => {
    const ordered = [...group].sort((a, b) => a.x - b.x)
    const text = joinWords(ordered)
    let boldRun = 0
    while (boldRun < ordered.length && ordered[boldRun].bold) boldRun++
    return {
      page: page.num,
      column,
      y: median(ordered.map((w) => w.y)),
      x0: Math.min(...ordered.map((w) => w.x)),
      x1: Math.max(...ordered.map((w) => w.x + w.w)),
      size: median(ordered.map((w) => w.size)),
      boldRun,
      text: text.replace(/\s+/g, ' ').trim(),
      words: ordered,
    }
  })
}

/** Lines of one page, in reading order: column by column, top to bottom. */
export function pageLines(page: PageWords, forcedColumns?: number): { lines: Line[]; columns: Column[] } {
  const columns = detectColumns(page, forcedColumns)
  const lines: Line[] = []
  columns.forEach((col, ci) => {
    const inside = page.words.filter((w) => {
      const center = w.x + w.w / 2
      const isLast = ci === columns.length - 1
      return center >= col.x0 && (isLast ? center <= col.x1 : center < col.x1)
    })
    lines.push(...clusterLines(inside, page, ci))
  })
  return { lines: lines.filter((l) => l.text), columns }
}

const PAGE_NUMBER = /^[\s|[\]()-]*(?:page\s*)?[ivxlcdm\d]{1,6}[\s|[\]()-]*$/i

/**
 * Drop running heads and footers.
 *
 * Guide words change on every page, so matching text is useless, and margins
 * vary too much for a fixed band. What a running head reliably is: the topmost
 * row on the page, far short of the column width, repeating across pages. Body
 * text fills its column; a header never does.
 */
export function stripRunningHeads(pages: { page: PageWords; lines: Line[] }[]): Line[] {
  const total = pages.length

  /** The topmost (or bottommost) row of a page, across all its columns. */
  const edgeRow = (lines: Line[], atTop: boolean): Line[] => {
    if (!lines.length) return []
    const sizes = median(lines.map((l) => l.size)) || 10
    const edge = atTop ? Math.min(...lines.map((l) => l.y)) : Math.max(...lines.map((l) => l.y))
    return lines.filter((l) => Math.abs(l.y - edge) <= sizes * 0.8)
  }

  const isShort = (line: Line, lines: Line[]): boolean => {
    const widest = Math.max(...lines.map((l) => l.x1 - l.x0), 1)
    return (line.x1 - line.x0) / widest < 0.55 || line.text.length < 40
  }

  const candidates = (atTop: boolean) =>
    pages.map(({ page, lines }) => {
      const band = atTop ? lines.filter((l) => l.y <= page.height * 0.16) : lines.filter((l) => l.y >= page.height * 0.86)
      const row = edgeRow(band, atTop)
      if (!row.length) return []
      return row.every((l) => isShort(l, lines)) ? row : []
    })

  const topRows = candidates(true)
  const bottomRows = candidates(false)
  // With only a page or two there is no repetition to learn from, so nothing
  // but an unmistakable page number is dropped.
  const dropTop = total >= 3 && topRows.filter((r) => r.length).length / total >= 0.6
  const dropBottom = total >= 3 && bottomRows.filter((r) => r.length).length / total >= 0.6

  const doomed = new Set<Line>()
  if (dropTop) topRows.flat().forEach((l) => doomed.add(l))
  if (dropBottom) bottomRows.flat().forEach((l) => doomed.add(l))

  const kept: Line[] = []
  for (const { page, lines } of pages) {
    for (const line of lines) {
      if (doomed.has(line)) continue
      const inMargin = line.y <= page.height * 0.16 || line.y >= page.height * 0.86
      if (inMargin && PAGE_NUMBER.test(line.text)) continue
      kept.push(line)
    }
  }
  return kept
}

/**
 * Join a line to the next. A trailing hyphen before a lowercase continuation is
 * a word broken across lines, so the hyphen goes; everything else gets a space.
 */
export function joinLines(a: string, b: string): string {
  if (/[-‐­]$/.test(a) && /^[a-z]/.test(b)) return a.replace(/[-‐­]$/, '') + b
  return a + ' ' + b
}
