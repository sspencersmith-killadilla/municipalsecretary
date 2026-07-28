import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/console/")({
  head: () => ({
    meta: [
      { title: "Meeting Console — CivicLedger Staff" },
      { name: "description", content: "Run roll call, motions, electronic voting and live minutes." },
      { property: "og:title", content: "Meeting Console" },
      { property: "og:description", content: "Run a live meeting from gavel to adjournment." },
    ],
  }),
  component: ConsolePicker,
});

function ConsolePicker() {
  const q = useQuery({
    queryKey: ["staff", "console-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,status,bodies(name)")
        .in("status", ["published", "in_progress"])
        .order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Live"
        title="Meeting console"
        description="Choose a meeting to call to order."
      />
      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((m) => (
          <Link
            key={m.id}
            to="/staff/console/$meetingId"
            params={{ meetingId: m.id }}
            className="rounded-sm border border-border bg-card p-5 hover:border-seal/50"
          >
            <p className="docnum text-muted-foreground">
              {(m.bodies as { name?: string } | null)?.name}
            </p>
            <p className="mt-1 font-display text-base font-bold">{m.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(m.starts_at)}</p>
          </Link>
        ))}
        {(q.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No meetings are ready to run.</p>
        )}
      </div>
    </StaffShell>
  );
}
