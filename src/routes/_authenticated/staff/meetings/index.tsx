import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { formatDateTime, MEETING_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/meetings/")({
  head: () => ({
    meta: [
      { title: "Meetings & Agendas — CivicLedger Staff" },
      { name: "description", content: "Schedule meetings, assemble agendas and publish packets." },
      { property: "og:title", content: "Meetings & Agendas" },
      { property: "og:description", content: "Schedule meetings and assemble agendas." },
    ],
  }),
  component: StaffMeetings,
});

function StaffMeetings() {
  const q = useQuery({
    queryKey: ["staff", "meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,location,status,bodies(name)")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Clerk"
        title="Meetings & agendas"
        description="Every scheduled meeting and the state of its agenda."
      />
      <div className="p-6">
        <ul className="divide-y divide-border border-t border-rule">
          {(q.data ?? []).map((m) => (
            <li key={m.id}>
              <Link
                to="/staff/meetings/$meetingId"
                params={{ meetingId: m.id }}
                className="flex flex-wrap items-center gap-4 py-4 hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="docnum text-muted-foreground">
                    {(m.bodies as { name?: string } | null)?.name}
                  </p>
                  <p className="font-display text-base font-bold text-foreground">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.starts_at)} · {m.location ?? "Location TBD"}
                  </p>
                </div>
                <StatusPill
                  label={MEETING_STATUS_LABELS[m.status] ?? m.status}
                  tone={statusTone(m.status)}
                />
              </Link>
            </li>
          ))}
          {(q.data ?? []).length === 0 && (
            <li className="py-8 text-sm text-muted-foreground">No meetings yet.</li>
          )}
        </ul>
      </div>
    </StaffShell>
  );
}
