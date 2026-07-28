import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageHeader, StatusPill } from "@/components/PublicLayout";
import { formatDate, ITEM_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/legislation/")({
  head: () => ({
    meta: [
      { title: "Search Ordinances & Resolutions — Municipal Legislative Portal" },
      {
        name: "description",
        content:
          "Search and browse ordinances, resolutions, contracts and appointments with status, sponsor and adoption date.",
      },
      { property: "og:title", content: "Search Ordinances & Resolutions" },
      {
        property: "og:description",
        content: "Full-text search of the municipality's legislative record.",
      },
    ],
  }),
  component: LegislationPage,
});

function LegislationPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  const types = useQuery({
    queryKey: ["public", "item-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_types")
        .select("id,name")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = useQuery({
    queryKey: ["public", "legislation", q, type, status],
    queryFn: async () => {
      let query = supabase
        .from("legislative_items")
        .select(
          "id,title,summary,assigned_number,file_number,status,adopted_at,sponsor,department,item_types(name)",
        )
        .not("status", "in", "(draft,in_review,withdrawn)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (q.trim())
        query = query.or(
          `title.ilike.%${q}%,summary.ilike.%${q}%,assigned_number.ilike.%${q}%,file_number.ilike.%${q}%`,
        );
      if (type) query = query.eq("item_type_id", type);
      if (status) query = query.eq("status", status as never);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Legislative record"
        title="Ordinances & resolutions"
        description="Every published legislative file, from introduction through final adoption."
      />
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="paper flex flex-wrap items-end gap-3 rounded-sm p-4">
          <label className="min-w-[220px] flex-1">
            <span className="eyebrow">Search</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-sm border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Title, summary or number"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
          </label>
          <label>
            <span className="eyebrow">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1.5 block rounded-sm border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              {(types.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="eyebrow">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1.5 block rounded-sm border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Any status</option>
              {["approved", "scheduled", "adopted", "failed", "tabled"].map((s) => (
                <option key={s} value={s}>
                  {ITEM_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="mt-8 divide-y divide-border border-t border-rule">
          {(items.data ?? []).map((i) => (
            <li key={i.id}>
              <Link
                to="/legislation/$itemId"
                params={{ itemId: i.id }}
                className="block py-5 transition-colors hover:bg-accent/40"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="docnum text-seal">{i.assigned_number ?? i.file_number}</span>
                  <span className="docnum text-muted-foreground">
                    {(i.item_types as { name?: string } | null)?.name}
                  </span>
                  <StatusPill
                    label={ITEM_STATUS_LABELS[i.status] ?? i.status}
                    tone={statusTone(i.status)}
                  />
                  {i.adopted_at ? (
                    <span className="docnum text-muted-foreground">
                      Adopted {formatDate(i.adopted_at)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 font-display text-base font-bold text-foreground">{i.title}</p>
                {i.summary ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{i.summary}</p>
                ) : null}
              </Link>
            </li>
          ))}
          {items.data?.length === 0 && (
            <li className="py-8 text-sm text-muted-foreground">No legislation matches that search.</li>
          )}
        </ul>
      </div>
    </PublicLayout>
  );
}
