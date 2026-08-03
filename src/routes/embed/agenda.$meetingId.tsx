import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmbedFrame, embedHead } from "@/components/EmbedFrame";

export const Route = createFileRoute("/embed/agenda/$meetingId")({
  head: () =>
    embedHead("Agenda Widget", "Embeddable agenda listing for a posted public meeting."),
  component: AgendaWidget,
});

function AgendaWidget() {
  const { meetingId } = Route.useParams();

  const meeting = useQuery({
    queryKey: ["embed", "agenda", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,location,status")
        .eq("id", meetingId)
        .in("status", ["published", "in_progress", "adjourned"])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const items = useQuery({
    queryKey: ["embed", "agenda-items", meetingId],
    enabled: !!meeting.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select("id,section_name,section_order,position,display_number,title,is_consent")
        .eq("meeting_id", meetingId)
        .order("section_order")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (meeting.isLoading) {
    return (
      <EmbedFrame title="Agenda">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </EmbedFrame>
    );
  }

  if (!meeting.data) {
    return (
      <EmbedFrame title="Agenda">
        <p className="text-sm text-muted-foreground">
          This agenda is not posted publicly yet.
        </p>
      </EmbedFrame>
    );
  }

  const sections = Array.from(
    (items.data ?? []).reduce((map, item) => {
      const list = map.get(item.section_name) ?? [];
      list.push(item);
      map.set(item.section_name, list);
      return map;
    }, new Map<string, NonNullable<typeof items.data>>()),
  );

  return (
    <EmbedFrame title={meeting.data.title}>
      <p className="mb-3 text-sm text-muted-foreground">
        {new Date(meeting.data.starts_at).toLocaleString(undefined, {
          dateStyle: "full",
          timeStyle: "short",
        })}
        {meeting.data.location ? ` · ${meeting.data.location}` : ""}
      </p>
      <div className="space-y-4">
        {sections.map(([name, list]) => (
          <section key={name}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {name}
            </h2>
            <ol className="mt-1 space-y-1 text-sm">
              {list.map((item) => (
                <li key={item.id}>
                  <span className="text-muted-foreground">{item.display_number}</span>{" "}
                  {item.title}
                  {item.is_consent && (
                    <span className="ml-1 text-xs text-muted-foreground">(consent)</span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
        {!sections.length && (
          <p className="text-sm text-muted-foreground">No agenda items posted.</p>
        )}
      </div>
      <a
        href={`/meetings/${meetingId}`}
        target="_top"
        className="mt-4 inline-block text-sm underline-offset-2 hover:underline"
      >
        Open the full agenda packet
      </a>
    </EmbedFrame>
  );
}
