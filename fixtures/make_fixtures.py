"""Generate realistic dictionary PDFs to test the importer against.

Entries come from the app's own starter pack, so expected.json is ground truth
by construction rather than by transcription.
"""

import json
import math
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib.pagesizes import A5
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas as rl_canvas

HERE = Path(__file__).resolve().parent
STARTER = HERE.parent / "src" / "data" / "starter.ts"

# A5: a pocket dictionary, so 100 entries spread over several pages at a
# realistic density instead of all landing on one sheet.
PAGE_W, PAGE_H = A5
MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM = 38, 60, 45
GUTTER = 22
COL_W = (PAGE_W - 2 * MARGIN_X - GUTTER) / 2
INDENT = 10
LEADING = 11.5
HEAD_FONT, HEAD_SIZE = "Times-Bold", 10
POS_FONT, POS_SIZE = "Times-Italic", 9
BODY_FONT, BODY_SIZE = "Times-Roman", 9.5


def load_entries():
    text = STARTER.read_text(encoding="utf-8")
    block = re.search(r"const TSV = `\n(.*?)\n`", text, re.S).group(1)
    out = []
    for line in block.strip().split("\n"):
        word, pos, meaning = line.split("\t")
        out.append({"word": word, "pos": pos, "meaning": meaning})
    return out


def wrap(parts, width, first_width):
    """Wrap (text, font, size) runs into lines, hyphenating long words.

    parts are laid out as a single stream so the headword, its part of speech
    and the definition share the first line, the way a real dictionary sets it.
    """
    lines, line, used, limit = [], [], 0.0, first_width
    for text, font, size in parts:
        for word in text.split(" "):
            if not word:
                continue
            w = pdfmetrics.stringWidth(word, font, size)
            space = pdfmetrics.stringWidth(" ", font, size) if line else 0
            if used + space + w <= limit:
                line.append((word, font, size))
                used += space + w
                continue
            # Break a long word across the line with a hyphen, as typesetting does.
            room = limit - used - space - pdfmetrics.stringWidth("-", font, size)
            if len(word) > 8 and room > size * 2:
                cut = len(word)
                while cut > 3 and pdfmetrics.stringWidth(word[:cut], font, size) > room:
                    cut -= 1
                if cut >= 3:
                    line.append((word[:cut] + "-", font, size))
                    lines.append(line)
                    line, used, limit = [], 0.0, width
                    word = word[cut:]
                    w = pdfmetrics.stringWidth(word, font, size)
            if line:
                lines.append(line)
            line, used, limit = [(word, font, size)], w, width
    if line:
        lines.append(line)
    return lines


def layout(entries, columns_per_page=2, max_pages=99):
    """Flow entries into columns, recording where each one landed."""
    col_lines = int((PAGE_H - MARGIN_TOP - MARGIN_BOTTOM) / LEADING)
    pages, page, column, used = [], [], [], 0
    placed = []

    for entry in entries:
        parts = [
            (entry["word"], HEAD_FONT, HEAD_SIZE),
            (abbrev(entry["pos"]), POS_FONT, POS_SIZE),
            (entry["meaning"], BODY_FONT, BODY_SIZE),
        ]
        lines = wrap(parts, COL_W - INDENT, COL_W)
        for i, line in enumerate(lines):
            if used >= col_lines:
                page.append(column)
                column, used = [], 0
                if len(page) == columns_per_page:
                    pages.append(page)
                    page = []
                    if len(pages) == max_pages:
                        return pages, placed
            column.append((line, INDENT if i else 0))
            used += 1
        placed.append(entry)

    if column:
        page.append(column)
    if page:
        pages.append(page)
    return pages, placed


ABBREV = {"noun": "n.", "verb": "v.", "adjective": "adj.", "adverb": "adv."}


def abbrev(pos):
    return ABBREV.get(pos, pos)


def headwords_on(page_columns):
    words = []
    for column in page_columns:
        for line, indent in column:
            if indent == 0 and line:
                words.append(line[0][0].strip("-"))
    return words


def draw_dictionary(path, pages):
    c = rl_canvas.Canvas(str(path), pagesize=A5)
    for number, page_columns in enumerate(pages, start=1):
        words = headwords_on(page_columns)
        if words:
            c.setFont("Times-Italic", 9)
            c.drawString(MARGIN_X, PAGE_H - 45, words[0])
            c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 45, words[-1])
            c.setLineWidth(0.4)
            c.line(MARGIN_X, PAGE_H - 52, PAGE_W - MARGIN_X, PAGE_H - 52)

        for ci, column in enumerate(page_columns):
            x0 = MARGIN_X + ci * (COL_W + GUTTER)
            y = PAGE_H - MARGIN_TOP
            for line, indent in column:
                x = x0 + indent
                for word, font, size in line:
                    c.setFont(font, size)
                    c.drawString(x, y, word)
                    x += pdfmetrics.stringWidth(word, font, size)
                    x += pdfmetrics.stringWidth(" ", font, size)
                y -= LEADING

        c.setFont("Times-Roman", 9)
        c.drawCentredString(PAGE_W / 2, 32, str(number))
        c.showPage()
    c.save()


