import { jsPDF } from 'jspdf';
import { autoTable, type RowInput, type Styles, type UserOptions } from 'jspdf-autotable';
import {
  ACCENT,
  BAND,
  CONTENT_WIDTH,
  FAINT,
  INK,
  LINE,
  LINE_STRONG,
  MARGIN,
  MUTED,
  ON_BAND,
  ON_BAND_MUTED,
  PAGE,
  SANS,
  SECONDARY,
  SERIF,
  SUNKEN,
  type Rgb,
} from './theme';

/**
 * The document primitives every Howzat report is built from.
 *
 * A report is a vertical run of blocks with one shared cursor, which is the
 * only model that survives content of unknown length: a scorecard is two
 * innings or one, a league is four fixtures or forty, and none of it can be
 * laid out on a fixed grid decided in advance. Each block asks for the room it
 * needs, takes a new page if the room is not there, and leaves the cursor under
 * itself.
 *
 * Everything chrome-like — the masthead band, the running head, the footer
 * rule and the page numbers — is painted by this class rather than by the
 * reports, so that a scorecard, a match report and a league table are visibly
 * the same document with different contents.
 */
export class ReportDoc {
  readonly pdf: jsPDF;
  /** The running head on pages two and after. */
  private readonly runningHead: string;
  private y: number;

  constructor(options: { title: string; subject: string; runningHead: string }) {
    this.pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    this.pdf.setProperties({
      title: options.title,
      subject: options.subject,
      creator: 'Howzat',
      author: 'Howzat',
    });

    this.runningHead = options.runningHead;
    this.y = MARGIN.top;
  }

  // ────────────────────────────────────────────────────────  geometry ──

  get cursor(): number {
    return this.y;
  }

  set cursor(value: number) {
    this.y = value;
  }

  private get floor(): number {
    return PAGE.height - MARGIN.bottom - 26;
  }

  /** Vertical air. Never applied at the top of a fresh page. */
  space(amount: number): void {
    if (this.y > MARGIN.top) this.y += amount;
  }

  /**
   * Guarantees `height` points of room below the cursor, breaking the page if
   * there is not. Blocks call this before drawing rather than after, so nothing
   * is ever half-drawn across a fold.
   */
  need(height: number): void {
    if (this.y + height <= this.floor) return;
    this.newPage();
  }

  /**
   * A new sheet. The running head is *not* painted here — autoTable breaks its
   * own pages without going through this method, so the chrome is applied to
   * every page in one pass at the end, where it can be applied exactly once.
   */
  newPage(): void {
    this.pdf.addPage();
    this.y = MARGIN.top + 12;
  }

  // ────────────────────────────────────────────────────────  masthead ──

  /**
   * The cover band: a full-bleed slab of ink at the head of page one carrying
   * the wordmark, what this document is, and what it is about.
   *
   * It runs to the paper's edge on purpose. A framed panel would read as a
   * component on a page; a band that leaves the page reads as the head of a
   * printed document, which is what this is.
   */
  masthead(options: {
    kicker: string;
    title: string;
    subtitle?: string;
    /** Right-aligned in the band's top line — "RESULT", "LIVE", "FIXTURE". */
    status?: string;
    /** Up to three short facts printed along the band's foot. */
    facts?: string[];
  }): void {
    const { pdf } = this;
    const height = options.facts?.length ? 176 : 152;

    pdf.setFillColor(...BAND);
    pdf.rect(0, 0, PAGE.width, height, 'F');

    pdf.setFont(SANS, 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...ON_BAND);
    pdf.text('HOWZAT', MARGIN.left, 44, { charSpace: 2.6 });

    pdf.setFont(SANS, 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...ON_BAND_MUTED);
    pdf.text(options.kicker.toUpperCase(), MARGIN.left, 62, { charSpace: 1.4 });

    if (options.status) {
      pdf.setFont(SANS, 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...ON_BAND);
      pdf.text(options.status.toUpperCase(), PAGE.width - MARGIN.right, 44, {
        align: 'right',
        charSpace: 1.6,
      });
    }

    // The one line the reader is looking for. Set to shrink rather than wrap:
    // two long club names should still be one line, because a title that folds
    // stops looking like a title.
    pdf.setFont(SERIF, 'normal');
    pdf.setTextColor(...ON_BAND);
    const size = this.fitFontSize(options.title, CONTENT_WIDTH, 30, 17, SERIF, 'normal');
    pdf.setFontSize(size);
    pdf.text(options.title, MARGIN.left, 104);

    if (options.subtitle) {
      pdf.setFont(SANS, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...ON_BAND_MUTED);
      pdf.text(options.subtitle, MARGIN.left, 124);
    }

    if (options.facts?.length) {
      pdf.setDrawColor(58, 63, 71);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN.left, 140, PAGE.width - MARGIN.right, 140);

      pdf.setFont(SANS, 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...ON_BAND_MUTED);

      // Flowed rather than dropped into equal columns: a venue name and a toss
      // line are nothing like the same length, and a fixed grid made the long
      // one run straight through its neighbour. Anything that will not fit on
      // the line is left out, because a truncated fact is worse than no fact.
      let x = MARGIN.left;

      for (const fact of options.facts) {
        const text = fact.toUpperCase();
        const width = this.spacedTextWidth(text, 0.9);

        if (x + width > PAGE.width - MARGIN.right) break;

        pdf.text(text, x, 160, { charSpace: 0.9 });
        x += width + 22;
      }
    }

