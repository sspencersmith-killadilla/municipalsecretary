import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, Trash2, Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";

function prettySize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_BYTES = 25 * 1024 * 1024;

export function AttachmentsPanel({ itemId }: { itemId: string }) {
  const qc = useQueryClient();
  const { canManage } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const attachments = useQuery({
    queryKey: ["staff", "attachments", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_attachments")
        .select("*")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_BYTES) throw new Error("Files must be 25 MB or smaller.");
      const { data: auth } = await supabase.auth.getUser();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `items/${itemId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from("records").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) throw up.error;
      const { error } = await supabase.from("item_attachments").insert({
        item_id: itemId,
        file_name: file.name,
        storage_path: path,
        content_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      await supabase.from("audit_log").insert({
        entity_type: "legislative_item",
        entity_id: itemId,
        action: "attachment_added",
        detail: file.name,
        actor_id: auth.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Attachment uploaded");
      qc.invalidateQueries({ queryKey: ["staff", "attachments", itemId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (a: { id: string; storage_path: string; file_name: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      await supabase.storage.from("records").remove([a.storage_path]);
      const { error } = await supabase.from("item_attachments").delete().eq("id", a.id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        entity_type: "legislative_item",
        entity_id: itemId,
        action: "attachment_removed",
        detail: a.file_name,
        actor_id: auth.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Attachment removed");
      qc.invalidateQueries({ queryKey: ["staff", "attachments", itemId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openFile(path: string, fileName: string) {
    setBusy(true);
    const { data, error } = await supabase.storage
      .from("records")
      .createSignedUrl(path, 300, { download: fileName });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const rows = attachments.data ?? [];

  return (
    <section className="rounded-sm border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5" /> Supporting documents
        </p>
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="inline-flex items-center gap-1.5 rounded-sm border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {upload.isPending ? "Uploading…" : "Attach file"}
          </button>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
            <button
              type="button"
              disabled={busy}
              onClick={() => openFile(a.storage_path, a.file_name)}
              className="min-w-0 flex-1 truncate text-left font-medium text-foreground hover:text-seal"
            >
              {a.file_name}
            </button>
            <span className="docnum text-xs text-muted-foreground">{prettySize(a.size_bytes)}</span>
            <span className="docnum text-xs text-muted-foreground">
              {formatDateTime(a.created_at)}
            </span>
            <button
              type="button"
              aria-label={`Download ${a.file_name}`}
              disabled={busy}
              onClick={() => openFile(a.storage_path, a.file_name)}
              className="rounded-sm border border-input p-1.5 hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            {canManage && (
              <button
                type="button"
                aria-label={`Remove ${a.file_name}`}
                onClick={() => remove.mutate(a)}
                className="rounded-sm border border-input p-1.5 text-destructive hover:bg-accent"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-3 text-xs text-muted-foreground">
            No supporting documents. Attach staff reports, exhibits, maps or contracts; they publish
            with the file once it leaves review.
          </li>
        )}
      </ul>
    </section>
  );
}
