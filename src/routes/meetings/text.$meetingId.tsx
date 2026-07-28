import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/PublicLayout";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/meetings/text/$meetingId")({
  head: () => ({
    meta: [
      { title: "Text Version of Agenda and Minutes — Legislative Portal" },
      {
        name: "description",
        content:
          "Plain HTML text alternative to the PDF agenda packet and official minutes, formatted for screen readers, magnification and printing.",
      },
      { property: "og:title", content: "Text Version of Agenda and Minutes" },
      {
        property: "og:description",
        content: "Screen-reader friendly text alternative to the meeting PDF documents.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingTextVersion,
});

function MeetingTextVersion() {
  const { meetingId } = Route.useParams();

  const meeting = useQuery({
    queryKey: ["public", "meeting", meetingId],
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
    queryKey: ["public", "agenda", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select("*, legislative_items(id,title,assigned_number,file_number,summary)")
        .eq("meeting_id", meetingId)
        .order("section_order")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const minutes = useQuery({
    queryKey: ["public", "minutes", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minutes")
        .select("content,finalized_at")
        .eq("meeting_id", meetingId)
        .eq("finalized", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const m = meeting.data;
  const rows = agenda.data ?? [];
  const sections = Array.from(new Set(rows.map((r) => r.section_name)));

  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow">Accessible text version</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">
          {m ? m.title : "Meeting record"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {m ? (
            <>
              {(m.bodies as { name?: string } | null)?.name} · {formatDateTime(m.starts_at)}
              {m.location ? ` · ${m.location}` : ""}
            </>
          ) : (
            "Loading…"
          )}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          This page is the text alternative to the PDF agenda packet and minutes for this meeting.
          It contains the same content in HTML so it can be read with a screen reader, enlarged, or
          translated.{" "}
          <Link
            to="/meetings/$meetingId"
            params={{ meetingId }}
            className="text-seal underline"
          >
            Return to the meeting page
          </Link>
          .
        </p>

        <h2 className="mt-10 border-b border-rule pb-2 font-display text-xl font-bold">Agenda</h2>
        {sections.length === 0 ? (
          <p className="pt-4 text-sm text-muted-foreground">No agenda has been posted yet.</p>
        ) : (
          sections.map((section) => (
            <section key={section} className="pt-6">
              <h3 className="font-display text-base font-bold text-foreground">{section}</h3>
              <ol className="mt-2 space-y-3">
                {rows
                  .filter((r) => r.section_name === section)
                  .map((r) => {
                    const file = r.legislative_items as {
                      id?: string;
                      assigned_number?: string | null;
                      file_number?: string | null;
                      summary?: string | null;
                    } | null;
                    return (
                      <li key={r.id} className="text-sm leading-relaxed text-foreground">
                        <span className="docnum mr-2 text-muted-foreground">
                          {r.display_number ?? "—"}
                        </span>
                        {r.title}
                        {file?.assigned_number || file?.file_number ? (
                          <span className="docnum ml-2 text-xs text-muted-foreground">
                            ({file.assigned_number ?? file.file_number})
                          </span>
                        ) : null}
                        {r.is_consent ? (
                          <span className="ml-2 text-xs uppercase tracking-wider text-muted-foreground">
                            Consent
                          </span>
                        ) : null}
                        {file?.summary ? (
                          <p className="mt-1 text-muted-foreground">{file.summary}</p>
                        ) : null}
                        {r.outcome ? (
                          <p className="mt-1 text-muted-foreground">Outcome: {r.outcome}</p>
                        ) : null}
                        {file?.id ? (
                          <p className="mt-1">
                            <Link
                              to="/legislation/$itemId"
                              params={{ itemId: file.id }}
                              className="text-seal underline"
                            >
                              Read the full file
                            </Link>
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))
        )}

        <h2 className="mt-10 border-b border-rule pb-2 font-display text-xl font-bold">Minutes</h2>
        {minutes.data ? (
          <>
            <p className="pt-4 text-xs uppercase tracking-wider text-muted-foreground">
              Approved {minutes.data.finalized_at ? formatDateTime(minutes.data.finalized_at) : ""}
            </p>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {minutes.data.content}
            </div>
          </>
        ) : (
          <p className="pt-4 text-sm text-muted-foreground">
            Minutes have not been approved for this meeting yet.
          </p>
        )}
      </article>
    </PublicLayout>
  );
}
