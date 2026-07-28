import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/meetings/$meetingId")({
  head: () => ({
    meta: [
      { title: "Agenda Builder — CivicLedger Staff" },
      { name: "description", content: "Assemble and order the agenda for this meeting." },
      { property: "og:title", content: "Agenda Builder" },
      { property: "og:description", content: "Assemble and order this meeting's agenda." },
    ],
  }),
  component: AgendaBuilder,
});

function AgendaBuilder() {
  const { meetingId } = Route.useParams();

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
        .select("id,title,display_number,section_name,section_order,position,outcome")
        .eq("meeting_id", meetingId)
        .order("section_order")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow={(meeting.data?.bodies as { name?: string } | null)?.name ?? "Meeting"}
        title={meeting.data?.title ?? "Agenda"}
        description={formatDateTime(meeting.data?.starts_at)}
        actions={
          <Link
            to="/staff/console/$meetingId"
            params={{ meetingId }}
            className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground"
          >
            Open meeting console
          </Link>
        }
      />
      <div className="p-6">
        <ul className="divide-y divide-border border-t border-rule">
          {(agenda.data ?? []).map((a) => (
            <li key={a.id} className="flex gap-4 py-3">
              <span className="docnum w-16 text-muted-foreground">{a.display_number ?? ""}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{a.title}</span>
                <span className="eyebrow">{a.section_name}</span>
              </span>
            </li>
          ))}
          {(agenda.data ?? []).length === 0 && (
            <li className="py-8 text-sm text-muted-foreground">No agenda items yet.</li>
          )}
        </ul>
      </div>
    </StaffShell>
  );
}
