import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageHeader } from "@/components/PublicLayout";
import { formatDate } from "@/lib/format";
import { quorumRequired } from "@/lib/votes";

export const Route = createFileRoute("/bodies/")({
  head: () => ({
    meta: [
      { title: "Boards, Commissions & Council — Municipal Legislative Portal" },
      {
        name: "description",
        content:
          "Membership, seats, terms and quorum requirements for the city council, boards and commissions.",
      },
      { property: "og:title", content: "Boards, Commissions & Council" },
      {
        property: "og:description",
        content: "Who serves on each legislative body, their seats, terms and quorum rules.",
      },
    ],
  }),
  component: BodiesPage,
});

function BodiesPage() {
  const bodies = useQuery({
    queryKey: ["public", "bodies-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bodies")
        .select("*, body_seats(id,seat_label,title,term_start,term_end,sort_order,members(full_name,email))")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Governance"
        title="Boards & councils"
        description="Each legislative body, its seats and members, meeting cadence and the quorum required to conduct business."
      />
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-12">
        {(bodies.data ?? []).map((b) => {
          const seats = [...((b.body_seats ?? []) as SeatRow[])].sort(
            (x, y) => x.sort_order - y.sort_order,
          );
          return (
            <section key={b.id} className="paper rounded-sm p-6">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">{b.name}</h2>
                  {b.description ? (
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{b.description}</p>
                  ) : null}
                </div>
                <p className="docnum text-muted-foreground">
                  {b.seat_count} seats · quorum{" "}
                  {quorumRequired(b.quorum_type, b.quorum_value, b.seat_count)}
                  {b.meeting_cadence ? ` · ${b.meeting_cadence}` : ""}
                </p>
              </div>
              <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {seats.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2"
                  >
                    <span>
                      <span className="text-sm font-medium text-foreground">
                        {s.members?.full_name ?? "Vacant"}
                      </span>
                      <span className="ml-2 docnum text-muted-foreground">
                        {s.title ?? s.seat_label}
                      </span>
                    </span>
                    <span className="docnum shrink-0 text-muted-foreground">
                      {s.term_end ? `term ends ${formatDate(s.term_end)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PublicLayout>
  );
}

type SeatRow = {
  id: string;
  seat_label: string;
  title: string | null;
  term_start: string | null;
  term_end: string | null;
  sort_order: number;
  members: { full_name: string; email: string | null } | null;
};
