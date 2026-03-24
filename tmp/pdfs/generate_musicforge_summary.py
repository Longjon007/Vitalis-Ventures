from __future__ import annotations

from pathlib import Path

import fitz
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
PDF_PATH = OUTPUT_DIR / "musicforge-app-summary.pdf"
PNG_PATH = TMP_DIR / "musicforge-app-summary-page-1.png"


TITLE = "MusicForge"
SUBTITLE = "Evidence-based app summary from repo contents"

WHAT_IT_IS = (
    "MusicForge is a web app for creating, organizing, sharing, and monetizing "
    "AI-generated music tracks. It combines prompt-driven generation, projects, "
    "credits, subscriptions, and public discovery in one workspace."
)

WHO_ITS_FOR = (
    "Primary persona: independent creators and small teams that need to move "
    "from a music idea to a playable draft quickly."
)

FEATURES = [
    "Prompt-based AI track generation with genre, BPM, key, duration, and mode controls "
    "(standard, variation, extend, remix).",
    "Project workspace with saved history, recent work, remix/retry flows, and auto-save.",
    "Credits-aware plans with Free, Pro, and Studio tiers.",
    "Stripe checkout, self-serve billing portal, and webhook-based subscription sync.",
    "Public explore feed, creator profiles, public track pages, and plays/likes/shares.",
    "Marketplace listing and purchase flow for creator-listed tracks.",
    "API-key-based POST /api/generate endpoint for external generation clients.",
]

ARCHITECTURE = [
    "Frontend: Vite + React + TypeScript SPA using React Router, Zustand state, "
    "Tailwind styling, and client analytics.",
    "Auth and data: Supabase Auth plus Postgres-backed app data including profiles, "
    "projects, and AI generations.",
    "Server workflows: Supabase Edge Functions handle run-generation, checkout, portal, "
    "and Stripe webhook logic with validation, CORS, auth, and rate limits.",
    "Data flow: user submits a generation in the UI -> frontend creates generation and "
    "credit records in Supabase -> run-generation calls Replicate and writes status/output "
    "back -> billing actions go to Stripe -> stripe-webhook syncs subscription and "
    "marketplace sale data to Supabase.",
]

RUN_STEPS = [
    "Copy .env.example to .env.local and set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, "
    "VITE_STRIPE_PUBLISHABLE_KEY, and VITE_APP_BASE_URL.",
    "Install dependencies with npm install.",
    "Start the dev server with npm run dev.",
]

RUN_NOTE = "Local Supabase CLI startup and edge-function secret bootstrap steps: Not found in repo."


PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 42
HEADER_HEIGHT = 78
COLUMN_GAP = 22
CONTENT_TOP = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT
CONTENT_BOTTOM = MARGIN
CONTENT_HEIGHT = CONTENT_TOP - CONTENT_BOTTOM
CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)
COLUMN_WIDTH = (CONTENT_WIDTH - COLUMN_GAP) / 2

BODY_FONT = "Helvetica"
BOLD_FONT = "Helvetica-Bold"
TITLE_FONT = "Helvetica-Bold"
TITLE_SIZE = 21
SUBTITLE_SIZE = 9
SECTION_SIZE = 10
BODY_SIZE = 8.7
BODY_LEADING = 11.0
SECTION_GAP = 8
BLOCK_GAP = 10
BULLET_GAP = 5

TEXT_COLOR = colors.HexColor("#1f2937")
MUTED_COLOR = colors.HexColor("#6b7280")
ACCENT_COLOR = colors.HexColor("#d4a853")
RULE_COLOR = colors.HexColor("#e5e7eb")
PANEL_COLOR = colors.HexColor("#f8fafc")


def wrap_text(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]

    for word in words[1:]:
        candidate = f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word

    lines.append(current)
    return lines


def draw_wrapped_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    *,
    font_name: str = BODY_FONT,
    font_size: float = BODY_SIZE,
    leading: float = BODY_LEADING,
    color=TEXT_COLOR,
) -> float:
    lines = wrap_text(text, font_name, font_size, max_width)
    text_obj = c.beginText()
    text_obj.setTextOrigin(x, y)
    text_obj.setFont(font_name, font_size)
    text_obj.setLeading(leading)
    text_obj.setFillColor(color)
    for line in lines:
        text_obj.textLine(line)
    c.drawText(text_obj)
    return y - (leading * len(lines))


def draw_section_heading(c: canvas.Canvas, label: str, x: float, y: float) -> float:
    c.setFillColor(ACCENT_COLOR)
    c.setFont(BOLD_FONT, SECTION_SIZE)
    c.drawString(x, y, label.upper())
    c.setStrokeColor(RULE_COLOR)
    c.setLineWidth(1)
    c.line(x, y - 4, x + COLUMN_WIDTH, y - 4)
    return y - 16


def draw_bullets(c: canvas.Canvas, items: list[str], x: float, y: float, max_width: float) -> float:
    bullet_width = 9
    text_width = max_width - bullet_width
    for item in items:
        lines = wrap_text(item, BODY_FONT, BODY_SIZE, text_width)
        c.setFillColor(ACCENT_COLOR)
        c.setFont(BOLD_FONT, BODY_SIZE)
        c.drawString(x, y, "-")
        text_obj = c.beginText()
        text_obj.setTextOrigin(x + bullet_width, y)
        text_obj.setFont(BODY_FONT, BODY_SIZE)
        text_obj.setLeading(BODY_LEADING)
        text_obj.setFillColor(TEXT_COLOR)
        for line in lines:
            text_obj.textLine(line)
        c.drawText(text_obj)
        y -= (BODY_LEADING * len(lines)) + BULLET_GAP
    return y


