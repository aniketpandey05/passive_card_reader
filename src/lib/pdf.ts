import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PageWords } from './layout'
import type { RawTextItem } from './pdfsource'
import { fontLooksBold, itemsToWords } from './pdfsource'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface OpenedPdf {
  doc: PDFDocumentProxy
  /** Tears down the pdf.js worker as well as the document. */
  close: () => Promise<void>
}

export async function openPdf(data: ArrayBuffer): Promise<OpenedPdf> {
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise
  return { doc, close: () => task.destroy() }
}

/** Words from a page's text layer. Empty when the page is a scan. */
export async function extractPage(doc: PDFDocumentProxy, num: number): Promise<PageWords> {
  const page = await doc.getPage(num)
  const viewport = page.getViewport({ scale: 1 })

  // Rendering the operator list is what resolves real font names into
  // commonObjs, and the font name is where the bold flag lives - which is the
  // strongest headword signal a dictionary page has.
  try {
    await page.getOperatorList()
  } catch {
    // Font names just stay unresolved; detection falls back to indentation.
  }

  const content = await page.getTextContent()
  const resolved = new Map<string, boolean>()
  const isBold = (fontName: string): boolean => {
    const hit = resolved.get(fontName)
    if (hit !== undefined) return hit
    let name = ''
    try {
      if (page.commonObjs.has(fontName)) {
        const font = page.commonObjs.get(fontName) as { name?: string } | undefined
        name = font?.name ?? ''
      }
    } catch {
      name = ''
    }
    if (!name) name = content.styles?.[fontName]?.fontFamily ?? fontName
    const bold = fontLooksBold(name)
    resolved.set(fontName, bold)
    return bold
  }

  const items = content.items.filter((i): i is TextItem => 'str' in i) as unknown as RawTextItem[]
  const words = itemsToWords(items, viewport.height, isBold)
  page.cleanup()

  return { num, width: viewport.width, height: viewport.height, words, source: 'text' }
}

export interface RenderedPage {
  canvas: HTMLCanvasElement
  /** Pixels per page unit, so OCR boxes can be mapped back to page coordinates. */
  scale: number
}

/** Rasterize a page for OCR. ~1800px wide lands around 200-250 DPI for A4. */
export async function renderPage(doc: PDFDocumentProxy, num: number, targetWidth = 1800): Promise<RenderedPage> {
  const page = await doc.getPage(num)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(Math.max(targetWidth / base.width, 1), 4)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not get a 2D canvas context.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // "print" intent, not "display": display rendering is driven by
  // requestAnimationFrame, which never fires while the tab is in the
  // background, so an import would stall the moment the user switched tabs.
  await page.render({ canvas, canvasContext: ctx, viewport, intent: 'print' }).promise
  page.cleanup()
  return { canvas, scale }
}