    this.y = height + 34;
  }

  /**
   * How wide a run of letter-spaced text actually is. jsPDF's getTextWidth
   * ignores charSpace, which is fine until something is positioned after it —
   * and then everything downstream lands on top of it.
   */
  private spacedTextWidth(text: string, charSpace: number): number {
    return this.pdf.getTextWidth(text) + Math.max(0, text.length - 1) * charSpace;
  }

  /** Largest size at or below `max` that keeps `text` on one line. */
  private fitFontSize(
    text: string,
    width: number,
    max: number,
    min: number,
    font: string,
    style: string,
  ): number {
    const { pdf } = this;
    pdf.setFont(font, style);

    for (let size = max; size > min; size -= 0.5) {
      pdf.setFontSize(size);
      if (pdf.getTextWidth(text) <= width) return size;
    }

    return min;
  }

  // ─────────────────────────────────────────────────────────  blocks ──

  /**
   * A section's label and name, over a hairline.
   *
   * It reserves far more room than it occupies, and deliberately: a heading
   * stranded at the foot of a page with its table overleaf is the single most
   * common way a generated document looks generated. The reserve is roughly a
   * heading plus a table head plus two rows, which is the least that reads as
   * a section having started.
   */
  heading(eyebrow: string, title: string, note?: string, reserve = 120): void {
    this.space(26);
    this.need(reserve);

    const { pdf } = this;

    pdf.setFont(SANS, 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...ACCENT);
    pdf.text(eyebrow.toUpperCase(), MARGIN.left, this.y, { charSpace: 1.3 });

    pdf.setFont(SERIF, 'normal');
    pdf.setFontSize(16);
    pdf.setTextColor(...INK);
    pdf.text(title, MARGIN.left, this.y + 20);

    if (note) {
      pdf.setFont(SANS, 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text(note, PAGE.width - MARGIN.right, this.y + 20, { align: 'right' });
    }

    this.y += 30;
    this.rule();
    this.y += 14;
  }

  rule(strong = false): void {
    this.pdf.setDrawColor(...(strong ? LINE_STRONG : LINE));
    this.pdf.setLineWidth(strong ? 0.8 : 0.5);
    this.pdf.line(MARGIN.left, this.y, PAGE.width - MARGIN.right, this.y);
  }

  paragraph(text: string, options: { color?: Rgb; size?: number; italic?: boolean } = {}): void {
    const { pdf } = this;
    const size = options.size ?? 9;

    pdf.setFont(SANS, options.italic ? 'italic' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? SECONDARY));

    const lines = pdf.splitTextToSize(text, CONTENT_WIDTH) as string[];
    this.need(lines.length * (size + 3.5));

    pdf.text(lines, MARGIN.left, this.y + size * 0.8);
    this.y += lines.length * (size + 3.5);
  }

  /**
   * A row of figures under their labels — the report's equivalent of the stat
   * tiles on screen. Ruled off rather than boxed, because four boxes in a row
   * is a dashboard and this is a document.
   */
  metrics(items: Array<{ label: string; value: string; tone?: Rgb }>): void {
    if (items.length === 0) return;

    this.space(16);
    this.need(56);

    const { pdf } = this;
    const columnWidth = CONTENT_WIDTH / items.length;

    items.forEach((item, index) => {
      const x = MARGIN.left + index * columnWidth;

      pdf.setFont(SANS, 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(...(item.tone ?? INK));
      pdf.text(item.value, x, this.y + 14);

      pdf.setFont(SANS, 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...MUTED);
      pdf.text(item.label.toUpperCase(), x, this.y + 28, { charSpace: 0.9 });
    });

    this.y += 38;
    this.rule();
    this.y += 2;
  }

  /**
   * One side's scoreline: colour swatch, name, figure. Two of these stacked is
   * the whole result of a match, in either code, and it is the block a reader
   * looks at before anything else on the page.
   */
  scoreLine(options: {
    color: Rgb;
    name: string;
    detail?: string;
    figure: string;
    /** The winning side is set in ink; the other in grey. */
    won?: boolean;
  }): void {
    this.need(40);

    const { pdf } = this;
    const top = this.y;

    pdf.setFillColor(...options.color);
    pdf.rect(MARGIN.left, top + 6, 3.5, 22, 'F');

    pdf.setFont(SERIF, 'normal');
    pdf.setFontSize(15);
    pdf.setTextColor(...(options.won === false ? SECONDARY : INK));
    pdf.text(options.name, MARGIN.left + 14, top + 20, { maxWidth: CONTENT_WIDTH - 170 });

    if (options.detail) {
      pdf.setFont(SANS, 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...MUTED);
      pdf.text(options.detail, MARGIN.left + 14, top + 32);
    }

    pdf.setFont(SANS, 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(...(options.won === false ? SECONDARY : INK));
    pdf.text(options.figure, PAGE.width - MARGIN.right, top + 22, { align: 'right' });

    this.y = top + (options.detail ? 40 : 34);
  }

  /**
   * The house table: a ruled ledger, not a striped grid. Hairlines under every
   * row, a sunken head, figures right-aligned, and no vertical rules at all —
   * the columns are held apart by their alignment, which is how a printed
   * scorecard has always done it.
   */
  table(options: {
    head: RowInput[];
    body: RowInput[];
    /** Per-column overrides, keyed by column index. */
    columnStyles?: Record<string, Partial<Styles>>;
    /** A last row set apart by a heavier rule above it — totals, extras. */
    foot?: RowInput[];
    didParseCell?: UserOptions['didParseCell'];
  }): void {
    this.space(4);

    autoTable(this.pdf, {
      head: options.head,
      body: options.body,
      foot: options.foot,
      startY: this.y,
      margin: { left: MARGIN.left, right: MARGIN.right, top: MARGIN.top + 12, bottom: MARGIN.bottom + 26 },
      theme: 'plain',
      tableLineWidth: 0,
      // A fixture whose two club names wrap must not be cut in half by a page
      // break — half a row at the foot of one page and half at the head of the
      // next reads as a rendering fault, which is exactly what it is.
      rowPageBreak: 'avoid',
      styles: {
        font: SANS,
        fontSize: 8.5,
        textColor: INK,
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
        lineColor: LINE,
        lineWidth: { bottom: 0.5, top: 0, left: 0, right: 0 },
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        font: SANS,
        fontStyle: 'bold',
        fontSize: 6.8,
        textColor: MUTED,
        fillColor: SUNKEN,
        cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
        lineColor: LINE_STRONG,
        lineWidth: { bottom: 0.8, top: 0, left: 0, right: 0 },
      },
      footStyles: {
        font: SANS,
        fontStyle: 'bold',
        fontSize: 8,
        textColor: INK,
        fillColor: SUNKEN,
        lineColor: LINE_STRONG,
        lineWidth: { top: 0.8, bottom: 0, left: 0, right: 0 },
      },
      columnStyles: options.columnStyles,
      didParseCell: options.didParseCell,
      showFoot: 'lastPage',
    });

    // autoTable stashes where it finished on the document it drew into.
    const finalY = (this.pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY;
    this.y = finalY ?? this.y;
  }

  /**
   * A short aside under a table — fall of wickets, a scorers list, a note about
   * what a column means. Set small and italic so it never competes with the
   * figures above it.
   */
  caption(label: string, text: string): void {
    this.space(10);

    const { pdf } = this;
    const labelText = label.toUpperCase();

    // Measured before anything is drawn, so a caption that will not fit takes
    // its label with it to the next page rather than leaving it behind.
    pdf.setFont(SANS, 'bold');
    pdf.setFontSize(6.8);
    const indent = this.spacedTextWidth(labelText, 0.9) + 12;

    pdf.setFont(SANS, 'normal');
    pdf.setFontSize(8);
    const lines = pdf.splitTextToSize(text, CONTENT_WIDTH - indent) as string[];
    this.need(lines.length * 11 + 8);

    pdf.setFont(SANS, 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(...MUTED);
    pdf.text(labelText, MARGIN.left, this.y + 7, { charSpace: 0.9 });

    pdf.setFont(SANS, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...SECONDARY);
    pdf.text(lines, MARGIN.left + indent, this.y + 7);

    this.y += lines.length * 11;
  }

  // ────────────────────────────────────────────────────────  finishing ──

  /**
   * Running heads and footers, painted last in one pass over every page.
   *
   * It has to be last for two reasons. A footer that guessed the page count
   * would get it wrong on the one document long enough for anyone to check;
   * and autoTable starts pages of its own without going through `newPage`, so
   * a head drawn as pages are created would simply be missing from most of
   * them. Walking the finished document is the only place both are knowable.
   */
  private paintChrome(generatedAt: Date): void {
    const { pdf } = this;
    const pages = pdf.getNumberOfPages();
    const stamp = generatedAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const baseline = PAGE.height - MARGIN.bottom + 16;

    for (let page = 1; page <= pages; page += 1) {
      pdf.setPage(page);

      // Page one has the masthead; a running head above it would be saying the
      // same thing twice, smaller.
      if (page > 1) {
        pdf.setFont(SANS, 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...FAINT);
        pdf.text(this.runningHead.toUpperCase(), MARGIN.left, MARGIN.top - 16, { charSpace: 0.8 });
        pdf.text('HOWZAT', PAGE.width - MARGIN.right, MARGIN.top - 16, {
          align: 'right',
          charSpace: 1.2,
        });

        pdf.setDrawColor(...LINE);
        pdf.setLineWidth(0.5);
        pdf.line(MARGIN.left, MARGIN.top - 8, PAGE.width - MARGIN.right, MARGIN.top - 8);
      }

      pdf.setDrawColor(...LINE);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN.left, baseline - 14, PAGE.width - MARGIN.right, baseline - 14);

      pdf.setFont(SANS, 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...FAINT);
      pdf.text(`Generated ${stamp}`, MARGIN.left, baseline);
      pdf.text('Scored on Howzat', PAGE.width / 2, baseline, { align: 'center' });
      pdf.text(`${page} / ${pages}`, PAGE.width - MARGIN.right, baseline, { align: 'right' });
    }
  }

  blob(generatedAt = new Date()): Blob {
    this.paintChrome(generatedAt);
    return this.pdf.output('blob');
  }
}

/** What a report builder hands back: the file, and how to introduce it. */
export interface BuiltPdf {
  blob: Blob;
  fileName: string;
  /** The share sheet's title, and what the file is called in conversation. */
  title: string;
  /** One sentence of accompanying text when it is shared rather than saved. */
  text: string;
}

/** A filename that sorts by date and survives every filesystem. */
export function pdfFileName(parts: string[], date = new Date()): string {
  const slug = parts
    .join(' ')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 80);

  const stamp = date.toISOString().slice(0, 10);

  return `${slug || 'howzat'}-${stamp}.pdf`;
}
