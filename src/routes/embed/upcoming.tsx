import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmbedFrame, embedHead } from "@/components/EmbedFrame";

export const Route = createFileRoute("/embed/upcoming")({
  head: () =>
    embedHead(
      "Upcoming Meetings Widget",
      "Embeddable list of upcoming public meetings and posted agendas.",
    ),
  component: UpcomingWidget,
});

function UpcomingWidget() {
  const meetings = useQuery({
    queryKey: ["embed", "upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,location,status,bodies(name)")
        .in("status", ["published", "in_progress"])
        .gte("starts_at", new Date(Date.now() - 6 * 3600 * 1000).toISOString())
        .order("starts_at")
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <EmbedFrame title="Upcoming public meetings">
      {meetings.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <ul className="divide-y divide-border">
        {(meetings.data ?? []).map((m) => (
          <li key={m.id} className="py-3">
            <a
              href={`/meetings/${m.id}`}
              target="_top"
              className="font-medium underline-offset-2 hover:underline"
            >
              {m.title}
            </a>
            <p className="text-sm text-muted-foreground">
              {new Date(m.starts_at).toLocaleString(undefined, {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {(m.bodies as { name: string } | null)?.name}
              {m.location ? ` · ${m.location}` : ""}
            </p>
          </li>
        ))}
        {!meetings.isLoading && !meetings.data?.length && (
          <li className="py-3 text-sm text-muted-foreground">No meetings are currently posted.</li>
        )}
      </ul>
    </EmbedFrame>
  );
}
