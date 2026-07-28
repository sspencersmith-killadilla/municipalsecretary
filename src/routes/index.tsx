import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, FileText, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, StatusPill, useSettings } from "@/components/PublicLayout";
import { formatDateTime, formatDate, ITEM_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Municipal Legislative Portal — Agendas, Ordinances & Minutes" },
      {
        name: "description",
        content:
          "Browse upcoming meeting agendas, adopted ordinances and resolutions, recorded votes and official minutes for the municipality.",
      },
      { property: "og:title", content: "Municipal Legislative Portal" },
      {
        property: "og:description",
        content: "Agendas, ordinances, resolutions, minutes and recorded votes — all in one place.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: settings } = useSettings();

  const meetings = useQuery({
    queryKey: ["public", "upcoming-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,location,status,bodies(name,slug)")
        .in("status", ["published", "in_progress"])
        .order("starts_at", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const legislation = useQuery({
    queryKey: ["public", "recent-legislation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislative_items")
        .select("id,title,assigned_number,file_number,status,adopted_at,item_types(name)")
        .not("status", "in", "(draft,in_review,withdrawn)")
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PublicLayout>
      <section className="border-b border-rule bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1.25fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow">The public record</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.1] font-bold text-foreground sm:text-5xl">
              Every ordinance, agenda and vote — on the record and open to all.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              {settings?.tagline ??
                "Search legislation, follow meetings from notice through adoption, and see exactly how each member voted."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/legislation"
                className="inline-flex items-center gap-2 rounded-sm bg-seal px-5 py-2.5 text-sm font-semibold text-seal-foreground transition-opacity hover:opacity-90"
              >
                Search legislation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/meetings"
                className="inline-flex items-center gap-2 rounded-sm border border-input px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                Meeting calendar
              </Link>
            </div>
          </div>

          <div className="paper rounded-sm p-6">
            <p className="eyebrow">Next meetings</p>
            <ul className="mt-4 divide-y divide-border">
              {(meetings.data ?? []).map((m) => (
                <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                  <Link to="/meetings/$meetingId" params={{ meetingId: m.id }} className="group">
                    <p className="docnum text-muted-foreground">
                      {(m.bodies as { name?: string } | null)?.name}
                    </p>
                    <p className="mt-0.5 font-display text-sm font-bold text-foreground group-hover:text-seal">
                      {formatDateTime(m.starts_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.location}</p>
                  </Link>
                </li>
              ))}
              {meetings.data?.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">No meetings posted yet.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: FileText,
              title: "Legislation",
              body: "Ordinances, resolutions, contracts and appointments with full text, attachments and history.",
              to: "/legislation" as const,
            },
            {
              icon: CalendarDays,
              title: "Meetings",
              body: "Posted agendas, packets, minutes and the recorded outcome of every item.",
              to: "/meetings" as const,
            },
            {
              icon: Scale,
              title: "Boards & Councils",
              body: "Who sits on each body, their seats and terms, and how they have voted.",
              to: "/bodies" as const,
            },
          ].map((c) => (
            <Link key={c.title} to={c.to} className="paper group rounded-sm p-6 transition-colors hover:border-seal/50">
              <c.icon className="h-6 w-6 text-seal" strokeWidth={1.5} />
              <h2 className="mt-4 font-display text-lg font-bold text-foreground">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="flex items-end justify-between border-b border-rule pb-3">
          <h2 className="font-display text-xl font-bold">Recent legislative activity</h2>
          <Link to="/legislation" className="text-sm font-medium text-seal hover:underline">
            View all
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {(legislation.data ?? []).map((i) => (
            <li key={i.id}>
              <Link
                to="/legislation/$itemId"
                params={{ itemId: i.id }}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4 transition-colors hover:bg-accent/40"
              >
                <span className="docnum w-32 shrink-0 text-seal">
                  {i.assigned_number ?? i.file_number ?? "—"}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{i.title}</span>
                <StatusPill
                  label={ITEM_STATUS_LABELS[i.status] ?? i.status}
                  tone={statusTone(i.status)}
                />
                <span className="docnum text-muted-foreground">
                  {i.adopted_at ? formatDate(i.adopted_at) : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PublicLayout>
  );
}
