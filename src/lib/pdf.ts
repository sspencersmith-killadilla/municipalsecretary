import { jsPDF } from "jspdf";

/* ------------------------------------------------------------------ types */

export type DocMeta = {
  municipality: string;
  bodyName: string;
  meetingTitle: string;
  startsAt: string | null;
  location: string | null;
  docLabel: string;
  version: number;
  fileName: string;
};

export type PacketItem = {
  displayNumber: string | null;
  sectionName: string;
  title: string;
  outcome?: string | null;
  legislation?: {
    number: string | null;
    typeName: string | null;
    sponsor: string | null;
    department: string | null;
    summary: string | null;
    fiscalImpact: string | null;
    bodyText: string | null;
  } | null;
};

export type MinutesMotion = {
  itemLabel: string;
  text: string;
  mover: string | null;
  seconder: string | null;
  result: string | null;
  tally: { aye?: number; nay?: number; abstain?: number; recuse?: number; absent?: number } | null;
  roll: { name: string; choice: string }[];
};

/* ---------------------------------------------------------- layout engine */

const MARGIN = 56; // 0.78in at 72dpi
const PAGE_W = 612;
const PAGE_H = 792;
const BODY_W = PAGE_W - MARGIN * 2;

class Doc {
  readonly pdf: jsPDF;
  private y = MARGIN;
  private meta: DocMeta;

  constructor(meta: DocMeta) {
    this.meta = meta;
    this.pdf = new jsPDF({ unit: "pt", format: "letter" });
    this.pdf.setProperties({
      title: `${meta.docLabel} — ${meta.meetingTitle} (v${meta.version})`,
      subject: meta.bodyName,
      author: meta.municipality,
    });
    this.coverBlock();
  }

  private ensure(space: number) {
    if (this.y + space <= PAGE_H - MARGIN - 24) return;
    this.pdf.addPage();
    this.y = MARGIN;
  }

  gap(n = 10) {
    this.y += n;
  }

  pageBreak() {
    this.pdf.addPage();
    this.y = MARGIN;
  }

  rule(weight = 0.75) {
    this.ensure(12);
    this.pdf.setLineWidth(weight);
    this.pdf.setDrawColor(120);
    this.pdf.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 12;
  }

  text(
    value: string,
    opts: {
      size?: number;
      style?: "normal" | "bold" | "italic";
      font?: "times" | "helvetica" | "courier";
      color?: number;
      indent?: number;
      align?: "left" | "center";
      leading?: number;
    } = {},
  ) {
    const {
      size = 10,
      style = "normal",
      font = "times",
      color = 20,
      indent = 0,
      align = "left",
      leading = 1.35,
    } = opts;
    this.pdf.setFont(font, style);
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(color);
    const lines = this.pdf.splitTextToSize(value, BODY_W - indent) as string[];
    const lh = size * leading;
    for (const line of lines) {
      this.ensure(lh);
      if (align === "center") {
        this.pdf.text(line, PAGE_W / 2, this.y + size * 0.85, { align: "center" });
      } else {
        this.pdf.text(line, MARGIN + indent, this.y + size * 0.85);
      }
      this.y += lh;
    }
  }

  heading(value: string) {
    this.gap(8);
    this.ensure(28);
    this.text(value.toUpperCase(), { size: 10, style: "bold", font: "helvetica" });
    this.rule(1.25);
  }

  labelled(label: string, value: string) {
    this.text(`${label}: ${value}`, { size: 9.5, color: 70 });
  }

  private coverBlock() {
    const m = this.meta;
    this.text(m.municipality.toUpperCase(), {
      size: 11,
      style: "bold",
      font: "helvetica",
      align: "center",
    });
    this.text(m.bodyName, { size: 9, font: "helvetica", color: 90, align: "center" });
    this.gap(6);
    this.rule(1.5);
    this.text(m.docLabel.toUpperCase(), {
      size: 16,
      style: "bold",
      align: "center",
    });
    this.text(m.meetingTitle, { size: 12, align: "center", color: 60 });
    this.gap(2);
    this.text(
      [formatStamp(m.startsAt), m.location].filter(Boolean).join(" · "),
      { size: 9.5, font: "helvetica", color: 100, align: "center" },
    );
    this.gap(4);
    this.rule(1.5);
  }

  finish(): jsPDF {
    const total = this.pdf.getNumberOfPages();
    for (let i = 1; i <= total; i += 1) {
      this.pdf.setPage(i);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(7.5);
      this.pdf.setTextColor(130);
      this.pdf.text(
        `${this.meta.municipality} · ${this.meta.bodyName} · ${this.meta.docLabel} v${this.meta.version}`,
        MARGIN,
        PAGE_H - MARGIN + 20,
      );
      this.pdf.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN + 20, {
        align: "right",
      });
      this.pdf.text(this.meta.fileName, PAGE_W - MARGIN, PAGE_H - MARGIN + 32, { align: "right" });
    }
    return this.pdf;
  }
}

