/**
 * Open-meetings compliance helpers.
 *
 * Notice rules vary by state, so the thresholds come from the `settings` row
 * (notice_days / posting_deadline_hours) rather than being hardcoded here.
 */

export type MeetingKind = "regular" | "special" | "emergency" | "continued" | "workshop";
export type NoticeKind = "original" | "amended" | "cancellation" | "continuation" | "emergency";

export const MEETING_KIND_LABELS: Record<MeetingKind, string> = {
  regular: "Regular meeting",
  special: "Special meeting",
  emergency: "Emergency meeting",
  continued: "Continued meeting",
  workshop: "Workshop / study session",
};

export const NOTICE_KIND_LABELS: Record<NoticeKind, string> = {
  original: "Original notice",
  amended: "Amended notice",
  cancellation: "Notice of cancellation",
  continuation: "Notice of continuation",
  emergency: "Emergency notice",
};

/** Statutory lead time in hours for each meeting kind, derived from settings. */
export function requiredLeadHours(
  kind: MeetingKind,
  settings: { notice_days?: number | null; posting_deadline_hours?: number | null } | null,
) {
  const days = settings?.notice_days ?? 3;
  const special = settings?.posting_deadline_hours ?? 24;
  switch (kind) {
    case "emergency":
      return 1;
    case "special":
    case "continued":
      return special;
    default:
      return days * 24;
  }
}

/** The latest moment a notice may be posted and still be timely. */
export function noticeDeadline(startsAt: string | null, leadHours: number) {
  if (!startsAt) return null;
  return new Date(new Date(startsAt).getTime() - leadHours * 3600_000);
}

export type ComplianceCheck = {
  deadline: Date | null;
  leadHours: number;
  compliant: boolean;
  hoursBefore: number | null;
  message: string;
};

export function checkNoticeTiming(
  startsAt: string | null,
  kind: MeetingKind,
  settings: { notice_days?: number | null; posting_deadline_hours?: number | null } | null,
  postedAt: Date = new Date(),
): ComplianceCheck {
  const leadHours = requiredLeadHours(kind, settings);
  const deadline = noticeDeadline(startsAt, leadHours);
  if (!deadline) {
    return {
      deadline: null,
      leadHours,
      compliant: false,
      hoursBefore: null,
      message: "Meeting has no date and time, so notice timing cannot be verified.",
    };
  }
  const hoursBefore = (new Date(startsAt!).getTime() - postedAt.getTime()) / 3600_000;
  const compliant = postedAt.getTime() <= deadline.getTime();
  return {
    deadline,
    leadHours,
    compliant,
    hoursBefore,
    message: compliant
      ? `Timely — posted ${hoursBefore.toFixed(1)} hours before the meeting (${leadHours} required).`
      : `LATE — posted ${hoursBefore.toFixed(1)} hours before the meeting; ${leadHours} hours of notice are required.`,
  };
}

export const DEFAULT_POSTING_LOCATIONS = [
  "City Hall notice board",
  "Municipal website",
  "Clerk's office",
];

export function draftNoticeText(input: {
  municipality: string;
  bodyName: string;
  meetingTitle: string;
  kind: MeetingKind;
  startsAt: string | null;
  location: string | null;
  items: { display_number: string | null; title: string }[];
  emergencyJustification?: string | null;
}) {
  const when = input.startsAt
    ? new Date(input.startsAt).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "a date and time to be determined";
  const lines: string[] = [];
  lines.push(`NOTICE OF ${MEETING_KIND_LABELS[input.kind].toUpperCase()}`);
  lines.push("");
  lines.push(
    `Notice is hereby given that the ${input.bodyName} of ${input.municipality} will meet on ${when} at ${
      input.location ?? "a location to be announced"
    } for the purpose of considering the matters listed below.`,
  );
  if (input.kind === "emergency" && input.emergencyJustification) {
    lines.push("");
    lines.push(`Basis for emergency meeting: ${input.emergencyJustification}`);
  }
  lines.push("");
  lines.push("MATTERS TO BE CONSIDERED");
  if (input.items.length === 0) {
    lines.push("  (agenda under development)");
  } else {
    for (const it of input.items) {
      lines.push(`  ${it.display_number ? `${it.display_number}. ` : "• "}${it.title}`);
    }
  }
  lines.push("");
  lines.push(
    "The public is invited to attend. Persons requiring an accommodation to participate should contact the Clerk's office in advance so that reasonable arrangements can be made.",
  );
  return lines.join("\n");
}

/** Record classes used by the retention schedule and legal-hold system. */
export const RECORD_CLASSES = [
  "minutes",
  "ordinances",
  "agendas",
  "notices",
  "public_comments",
  "records_requests",
  "recordings",
] as const;
export type RecordClass = (typeof RECORD_CLASSES)[number];
