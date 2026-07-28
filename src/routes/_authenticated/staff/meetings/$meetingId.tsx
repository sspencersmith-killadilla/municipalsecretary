import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2, Plus, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { formatDateTime, MEETING_STATUS_LABELS, statusTone } from "@/lib/format";
import { downloadAgendaPacket } from "@/lib/documents";
import { NoticePanel } from "@/components/staff/NoticePanel";
import { MeetingComplianceSettings } from "@/components/staff/MeetingComplianceSettings";
import { ClosedSessionPanel } from "@/components/staff/ClosedSessionPanel";


export const Route = createFileRoute("/_authenticated/staff/meetings/$meetingId")({
  head: () => ({
    meta: [
      { title: "Agenda Builder — CivicLedger Staff" },
      { name: "description", content: "Assemble, order and publish the agenda for this meeting." },
      { property: "og:title", content: "Agenda Builder" },
      { property: "og:description", content: "Assemble and order this meeting's agenda." },
    ],
  }),
  component: AgendaBuilder,
});

type AgendaRow = {
  id: string;
  title: string;
  display_number: string | null;
  section_name: string;
  section_order: number;
  position: number;
  is_consent: boolean;
  item_id: string | null;
  outcome: string | null;
};

const DEFAULT_SECTIONS = [
  "Call to Order",
  "Public Comment",
  "Consent Agenda",
  "Public Hearings",
  "Ordinances",
  "Resolutions",
  "Reports",
  "Adjournment",
];

