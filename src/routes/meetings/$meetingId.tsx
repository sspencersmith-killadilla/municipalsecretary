import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, StatusPill } from "@/components/PublicLayout";
import { PublicCommentForm, ApprovedComments } from "@/components/PublicCommentForm";
import { formatDateTime, MEETING_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/meetings/$meetingId")({
  head: () => ({
    meta: [
      { title: "Meeting Agenda & Minutes — Municipal Legislative Portal" },
      {
        name: "description",
        content:
          "Full agenda, item outcomes, roll call attendance, recorded votes and official minutes for this public meeting.",
      },
      { property: "og:title", content: "Meeting Agenda & Minutes" },
      {
        property: "og:description",
        content: "Agenda, attendance, recorded votes and minutes for this public meeting.",
      },
    ],
  }),
  component: MeetingDetail,
});

function MeetingDetail() {
  const { meetingId } = Route.useParams();

  const meeting = useQuery({
    queryKey: ["public", "meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, bodies(name,slug)")
        .eq("id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const agenda = useQuery({
    queryKey: ["public", "agenda", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select("*, legislative_items(id,title,assigned_number,file_number,status)")
        .eq("meeting_id", meetingId)
        .order("section_order")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const attendance = useQuery({
    queryKey: ["public", "attendance", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("status, members(full_name)")
        .eq("meeting_id", meetingId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const motions = useQuery({
    queryKey: ["public", "motions", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motions")
        .select("*, votes(choice, members(full_name))")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const minutes = useQuery({
    queryKey: ["public", "minutes", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minutes")
        .select("content,finalized,finalized_at")
        .eq("meeting_id", meetingId)
        .eq("finalized", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const notices = useQuery({
    queryKey: ["public", "notices", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_notices")
        .select("id,notice_kind,version,posted_at,posted_locations,content")
        .eq("meeting_id", meetingId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const media = useQuery({
    queryKey: ["public", "media", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_media")
        .select("id,label,url,media_type,captions_available")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const m = meeting.data;
  const sections = groupSections(agenda.data ?? []);
  const closedSession = useQuery({
    queryKey: ["public", "closed-session", meetingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("closed_minutes")
        .select("citation,public_action_taken")
        .eq("meeting_id", meetingId)
        .maybeSingle();
      return data;
    },
  });

  const commentItems = (agenda.data ?? [])
    .filter((a) => a.item_id)
    .map((a) => ({ id: a.id, title: a.title, display_number: a.display_number }));


  return (
    <PublicLayout>
      <div className="border-b border-rule bg-card">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <Link to="/meetings" className="text-xs font-medium text-seal hover:underline">
            ← All meetings
          </Link>
          <p className="eyebrow mt-4">{(m?.bodies as { name?: string } | null)?.name}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">
            {m?.title ?? "Meeting"}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{formatDateTime(m?.starts_at)}</span>
            <span>·</span>
            <span>{m?.location ?? "Location TBD"}</span>
            {m ? (
              <StatusPill
                label={MEETING_STATUS_LABELS[m.status] ?? m.status}
                tone={statusTone(m.status)}
              />
            ) : null}
            {m?.meeting_kind && m.meeting_kind !== "regular" ? (
              <StatusPill label={`${m.meeting_kind} meeting`} tone="warn" />
            ) : null}
          </div>
          {m?.cancelled_at ? (
            <p
              role="alert"
              className="mt-4 rounded-sm border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-foreground"
            >
              <strong>This meeting was cancelled</strong> on {formatDateTime(m.cancelled_at)}.
              {m.cancellation_reason ? ` ${m.cancellation_reason}` : ""}
            </p>
          ) : null}
          {m?.meeting_kind === "emergency" && m?.emergency_justification ? (
            <p className="mt-4 rounded-sm border border-border bg-secondary px-4 py-3 text-sm">
              <strong>Emergency justification:</strong> {m.emergency_justification}
            </p>
          ) : null}
        </div>
      </div>


      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1fr_260px]">
        <div className="space-y-10">
          <section>
            <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">Agenda</h2>
            {sections.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Agenda has not been posted.</p>
            ) : (
              <div className="space-y-8 pt-5">
                {sections.map((s) => (
                  <div key={s.name}>
                    <p className="eyebrow">{s.name}</p>
                    <ul className="mt-3 divide-y divide-border border-t border-border">
                      {s.items.map((it) => {
                        const li = it.legislative_items as {
                          id: string;
                          title: string;
                          assigned_number: string | null;
                          file_number: string | null;
                        } | null;
                        return (
                          <li key={it.id} className="flex flex-wrap gap-x-4 gap-y-1 py-3">
                            <span className="docnum w-14 shrink-0 text-muted-foreground">
                              {it.display_number ?? ""}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{it.title}</p>
                              {li ? (
                                <Link
                                  to="/legislation/$itemId"
                                  params={{ itemId: li.id }}
                                  className="docnum text-seal hover:underline"
                                >
                                  {li.assigned_number ?? li.file_number}
                                </Link>
                              ) : null}
                            </div>
                            {it.outcome ? (
                              <StatusPill label={it.outcome} tone={statusTone(it.outcome)} />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(motions.data ?? []).length > 0 && (
            <section>
              <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">
                Recorded votes
              </h2>
              <div className="space-y-5 pt-5">
                {(motions.data ?? []).map((mo) => {
                  const tally = (mo.tally ?? {}) as Record<string, number>;
                  return (
                    <div key={mo.id} className="paper rounded-sm p-5">
                      <p className="text-sm font-medium text-foreground">{mo.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <StatusPill
                          label={mo.result ?? "Pending"}
                          tone={statusTone(mo.result === "passed" ? "adopted" : mo.result === "failed" ? "failed" : "draft")}
                        />
                        <span className="docnum">
                          Aye {tally.aye ?? 0} · Nay {tally.nay ?? 0} · Abstain {tally.abstain ?? 0}
                        </span>
                      </div>
                      <ul className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        {(mo.votes ?? []).map((v, idx) => (
                          <li key={idx} className="flex justify-between border-b border-border/60 py-1">
                            <span>{(v.members as { full_name?: string } | null)?.full_name}</span>
                            <span className="docnum uppercase">{v.choice}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {closedSession.data?.public_action_taken ? (
            <section>
              <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">
                Executive session
              </h2>
              <p className="pt-5 text-sm leading-relaxed">
                {closedSession.data.citation ? (
                  <span className="docnum block text-xs uppercase text-muted-foreground">
                    Authority: {closedSession.data.citation}
                  </span>
                ) : null}
                {closedSession.data.public_action_taken}
              </p>
            </section>
          ) : null}


          {minutes.data ? (
            <section>
              <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">
                Official minutes
              </h2>
              <div className="prose-record whitespace-pre-wrap pt-5 text-sm leading-relaxed text-foreground">
                {minutes.data.content}
              </div>
            </section>
          ) : null}

          <section id="public-comment">
            <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">
              Public comment
            </h2>
            <div className="space-y-5 pt-5">
              <PublicCommentForm
                meetingId={meetingId}
                agendaItems={commentItems}
                open={m?.comments_open ?? true}
                deadline={m?.comment_deadline ?? null}
              />
              <ApprovedComments meetingId={meetingId} />
            </div>
          </section>
        </div>


        <aside className="space-y-6">
          <div className="paper rounded-sm p-5">
            <p className="eyebrow">Attendance</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {(attendance.data ?? []).map((a, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-foreground">
                    {(a.members as { full_name?: string } | null)?.full_name}
                  </span>
                  <span className="docnum text-muted-foreground">{a.status}</span>
                </li>
              ))}
              {(attendance.data ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Roll call not yet taken.</li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </PublicLayout>
  );
}

type AgendaRow = {
  id: string;
  section_name: string;
  section_order: number;
  display_number: string | null;
  title: string;
  outcome: string | null;
  legislative_items: unknown;
};

function groupSections(rows: AgendaRow[]) {
  const map = new Map<string, { name: string; order: number; items: AgendaRow[] }>();
  for (const r of rows) {
    const key = r.section_name;
    if (!map.has(key)) map.set(key, { name: key, order: r.section_order, items: [] });
    map.get(key)!.items.push(r);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}