def draw_wordlist(path, entries):
    c = rl_canvas.Canvas(str(path), pagesize=A5)
    width = PAGE_W - 2 * MARGIN_X - 26
    y = PAGE_H - MARGIN_TOP
    number = 1
    page = 1
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN_X, y, "Vocabulary list - section one")
    y -= 28

    for i, entry in enumerate(entries, start=1):
        text = f"{entry['word']} \u2013 {entry['meaning']}"
        lines = wrap([(text, "Helvetica", 10)], width, width)
        if y - LEADING * len(lines) < MARGIN_BOTTOM:
            c.setFont("Helvetica", 9)
            c.drawCentredString(PAGE_W / 2, 32, str(page))
            c.showPage()
            page += 1
            y = PAGE_H - MARGIN_TOP
        c.setFont("Helvetica", 10)
        c.drawString(MARGIN_X, y, f"{i}.")
        for j, line in enumerate(lines):
            x = MARGIN_X + 26
            for word, font, size in line:
                c.setFont(font, size)
                c.drawString(x, y, word)
                x += pdfmetrics.stringWidth(word + " ", font, size)
            y -= LEADING
        y -= 3
        number += 1

    c.setFont("Helvetica", 9)
    c.drawCentredString(PAGE_W / 2, 32, str(page))
    c.save()


def draw_scanned(path, entries, dpi=200):
    """An image-only page: no text layer, so the importer must OCR it."""
    scale = dpi / 72
    W, H = int(PAGE_W * scale), int(PAGE_H * scale)
    img = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(img)
    regular = ImageFont.truetype("C:/Windows/Fonts/times.ttf", int(10.5 * scale))
    bold = ImageFont.truetype("C:/Windows/Fonts/timesbd.ttf", int(11 * scale))
    italic = ImageFont.truetype("C:/Windows/Fonts/timesi.ttf", int(10 * scale))

    col_w = (W - 2 * int(MARGIN_X * scale) - int(GUTTER * scale)) / 2
    leading = int(15 * scale)
    x_cols = [int(MARGIN_X * scale), int(MARGIN_X * scale + col_w + GUTTER * scale)]
    y = int(MARGIN_TOP * scale)
    col = 0
    placed = []

    def text_width(text, font):
        return d.textlength(text, font=font)

    for entry in entries:
        runs = [(entry["word"], bold), (abbrev(entry["pos"]), italic)]
        runs += [(w, regular) for w in entry["meaning"].split(" ")]
        lines, line, used = [], [], 0.0
        for text, font in runs:
            w = text_width(text + " ", font)
            limit = col_w if not lines else col_w - 14 * scale
            if used + w > limit and line:
                lines.append(line)
                line, used = [], 0.0
            line.append((text, font))
            used += w
        if line:
            lines.append(line)

        if y + leading * len(lines) > H - int(MARGIN_BOTTOM * scale):
            col += 1
            y = int(MARGIN_TOP * scale)
            if col > 1:
                break
        for i, line in enumerate(lines):
            x = x_cols[col] + (int(14 * scale) if i else 0)
            for text, font in line:
                d.text((x, y), text, font=font, fill=20)
                x += text_width(text + " ", font)
            y += leading
        placed.append(entry)

    d.text((int(MARGIN_X * scale), int(45 * scale)), placed[0]["word"], font=italic, fill=60)
    d.text((W // 2, H - int(40 * scale)), "1", font=regular, fill=60)

    # Make it look like a real scan: slight skew, soft focus, sensor noise.
    img = img.rotate(0.4, resample=Image.BICUBIC, fillcolor=255, expand=False)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    random.seed(7)
    pixels = img.load()
    for _ in range(int(W * H * 0.0012)):
        x, y2 = random.randrange(W), random.randrange(H)
        pixels[x, y2] = max(0, min(255, pixels[x, y2] + random.randint(-70, 40)))
    img = Image.eval(img, lambda v: int(245 * (v / 255) ** 1.05) + 6)
    img.convert("RGB").save(path, "PDF", resolution=dpi)
    # Also dump the page as-is and straightened, so the OCR pipeline can be
    # measured with and without deskewing without needing a browser canvas.
    img.save(HERE / "scanned-skewed.png")
    img.rotate(-0.4, resample=Image.BICUBIC, fillcolor=255, expand=False).save(HERE / "scanned-deskewed.png")
    return placed


def main():
    entries = load_entries()
    pages, placed = layout(entries)
    draw_dictionary(HERE / "dict-2col.pdf", pages)

    wordlist_entries = entries[:34]
    draw_wordlist(HERE / "wordlist.pdf", wordlist_entries)

    scanned_placed = draw_scanned(HERE / "scanned.pdf", entries[:16])

    expected = {
        "dict-2col": placed,
        "wordlist": [{"word": e["word"], "pos": None, "meaning": e["meaning"]} for e in wordlist_entries],
        "scanned": scanned_placed,
    }
    (HERE / "expected.json").write_text(json.dumps(expected, indent=2), encoding="utf-8")

    print(f"dict-2col.pdf  {len(pages)} pages, {len(placed)} entries")
    print(f"wordlist.pdf   {len(wordlist_entries)} entries")
    print(f"scanned.pdf    {len(scanned_placed)} entries, image only")
    print(f"math check     {math.floor(len(placed) / max(len(pages), 1))} entries per page")


if __name__ == "__main__":
    main()