def draw_numbered_steps(c: canvas.Canvas, items: list[str], x: float, y: float, max_width: float) -> float:
    number_width = 12
    text_width = max_width - number_width
    for index, item in enumerate(items, start=1):
        lines = wrap_text(item, BODY_FONT, BODY_SIZE, text_width)
        c.setFillColor(ACCENT_COLOR)
        c.setFont(BOLD_FONT, BODY_SIZE)
        c.drawString(x, y, f"{index}.")
        text_obj = c.beginText()
        text_obj.setTextOrigin(x + number_width, y)
        text_obj.setFont(BODY_FONT, BODY_SIZE)
        text_obj.setLeading(BODY_LEADING)
        text_obj.setFillColor(TEXT_COLOR)
        for line in lines:
            text_obj.textLine(line)
        c.drawText(text_obj)
        y -= (BODY_LEADING * len(lines)) + BULLET_GAP
    return y


def build_pdf() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    c = canvas.Canvas(str(PDF_PATH), pagesize=letter)
    c.setTitle("MusicForge App Summary")
    c.setAuthor("OpenAI Codex")
    c.setSubject("One-page repo-based app summary")

    # Header panel
    header_y = PAGE_HEIGHT - MARGIN
    c.setFillColor(PANEL_COLOR)
    c.roundRect(MARGIN, header_y - HEADER_HEIGHT, CONTENT_WIDTH, HEADER_HEIGHT, 10, fill=1, stroke=0)
    c.setFillColor(ACCENT_COLOR)
    c.roundRect(MARGIN, header_y - HEADER_HEIGHT, 10, HEADER_HEIGHT, 10, fill=1, stroke=0)

    c.setFillColor(TEXT_COLOR)
    c.setFont(TITLE_FONT, TITLE_SIZE)
    c.drawString(MARGIN + 22, header_y - 28, TITLE)

    c.setFillColor(MUTED_COLOR)
    c.setFont(BODY_FONT, SUBTITLE_SIZE)
    c.drawString(MARGIN + 22, header_y - 44, SUBTITLE)
    c.drawString(MARGIN + 22, header_y - 58, "One page. Based only on repo evidence.")

    left_x = MARGIN
    right_x = MARGIN + COLUMN_WIDTH + COLUMN_GAP
    left_y = CONTENT_TOP
    right_y = CONTENT_TOP

    left_y = draw_section_heading(c, "What It Is", left_x, left_y)
    left_y = draw_wrapped_text(c, WHAT_IT_IS, left_x, left_y, COLUMN_WIDTH)
    left_y -= SECTION_GAP

    left_y = draw_section_heading(c, "Who It's For", left_x, left_y)
    left_y = draw_wrapped_text(c, WHO_ITS_FOR, left_x, left_y, COLUMN_WIDTH)
    left_y -= SECTION_GAP

    left_y = draw_section_heading(c, "How To Run", left_x, left_y)
    left_y = draw_numbered_steps(c, RUN_STEPS, left_x, left_y, COLUMN_WIDTH)
    left_y -= 2
    left_y = draw_wrapped_text(
        c,
        RUN_NOTE,
        left_x,
        left_y,
        COLUMN_WIDTH,
        color=MUTED_COLOR,
    )

    right_y = draw_section_heading(c, "What It Does", right_x, right_y)
    right_y = draw_bullets(c, FEATURES, right_x, right_y, COLUMN_WIDTH)
    right_y -= 2

    right_y = draw_section_heading(c, "How It Works", right_x, right_y)
    right_y = draw_bullets(c, ARCHITECTURE, right_x, right_y, COLUMN_WIDTH)

    min_y = min(left_y, right_y)
    if min_y < CONTENT_BOTTOM + 4:
        raise RuntimeError(
            f"Content overflowed the page layout. Lowest y={min_y:.2f}, minimum={CONTENT_BOTTOM + 4:.2f}."
        )

    c.setStrokeColor(RULE_COLOR)
    c.setLineWidth(1)
    c.line(MARGIN, CONTENT_BOTTOM - 4, MARGIN + CONTENT_WIDTH, CONTENT_BOTTOM - 4)
    c.setFillColor(MUTED_COLOR)
    c.setFont(BODY_FONT, 7.8)
    c.drawString(MARGIN, CONTENT_BOTTOM - 18, "Generated from repository files only.")

    c.showPage()
    c.save()


def validate_pdf() -> None:
    reader = PdfReader(str(PDF_PATH))
    if len(reader.pages) != 1:
        raise RuntimeError(f"Expected a single-page PDF, found {len(reader.pages)} pages.")


def render_preview() -> None:
    doc = fitz.open(PDF_PATH)
    try:
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
        pix.save(str(PNG_PATH))
    finally:
        doc.close()


def main() -> None:
    build_pdf()
    validate_pdf()
    render_preview()
    print(PDF_PATH)
    print(PNG_PATH)


if __name__ == "__main__":
    main()
