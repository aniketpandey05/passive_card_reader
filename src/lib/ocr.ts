import { createWorker } from 'tesseract.js'
import type { PageWords, Word } from './layout'

/**
 * OCR for pages with no text layer, using Tesseract compiled to WebAssembly.
 * It runs in the browser: free, open source, and the PDF never leaves the
 * device. The cost is speed - a few seconds per page - so the UI works in page
 * ranges and shows progress.
 */

type OcrWorker = Awaited<ReturnType<typeof createWorker>>

let workerPromise: Promise<OcrWorker> | null = null

export function ocrReady(): boolean {
  return workerPromise !== null
}

async function getWorker(onStatus?: (status: string, progress: number) => void): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: (m) => onStatus?.(m.status, m.progress),
    })
  }
  return workerPromise
}

export async function terminateOcr(): Promise<void> {
  const worker = workerPromise
  workerPromise = null
  if (worker) await (await worker).terminate()
}

/**
 * Estimate page skew by projection profile: when lines of text are level, the
 * ink per row is spiky (dense rows of text, empty rows between), so the row
 * sums have maximum variance. Shearing by tan(angle) is equivalent to rotating
 * for this purpose and far cheaper than rotating 21 times.
 */
export function estimateSkew(canvas: HTMLCanvasElement, maxDegrees = 3, stepDegrees = 0.2): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0

  // Work small: skew is a global property and this runs per page.
  const scale = Math.min(1, 700 / canvas.width)
  const w = Math.max(1, Math.round(canvas.width * scale))
  const h = Math.max(1, Math.round(canvas.height * scale))
  const small = document.createElement('canvas')
  small.width = w
  small.height = h
  const sctx = small.getContext('2d', { willReadFrequently: true })
  if (!sctx) return 0
  sctx.drawImage(canvas, 0, 0, w, h)
  const data = sctx.getImageData(0, 0, w, h).data

  // 1 where there is ink.
  const ink = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) ink[p] = data[i] < 128 ? 1 : 0

  let bestAngle = 0
  let bestScore = -1
  for (let deg = -maxDegrees; deg <= maxDegrees + 1e-9; deg += stepDegrees) {
    const slope = Math.tan((deg * Math.PI) / 180)
    const rows = new Float64Array(h)
    for (let x = 0; x < w; x++) {
      const shift = Math.round(slope * (x - w / 2))
      for (let y = 0; y < h; y++) {
        if (!ink[y * w + x]) continue
        const target = y + shift
        if (target >= 0 && target < h) rows[target]++
      }
    }
    let mean = 0
    for (let y = 0; y < h; y++) mean += rows[y]
    mean /= h
    let variance = 0
    for (let y = 0; y < h; y++) variance += (rows[y] - mean) ** 2
    if (variance > bestScore) {
      bestScore = variance
      bestAngle = deg
    }
  }
  return bestAngle
}

function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d', { willReadFrequently: true })
  if (!ctx) return canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return out
}

export interface PreprocessOptions {
  binarize?: boolean
  deskew?: boolean
}

/**
 * Image preprocessing before OCR. Scans arrive crooked, with uneven lighting
 * and weak contrast. Straightening matters for more than legibility: entry
 * detection reads the left margin of each column, and on a page tilted by even
 * half a degree those margins drift enough to hide where entries begin.
 */
export function preprocess(canvas: HTMLCanvasElement, opts: PreprocessOptions = {}): HTMLCanvasElement {
  const binarize = opts.binarize ?? true
  let working = canvas
  const ctx = working.getContext('2d', { willReadFrequently: true })
  if (!ctx) return working
  const image = ctx.getImageData(0, 0, working.width, working.height)
  const px = image.data

  // Grayscale, keeping a histogram for the steps below.
  const histogram = new Array(256).fill(0)
  const grey = new Uint8ClampedArray(px.length / 4)
  for (let i = 0, g = 0; i < px.length; i += 4, g++) {
    const value = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0
    grey[g] = value
    histogram[value]++
  }

  // Contrast stretch between the 2nd and 98th percentile, so a grey scan of
  // off-white paper becomes something closer to black on white.
  const total = grey.length
  let low = 0
  let high = 255
  let seen = 0
  for (let v = 0; v < 256; v++) {
    seen += histogram[v]
    if (seen >= total * 0.02) {
      low = v
      break
    }
  }
  seen = 0
  for (let v = 255; v >= 0; v--) {
    seen += histogram[v]
    if (seen >= total * 0.02) {
      high = v
      break
    }
  }
  const span = Math.max(high - low, 1)

  let threshold = 128
  if (binarize) {
    // Otsu: pick the cut that best separates ink from paper.
    let sum = 0
    for (let v = 0; v < 256; v++) sum += v * histogram[v]
    let sumBackground = 0
    let weightBackground = 0
    let best = 0
    for (let v = 0; v < 256; v++) {
      weightBackground += histogram[v]
      if (!weightBackground) continue
      const weightForeground = total - weightBackground
      if (!weightForeground) break
      sumBackground += v * histogram[v]
      const meanBackground = sumBackground / weightBackground
      const meanForeground = (sum - sumBackground) / weightForeground
      const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2
      if (between > best) {
        best = between
        threshold = v
      }
    }
  }

  for (let i = 0, g = 0; i < px.length; i += 4, g++) {
    const stretched = Math.min(255, Math.max(0, ((grey[g] - low) * 255) / span))
    const value = binarize ? (grey[g] > threshold ? 255 : 0) : stretched
    px[i] = px[i + 1] = px[i + 2] = value
    px[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)

  if (opts.deskew ?? true) {
    const angle = estimateSkew(working)
    // Below a tenth of a degree, resampling costs more than the tilt does.
    if (Math.abs(angle) >= 0.1) working = rotateCanvas(working, -angle)
  }
  return working
}

export interface OcrOptions extends PreprocessOptions {
  onStatus?: (status: string, progress: number) => void
}

/** Recognize one rendered page, returning words in page units. */
export async function ocrPage(
  canvas: HTMLCanvasElement,
  scale: number,
  pageNum: number,
  opts: OcrOptions = {},
): Promise<PageWords> {
  const worker = await getWorker(opts.onStatus)
  const prepared = preprocess(canvas, opts)
  const { data } = await worker.recognize(prepared, {}, { blocks: true, text: false })

  const words: Word[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = word.text?.trim()
          if (!text) continue
          const { x0, x1, y0, y1 } = word.bbox
          words.push({
            str: text,
            x: x0 / scale,
            y: y1 / scale, // bottom of the box is close enough to a baseline
            w: (x1 - x0) / scale,
            size: (y1 - y0) / scale || 10,
            // OCR bold detection is unreliable, so entry detection falls back
            // to indentation and separators for scanned pages.
            bold: false,
          })
        }
      }
    }
  }

  return {
    num: pageNum,
    width: canvas.width / scale,
    height: canvas.height / scale,
    words,
    source: 'ocr',
  }
}
