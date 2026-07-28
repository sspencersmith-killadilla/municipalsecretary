import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAttachmentLink } from "@/lib/attachments.functions";
import { PublicLayout, StatusPill } from "@/components/PublicLayout";
import { formatDate, formatDateTime, ITEM_STATUS_LABELS, statusTone } from "@/lib/format";


export const Route = createFileRoute("/legislation/$itemId")({
  head: () => ({
    meta: [
      { title: "Legislative File — Municipal Legislative Portal" },
      {
        name: "description",
        content:
          "Full text, sponsor, fiscal impact, meeting history and recorded votes for this legislative file.",
      },
      { property: "og:title", content: "Legislative File" },
      {
        property: "og:description",
        content: "Full text, history and recorded votes for this ordinance or resolution.",
      },
    ],
  }),
  component: ItemDetail,
});

function ItemDetail() {
  const { itemId } = Route.useParams();

  const item = useQuery({
    queryKey: ["public", "item", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislative_items")
        .select("*, item_types(name,readings_required), bodies(name)")
        .eq("id", itemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const history = useQuery({
    queryKey: ["public", "item-history", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select("id,outcome,meetings(id,title,starts_at,status)")
        .eq("item_id", itemId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attachments = useQuery({
    queryKey: ["public", "item-attachments", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_attachments")
        .select("id,file_name,size_bytes,created_at")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function openAttachment(attachmentId: string) {
    try {
      const res = await getAttachmentLink({ data: { attachmentId } });
      window.open(res.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document");
    }
  }



  const i = item.data;
  const type = (i?.item_types as { name?: string } | null)?.name;

  return (
    <PublicLayout>
      <div className="border-b border-rule bg-card">
        <div className="mx-auto max-w-4xl px-5 py-10">
          <Link to="/legislation" className="text-xs font-medium text-seal hover:underline">
            ← All legislation
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="docnum text-seal">{i?.assigned_number ?? i?.file_number}</span>
            <span className="docnum text-muted-foreground">{type}</span>
            {i ? (
              <StatusPill
                label={ITEM_STATUS_LABELS[i.status] ?? i.status}
                tone={statusTone(i.status)}
              />
            ) : null}
          </div>
          <h1 className="mt-3 font-display text-3xl leading-tight font-bold text-foreground">
            {i?.title ?? "Legislative file"}
          </h1>
          {i?.summary ? (
            <p className="mt-4 max-w-3xl text-[0.95rem] leading-relaxed text-muted-foreground">
              {i.summary}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1fr_240px]">
        <div className="space-y-10">
          <section>
            <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">Full text</h2>
            <div className="prose-record whitespace-pre-wrap pt-5 text-sm leading-relaxed text-foreground">
              {i?.body_text ?? "Full text has not been published for this file."}
            </div>
          </section>

          {i?.fiscal_impact ? (
            <section>
              <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">
                Fiscal impact
              </h2>
              <p className="pt-4 text-sm leading-relaxed text-foreground">{i.fiscal_impact}</p>
            </section>
          ) : null}

          {(attachments.data ?? []).length > 0 ? (
            <section>
              <h2 className="flex items-center gap-2 border-b border-rule pb-2 font-display text-xl font-bold">
                <Paperclip className="h-4 w-4" aria-hidden="true" /> Supporting documents
              </h2>
              <ul className="divide-y divide-border">
                {(attachments.data ?? []).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => openAttachment(a.id)}
                      className="min-w-0 flex-1 text-left font-medium text-foreground hover:text-seal hover:underline"
                    >
                      {a.file_name}
                    </button>
                    <span className="docnum text-xs text-muted-foreground">
                      {a.size_bytes ? `${Math.max(1, Math.round(a.size_bytes / 1024))} KB` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}



          <section>
            <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">
              Meeting history
            </h2>
            <ul className="divide-y divide-border">
              {(history.data ?? []).map((h) => {
                const mt = h.meetings as {
                  id: string;
                  title: string;
                  starts_at: string;
                } | null;
                if (!mt) return null;
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Link
                      to="/meetings/$meetingId"
                      params={{ meetingId: mt.id }}
                      className="min-w-0 flex-1 text-sm font-medium text-foreground hover:text-seal"
                    >
                      {mt.title}
                    </Link>
                    <span className="docnum text-muted-foreground">
                      {formatDateTime(mt.starts_at)}
                    </span>
                    {h.outcome ? <StatusPill label={h.outcome} tone={statusTone(h.outcome)} /> : null}
                  </li>
                );
              })}
              {(history.data ?? []).length === 0 && (
                <li className="py-4 text-sm text-muted-foreground">Not yet scheduled.</li>
              )}
            </ul>
          </section>
        </div>

        <aside>
          <div className="paper space-y-3 rounded-sm p-5 text-sm">
            <Detail label="File number" value={i?.file_number} />
            <Detail label="Sponsor" value={i?.sponsor} />
            <Detail label="Department" value={i?.department} />
            <Detail label="Body" value={(i?.bodies as { name?: string } | null)?.name} />
            <Detail label="Readings" value={String(i?.readings_completed ?? 0)} />
            <Detail label="Adopted" value={i?.adopted_at ? formatDate(i.adopted_at) : null} />
          </div>
        </aside>
      </div>
    </PublicLayout>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-0.5 text-foreground">{value || "—"}</p>
    </div>
  );
}