function AgendaBuilder() {
  const { meetingId } = Route.useParams();
  const qc = useQueryClient();
  const [section, setSection] = useState(DEFAULT_SECTIONS[4]);
  const [customTitle, setCustomTitle] = useState("");

  const meeting = useQuery({
    queryKey: ["staff", "meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, bodies(name)")
        .eq("id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const agenda = useQuery({
    queryKey: ["staff", "agenda", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select(
          "id,title,display_number,section_name,section_order,position,is_consent,item_id,outcome",
        )
        .eq("meeting_id", meetingId)
        .order("section_order")
        .order("position");
      if (error) throw error;
      return (data ?? []) as AgendaRow[];
    },
  });

  const eligible = useQuery({
    queryKey: ["staff", "eligible-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislative_items")
        .select("id,title,assigned_number,file_number,status")
        .in("status", ["approved", "scheduled", "in_review"])
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = agenda.data ?? [];
  const scheduledIds = new Set(rows.map((r) => r.item_id).filter(Boolean) as string[]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff", "agenda", meetingId] });

  const addItem = useMutation({
    mutationFn: async (input: { title: string; itemId?: string | null; number?: string | null }) => {
      const sectionOrder = DEFAULT_SECTIONS.indexOf(section);
      const inSection = rows.filter((r) => r.section_name === section);
      const { error } = await supabase.from("agenda_items").insert({
        meeting_id: meetingId,
        item_id: input.itemId ?? null,
        section_name: section,
        section_order: sectionOrder < 0 ? 99 : sectionOrder,
        position: inSection.length + 1,
        title: input.title,
        display_number: input.number ?? null,
        is_consent: section === "Consent Agenda",
      });
      if (error) throw error;
      if (input.itemId) {
        await supabase
          .from("legislative_items")
          .update({ status: "scheduled" })
          .eq("id", input.itemId);
      }
    },
    onSuccess: () => {
      setCustomTitle("");
      toast.success("Added to agenda");
      refresh();
      qc.invalidateQueries({ queryKey: ["staff", "eligible-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ row, dir }: { row: AgendaRow; dir: -1 | 1 }) => {
      const siblings = rows
        .filter((r) => r.section_name === row.section_name)
        .sort((a, b) => a.position - b.position);
      const idx = siblings.findIndex((r) => r.id === row.id);
      const swap = siblings[idx + dir];
      if (!swap) return;
      const a = supabase
        .from("agenda_items")
        .update({ position: swap.position })
        .eq("id", row.id);
      const b = supabase
        .from("agenda_items")
        .update({ position: row.position })
        .eq("id", swap.id);
      const [r1, r2] = await Promise.all([a, b]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const renumber = useMutation({
    mutationFn: async () => {
      let n = 0;
      for (const r of rows) {
        n += 1;
        const { error } = await supabase
          .from("agenda_items")
          .update({ display_number: String(n) })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Agenda renumbered");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportPacket = useMutation({
    mutationFn: () => downloadAgendaPacket(meetingId),
    onSuccess: (fileName) => toast.success(`Downloaded ${fileName}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("meetings")
        .update({
          status: status as never,
          published_at: status === "published" ? new Date().toISOString() : null,
        })
        .eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting updated");
      qc.invalidateQueries({ queryKey: ["staff", "meeting", meetingId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = DEFAULT_SECTIONS.map((s) => ({
    name: s,
    items: rows.filter((r) => r.section_name === s),
  })).filter((g) => g.items.length > 0);
  const other = rows.filter((r) => !DEFAULT_SECTIONS.includes(r.section_name));
  if (other.length) grouped.push({ name: "Other", items: other });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow={(meeting.data?.bodies as { name?: string } | null)?.name ?? "Meeting"}
        title={meeting.data?.title ?? "Agenda"}
        description={formatDateTime(meeting.data?.starts_at)}
        actions={
          <>
            {meeting.data ? (
              <StatusPill
                label={MEETING_STATUS_LABELS[meeting.data.status] ?? meeting.data.status}
                tone={statusTone(meeting.data.status)}
              />
            ) : null}
            <button
              onClick={() => renumber.mutate()}
              className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold"
            >
              Renumber
            </button>
            <button
              onClick={() => exportPacket.mutate()}
              disabled={exportPacket.isPending}
              className="inline-flex items-center gap-1.5 rounded-sm border border-input px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" /> Agenda packet PDF
            </button>
            <button
              onClick={() => setStatus.mutate("published")}
              className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold"
            >
              Publish agenda
            </button>
            <Link
              to="/staff/briefings/$meetingId"
              params={{ meetingId }}
              className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold"
            >
              Council briefing
            </Link>
            <Link
              to="/staff/console/$meetingId"
              params={{ meetingId }}
              className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground"
            >
              Open meeting console
            </Link>
          </>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-sm border border-border bg-card">
          <h2 className="border-b border-rule px-5 py-3 font-display text-base font-bold">
            Agenda order
          </h2>
          {grouped.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">
              No agenda items yet — add legislation or a procedural item from the panel.
            </p>
          ) : (
            grouped.map((g) => (
              <div key={g.name}>
                <p className="eyebrow border-b border-border bg-secondary px-5 py-1.5">{g.name}</p>
                <ul className="divide-y divide-border">
                  {g.items.map((a, i) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="docnum w-8 text-muted-foreground">
                        {a.display_number ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-foreground">{a.title}</span>
                      {a.outcome ? (
                        <span className="docnum text-xs text-muted-foreground">{a.outcome}</span>
                      ) : null}
                      <button
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => move.mutate({ row: a, dir: -1 })}
                        className="rounded-sm border border-input p-1 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label="Move down"
                        disabled={i === g.items.length - 1}
                        onClick={() => move.mutate({ row: a, dir: 1 })}
                        className="rounded-sm border border-input p-1 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label="Remove"
                        onClick={() => removeItem.mutate(a.id)}
                        className="rounded-sm border border-input p-1 text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-sm border border-border bg-card p-5">
            <h2 className="font-display text-base font-bold">Add to section</h2>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="mt-3 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            >
              {DEFAULT_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!customTitle.trim()) return;
                addItem.mutate({ title: customTitle.trim() });
              }}
            >
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Procedural item…"
                className="min-w-0 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Add
              </button>
            </form>
          </section>

          <section className="rounded-sm border border-border bg-card p-5">
            <h2 className="font-display text-base font-bold">Ready for agenda</h2>
            <ul className="mt-2 divide-y divide-border">
              {(eligible.data ?? [])
                .filter((it) => !scheduledIds.has(it.id))
                .map((it) => (
                  <li key={it.id} className="flex items-start gap-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="docnum block text-xs text-muted-foreground">
                        {it.assigned_number ?? it.file_number ?? "unnumbered"}
                      </span>
                      <span className="block text-sm text-foreground">{it.title}</span>
                    </span>
                    <button
                      aria-label="Add to agenda"
                      onClick={() =>
                        addItem.mutate({
                          title: it.title,
                          itemId: it.id,
                          number: it.assigned_number,
                        })
                      }
                      className="mt-0.5 rounded-sm border border-input p-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              {(eligible.data ?? []).filter((it) => !scheduledIds.has(it.id)).length === 0 && (
                <li className="py-6 text-sm text-muted-foreground">
                  No approved files awaiting an agenda.
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>

      {meeting.data ? (
        <div className="grid gap-6 px-6 pb-10 lg:grid-cols-2">
          <NoticePanel
            meeting={meeting.data as never}
            agenda={rows.map((r) => ({ display_number: r.display_number, title: r.title }))}
          />
          <div className="space-y-6">
            <MeetingComplianceSettings meeting={meeting.data as never} />
            <ClosedSessionPanel meetingId={meetingId} />
          </div>
        </div>
      ) : null}
    </StaffShell>
  );
}

