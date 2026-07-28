import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { formatDateTime, MEETING_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/briefings/")({
  head: () => ({
    meta: [
      { title: "Meeting Briefings — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Plain-language agenda briefings for council members and the city administrator, with financial impact at a glance.",
      },
      { property: "og:title", content: "Meeting Briefings" },
      {
        property: "og:description",
        content: "Plain-language agenda breakdowns and financial impact for each upcoming meeting.",
      },
    ],
  }),
  component: BriefingsIndex,
});

function BriefingsIndex() {
  const meetings = useQuery({
    queryKey: ["staff", "briefing-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,location,status,bodies(name),agenda_items(id)")
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const coverage = useQuery({
    queryKey: ["staff", "briefing-coverage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_item_briefings")
        .select("meeting_id");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data ?? []) map.set(r.meeting_id, (map.get(r.meeting_id) ?? 0) + 1);
      return map;
    },
  });

  const now = Date.now();
  const all = meetings.data ?? [];
  const upcoming = all.filter((m) => new Date(m.starts_at).getTime() >= now);
  const past = all.filter((m) => new Date(m.starts_at).getTime() < now).reverse();

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Council & administration"
        title="Meeting briefings"
        description="Every agenda item translated into plain language, grouped by department and priced out — built for council members and the city administrator preparing for a meeting."
      />
      <div className="space-y-10 p-6">
        <Group
          title="Upcoming meetings"
          empty="No meetings scheduled."
          rows={upcoming}
          coverage={coverage.data}
        />
        <Group
          title="Past meetings"
          empty="No past meetings on record."
          rows={past}
          coverage={coverage.data}
        />
      </div>
    </StaffShell>
  );
}

type MeetingRow = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  status: string;
  bodies: { name?: string } | null;
  agenda_items: { id: string }[] | null;
};

function Group({
  title,
  rows,
  empty,
  coverage,
}: {
  title: string;
  rows: MeetingRow[];
  empty: string;
  coverage?: Map<string, number>;
}) {
  return (
    <section>
      <h2 className="border-b border-rule pb-2 font-display text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((m) => {
            const total = m.agenda_items?.length ?? 0;
            const briefed = coverage?.get(m.id) ?? 0;
            return (
              <li key={m.id}>
                <Link
                  to="/staff/briefings/$meetingId"
                  params={{ meetingId: m.id }}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 transition-colors hover:bg-accent/40"
                >
                  <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="docnum text-muted-foreground">{m.bodies?.name}</p>
                    <p className="font-display text-base font-bold text-foreground">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(m.starts_at)} · {m.location ?? "Location TBD"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {briefed} of {total} items briefed
                  </span>
                  <StatusPill
                    label={MEETING_STATUS_LABELS[m.status] ?? m.status}
                    tone={statusTone(m.status)}
                  />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
