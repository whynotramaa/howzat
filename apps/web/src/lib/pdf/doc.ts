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

export class ReportDoc {
  readonly pdf: jsPDF;
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

  get cursor(): number {
    return this.y;
  }

  set cursor(value: number) {
    this.y = value;
  }

  private get floor(): number {
    return PAGE.height - MARGIN.bottom - 26;
  }

  space(amount: number): void {
    if (this.y > MARGIN.top) this.y += amount;
  }

  need(height: number): void {
    if (this.y + height <= this.floor) return;
    this.newPage();
  }

  newPage(): void {
    this.pdf.addPage();
    this.y = MARGIN.top + 12;
  }

  masthead(options: {
    kicker: string;
    title: string;
    subtitle?: string;
    status?: string;
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

  private spacedTextWidth(text: string, charSpace: number): number {
    return this.pdf.getTextWidth(text) + Math.max(0, text.length - 1) * charSpace;
  }

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

  scoreLine(options: {
    color: Rgb;
    name: string;
    detail?: string;
    figure: string;
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

  table(options: {
    head: RowInput[];
    body: RowInput[];
    columnStyles?: Record<string, Partial<Styles>>;
    foot?: RowInput[];
    didParseCell?: UserOptions['didParseCell'];
  }): void {
    this.space(4);

    autoTable(this.pdf, {
      head: options.head,
      body: options.body,
      foot: options.foot,
      startY: this.y,
      margin: {
        left: MARGIN.left,
        right: MARGIN.right,
        top: MARGIN.top + 12,
        bottom: MARGIN.bottom + 26,
      },
      theme: 'plain',
      tableLineWidth: 0,
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

    const finalY = (this.pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY;
    this.y = finalY ?? this.y;
  }

  caption(label: string, text: string): void {
    this.space(10);

    const { pdf } = this;
    const labelText = label.toUpperCase();

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

  private paintChrome(generatedAt: Date): void {
    const { pdf } = this;
    const pages = pdf.getNumberOfPages();
    const stamp = generatedAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const baseline = PAGE.height - MARGIN.bottom + 16;

    for (let page = 1; page <= pages; page += 1) {
      pdf.setPage(page);

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

export interface BuiltPdf {
  blob: Blob;
  fileName: string;
  title: string;
  text: string;
}

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
