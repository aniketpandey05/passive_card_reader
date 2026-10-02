import type { Word } from './layout'

/**
 * The pure half of PDF text extraction: no pdf.js import, so this runs in Node
 * for tests as well as in the browser.
 */

export interface RawTextItem {
  str: string
  /** [a, b, c, d, e, f] - e/f are x and the baseline y, measured from the bottom. */
  transform: number[]
  width: number
  height: number
  fontName: string
}

/** Font names arrive as things like "ABCDEE+Georgia-Bold" or "Times-BoldItalic". */
export function fontLooksBold(name: string): boolean {
  return /bold|black|heavy|semib|demib/i.test(name) || /[-_](b|bd)(it(al)?)?$/i.test(name)
}

export function itemsToWords(items: RawTextItem[], pageHeight: number, isBold: (fontName: string) => boolean): Word[] {
  const words: Word[] = []
  for (const item of items) {
    if (!item.str.trim()) continue
    const t = item.transform
    const size = Math.hypot(t[1], t[3]) || Math.abs(t[3]) || item.height || 10
    words.push({
      str: item.str,
      x: t[4],
      y: pageHeight - t[5], // flip to top-down
      w: item.width,
      size,
      bold: isBold(item.fontName),
    })
  }
  return words
}

/** Below this, a page is almost certainly an image that needs OCR. */
export const TEXT_LAYER_MIN_WORDS = 12
