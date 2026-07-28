import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageHeader, StatusPill } from "@/components/PublicLayout";
import { formatDateTime, MEETING_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/meetings/")({
  head: () => ({
    meta: [
      { title: "Meeting Calendar & Agendas — Municipal Legislative Portal" },
      {
        name: "description",
        content:
          "Upcoming and past meetings of the city council, boards and commissions with posted agendas, packets and minutes.",
      },
      { property: "og:title", content: "Meeting Calendar & Agendas" },
      {
        property: "og:description",
        content: "Posted agendas, packets and minutes for every public meeting.",
      },
    ],
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["public", "meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,location,status,bodies(name)")
        .in("status", ["published", "in_progress", "adjourned"])
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const now = Date.now();
  const upcoming = (data ?? []).filter((m) => new Date(m.starts_at).getTime() >= now).reverse();
  const past = (data ?? []).filter((m) => new Date(m.starts_at).getTime() < now);

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Public meetings"
        title="Meeting calendar"
        description="Agendas are posted in advance of each meeting. Minutes and recorded votes are published after adjournment."
      />
      <div className="mx-auto max-w-6xl space-y-12 px-5 py-12">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading meetings…</p> : null}
        <Section title="Upcoming" meetings={upcoming} empty="No meetings currently noticed." />
        <Section title="Past meetings" meetings={past} empty="No past meetings on record." />
      </div>
    </PublicLayout>
  );
}

type Row = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  status: string;
  bodies: { name?: string } | null;
};

function Section({ title, meetings, empty }: { title: string; meetings: Row[]; empty: string }) {
  return (
    <section>
      <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">{title}</h2>
      {meetings.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link
                to="/meetings/$meetingId"
                params={{ meetingId: m.id }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="docnum text-muted-foreground">{m.bodies?.name}</p>
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
        </ul>
      )}
    </section>
  );
}
