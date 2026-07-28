import { supabase } from "@/integrations/supabase/client";
import { quorumRequired } from "@/lib/votes";
import {
  buildAgendaPacket,
  buildFileName,
  buildMinutes,
  type DocMeta,
  type MinutesMotion,
  type PacketItem,
} from "@/lib/pdf";

type DocType = "agenda_packet" | "minutes";

async function nextVersion(meetingId: string, docType: DocType) {
  const { data, error } = await supabase
    .from("document_exports")
    .select("version")
    .eq("meeting_id", meetingId)
    .eq("doc_type", docType)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.version ?? 0) + 1;
}

async function record(meetingId: string, docType: DocType, version: number, fileName: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("document_exports").insert({
    meeting_id: meetingId,
    doc_type: docType,
    version,
    file_name: fileName,
    generated_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

async function loadCore(meetingId: string) {
  const [{ data: meeting, error: mErr }, { data: settings }] = await Promise.all([
    supabase
      .from("meetings")
      .select(
        "id,title,starts_at,location,body_id,bodies(name,seat_count,quorum_type,quorum_value)",
      )
      .eq("id", meetingId)
      .maybeSingle(),
    supabase.from("settings").select("municipality_name").eq("id", 1).maybeSingle(),
  ]);
  if (mErr) throw mErr;
  if (!meeting) throw new Error("Meeting not found");
  const body = meeting.bodies as {
    name: string;
    seat_count: number;
    quorum_type: string;
    quorum_value: number | null;
  } | null;
  return {
    meeting,
    body,
    municipality: settings?.municipality_name ?? "Municipality",
  };
}

async function loadAgenda(meetingId: string): Promise<PacketItem[]> {
  const { data, error } = await supabase
    .from("agenda_items")
    .select(
      "id,title,display_number,section_name,section_order,position,outcome,legislative_items(assigned_number,file_number,sponsor,department,summary,fiscal_impact,body_text,item_types(name))",
    )
    .eq("meeting_id", meetingId)
    .order("section_order")
    .order("position");
  if (error) throw error;
  return (data ?? []).map((a) => {
    const l = a.legislative_items as {
      assigned_number: string | null;
      file_number: string | null;
      sponsor: string | null;
      department: string | null;
      summary: string | null;
      fiscal_impact: string | null;
      body_text: string | null;
      item_types: { name: string } | null;
    } | null;
    return {
      displayNumber: a.display_number,
      sectionName: a.section_name,
      title: a.title,
      outcome: a.outcome,
      legislation: l
        ? {
            number: l.assigned_number ?? l.file_number,
            typeName: l.item_types?.name ?? null,
            sponsor: l.sponsor,
            department: l.department,
            summary: l.summary,
            fiscalImpact: l.fiscal_impact,
            bodyText: l.body_text,
          }
        : null,
    };
  });
}

function meta(
  base: Awaited<ReturnType<typeof loadCore>>,
  docLabel: string,
  version: number,
  fileName: string,
): DocMeta {
  return {
    municipality: base.municipality,
    bodyName: base.body?.name ?? "Legislative Body",
    meetingTitle: base.meeting.title,
    startsAt: base.meeting.starts_at,
    location: base.meeting.location,
    docLabel,
    version,
    fileName,
  };
}

/** Generate, version, log and download the agenda packet for a meeting. */
export async function downloadAgendaPacket(meetingId: string) {
  const base = await loadCore(meetingId);
  const items = await loadAgenda(meetingId);
  const version = await nextVersion(meetingId, "agenda_packet");
  const fileName = buildFileName({
    startsAt: base.meeting.starts_at,
    bodyName: base.body?.name ?? "body",
    docType: "agenda_packet",
    version,
  });
  const pdf = buildAgendaPacket(meta(base, "Agenda Packet", version, fileName), items);
  pdf.save(fileName);
  await record(meetingId, "agenda_packet", version, fileName);
  return fileName;
}

/** Generate, version, log and download the minutes for a meeting. */
export async function downloadMinutes(meetingId: string) {
  const base = await loadCore(meetingId);
  const items = await loadAgenda(meetingId);

  const [{ data: seatRows }, { data: attRows }, { data: motionRows }, { data: minutesRow }] =
    await Promise.all([
      supabase
        .from("body_seats")
        .select("seat_label,title,member_id,members(id,full_name)")
        .eq("body_id", base.meeting.body_id)
        .order("sort_order"),
      supabase.from("attendance").select("member_id,status").eq("meeting_id", meetingId),
      supabase
        .from("motions")
        .select("id,text,result,tally,agenda_item_id,mover_id,seconder_id,votes(member_id,choice)")
        .eq("meeting_id", meetingId)
        .order("created_at"),
      supabase.from("minutes").select("content,finalized").eq("meeting_id", meetingId).maybeSingle(),
    ]);

  const seats = seatRows ?? [];
  const nameOf = (id: string | null) =>
    seats.find((s) => (s.members as { id: string } | null)?.id === id)
      ? ((seats.find((s) => (s.members as { id: string } | null)?.id === id)!.members as {
          full_name: string;
        }).full_name)
      : null;

  const attMap = new Map((attRows ?? []).map((a) => [a.member_id, a.status as string]));
  const roll = seats
    .filter((s) => s.members)
    .map((s) => ({
      name: (s.members as { full_name: string }).full_name,
      seat: s.title ?? s.seat_label,
      status: attMap.get((s.members as { id: string }).id) ?? "not recorded",
    }));
  const present = roll.filter((r) => ["present", "remote"].includes(r.status)).length;
  const quorum = base.body
    ? quorumRequired(base.body.quorum_type, base.body.quorum_value, base.body.seat_count)
    : 0;
  const quorumLine = `${present} of ${base.body?.seat_count ?? roll.length} members present; ${quorum} required for a quorum — quorum ${
    present >= quorum ? "was" : "was NOT"
  } present.`;

  const motionAgendaTitles: Record<string, string> = {};
  const { data: agendaLookup } = await supabase
    .from("agenda_items")
    .select("id,title,display_number")
    .eq("meeting_id", meetingId);
  (agendaLookup ?? []).forEach((a) => {
    motionAgendaTitles[a.id] = `${a.display_number ? `${a.display_number}. ` : ""}${a.title}`;
  });
  const labelFor = (agendaItemId: string | null) =>
    motionAgendaTitles[agendaItemId ?? ""] ?? "General business";

  const motions: MinutesMotion[] = (motionRows ?? []).map((m) => ({
    itemLabel: labelFor(m.agenda_item_id),
    text: m.text,
    mover: nameOf(m.mover_id),
    seconder: nameOf(m.seconder_id),
    result: m.result,
    tally: (m.tally as MinutesMotion["tally"]) ?? null,
    roll: ((m.votes as { member_id: string; choice: string }[]) ?? []).map((v) => ({
      name: nameOf(v.member_id) ?? "Member",
      choice: v.choice,
    })),
  }));

  const version = await nextVersion(meetingId, "minutes");
  const fileName = buildFileName({
    startsAt: base.meeting.starts_at,
    bodyName: base.body?.name ?? "body",
    docType: "minutes",
    version,
  });
  const pdf = buildMinutes(meta(base, "Minutes", version, fileName), {
    finalized: !!minutesRow?.finalized,
    quorumLine,
    roll,
    items,
    motions,
    narrative: minutesRow?.content ?? null,
  });
  pdf.save(fileName);
  await record(meetingId, "minutes", version, fileName);
  return fileName;
}
