import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/console/$meetingId")({
  head: () => ({
    meta: [
      { title: "Live Meeting Console — CivicLedger Staff" },
      { name: "description", content: "Roll call, motions, electronic voting and live minutes." },
      { property: "og:title", content: "Live Meeting Console" },
      { property: "og:description", content: "Run the meeting and record every vote." },
    ],
  }),
  component: LiveConsole,
});

function LiveConsole() {
  const { meetingId } = Route.useParams();
  const queryClient = useQueryClient();

  const meeting = useQuery({
    queryKey: ["console", "meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, bodies(name,seat_count,quorum_type,quorum_value)")
        .eq("id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const agenda = useQuery({
    queryKey: ["console", "agenda", meetingId],
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

  const setStatus = useMutation({
    mutationFn: async (status: "in_progress" | "adjourned") => {
      const { error } = await supabase.from("meetings").update({ status }).eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting updated");
      queryClient.invalidateQueries({ queryKey: ["console", "meeting", meetingId] });
    },
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow={(meeting.data?.bodies as { name?: string } | null)?.name ?? "Meeting"}
        title={meeting.data?.title ?? "Meeting console"}
        description={formatDateTime(meeting.data?.starts_at)}
        actions={
          <>
            <button
              onClick={() => setStatus.mutate("in_progress")}
              className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground"
            >
              Call to order
            </button>
            <button
              onClick={() => setStatus.mutate("adjourned")}
              className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold"
            >
              Adjourn
            </button>
          </>
        }
      />
      <div className="p-6">
        <ul className="divide-y divide-border border-t border-rule">
          {(agenda.data ?? []).map((a) => (
            <li key={a.id} className="flex gap-4 py-3">
              <span className="docnum w-16 text-muted-foreground">{a.display_number ?? ""}</span>
              <span className="min-w-0 flex-1 text-sm text-foreground">{a.title}</span>
              <span className="docnum text-muted-foreground">{a.outcome ?? "pending"}</span>
            </li>
          ))}
          {(agenda.data ?? []).length === 0 && (
            <li className="py-8 text-sm text-muted-foreground">No agenda items.</li>
          )}
        </ul>
      </div>
    </StaffShell>
  );
}