function formatStamp(value: string | null) {
  if (!value) return "Date to be determined";
  return new Date(value).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* --------------------------------------------------------- agenda packet */

export function buildAgendaPacket(meta: DocMeta, items: PacketItem[]): jsPDF {
  const doc = new Doc(meta);

  doc.heading("Agenda");
  if (items.length === 0) {
    doc.text("No items have been placed on this agenda.", { style: "italic", color: 90 });
  }

  let currentSection = "";
  for (const it of items) {
    if (it.sectionName !== currentSection) {
      currentSection = it.sectionName;
      doc.gap(6);
      doc.text(currentSection.toUpperCase(), {
        size: 8.5,
        style: "bold",
        font: "helvetica",
        color: 90,
      });
      doc.gap(2);
    }
    doc.text(`${it.displayNumber ? `${it.displayNumber}.  ` : ""}${it.title}`, {
      size: 10.5,
      indent: 12,
    });
    if (it.legislation?.number) {
      doc.text(it.legislation.number, { size: 8.5, font: "courier", color: 110, indent: 24 });
    }
  }

  const withDetail = items.filter((i) => i.legislation);
  if (withDetail.length > 0) {
    doc.pageBreak();
    doc.heading("Supporting Materials");
    for (const it of withDetail) {
      const l = it.legislation!;
      doc.gap(8);
      doc.text(`${it.displayNumber ? `${it.displayNumber}. ` : ""}${it.title}`, {
        size: 11,
        style: "bold",
      });
      doc.labelled("File", l.number ?? "Unnumbered");
      if (l.typeName) doc.labelled("Type", l.typeName);
      if (l.sponsor) doc.labelled("Sponsor", l.sponsor);
      if (l.department) doc.labelled("Department", l.department);
      if (l.summary) {
        doc.gap(4);
        doc.text("Summary", { size: 8.5, style: "bold", font: "helvetica", color: 90 });
        doc.text(l.summary, { size: 10 });
      }
      if (l.fiscalImpact) {
        doc.gap(4);
        doc.text("Fiscal impact", { size: 8.5, style: "bold", font: "helvetica", color: 90 });
        doc.text(l.fiscalImpact, { size: 10 });
      }
      if (l.bodyText) {
        doc.gap(4);
        doc.text("Text", { size: 8.5, style: "bold", font: "helvetica", color: 90 });
        doc.text(l.bodyText, { size: 9.5 });
      }
      doc.gap(6);
      doc.rule(0.5);
    }
  }

  return doc.finish();
}

/* ---------------------------------------------------------------- minutes */

export function buildMinutes(
  meta: DocMeta,
  input: {
    finalized: boolean;
    quorumLine: string;
    roll: { name: string; seat: string; status: string }[];
    items: PacketItem[];
    motions: MinutesMotion[];
    narrative: string | null;
  },
): jsPDF {
  const doc = new Doc(meta);

  doc.text(input.finalized ? "APPROVED MINUTES" : "DRAFT — NOT YET APPROVED", {
    size: 9,
    style: "bold",
    font: "helvetica",
    color: input.finalized ? 60 : 150,
    align: "center",
  });
  doc.gap(6);

  doc.heading("Roll Call");
  for (const r of input.roll) {
    doc.text(`${r.name}${r.seat ? ` (${r.seat})` : ""} — ${r.status}`, { size: 10, indent: 12 });
  }
  doc.gap(4);
  doc.text(input.quorumLine, { size: 9.5, style: "italic", color: 80 });

  doc.heading("Items Considered");
  for (const it of input.items) {
    doc.text(
      `${it.displayNumber ? `${it.displayNumber}.  ` : ""}${it.title}${
        it.outcome ? ` — ${it.outcome.toUpperCase()}` : ""
      }`,
      { size: 10.5, indent: 12 },
    );
  }

  doc.heading("Motions and Votes");
  if (input.motions.length === 0) {
    doc.text("No motions were recorded.", { style: "italic", color: 90 });
  }
  for (const m of input.motions) {
    doc.gap(6);
    doc.text(m.itemLabel, { size: 8.5, style: "bold", font: "helvetica", color: 90 });
    doc.text(m.text, { size: 10.5, style: "italic" });
    const movers = [
      m.mover ? `Moved by ${m.mover}` : null,
      m.seconder ? `seconded by ${m.seconder}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    if (movers) doc.text(movers, { size: 9.5, color: 80 });
    const t = m.tally ?? {};
    doc.text(
      `Aye ${t.aye ?? 0} · Nay ${t.nay ?? 0} · Abstain ${t.abstain ?? 0} · Recuse ${
        t.recuse ?? 0
      } · Absent ${t.absent ?? 0}  —  ${(m.result ?? "pending").toUpperCase()}`,
      { size: 9.5, font: "courier", color: 40 },
    );
    for (const r of m.roll) {
      doc.text(`${r.name}: ${r.choice}`, { size: 9, color: 90, indent: 18 });
    }
  }

  if (input.narrative?.trim()) {
    doc.heading("Clerk's Narrative");
    doc.text(input.narrative, { size: 10, leading: 1.4 });
  }

  doc.gap(20);
  doc.rule(0.5);
  doc.text(
    input.finalized
      ? "Certified as a true and correct record of the proceedings."
      : "Draft minutes — subject to approval by the body at a subsequent meeting.",
    { size: 9, style: "italic", color: 90 },
  );

  return doc.finish();
}

/* -------------------------------------------------------------- filenames */

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildFileName(input: {
  startsAt: string | null;
  bodyName: string;
  docType: "agenda_packet" | "minutes";
  version: number;
}) {
  const date = input.startsAt
    ? new Date(input.startsAt).toISOString().slice(0, 10)
    : "undated";
  const label = input.docType === "agenda_packet" ? "agenda-packet" : "minutes";
  return `${date}_${slugify(input.bodyName)}_${label}_v${input.version}.pdf`;
}
