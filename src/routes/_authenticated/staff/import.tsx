import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { toTable, toCsv, downloadCsv, type CsvTable } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/staff/import")({
  head: () => ({
    meta: [
      { title: "Data Migration — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Import legacy legislative files, members and historical meetings from CSV exports produced by your prior agenda system.",
      },
      { property: "og:title", content: "Data Migration" },
      {
        property: "og:description",
        content: "Bring legacy ordinances, resolutions and meeting history into CivicLedger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataImport,
});

type Kind = "legislation" | "members" | "meetings";

const TEMPLATES: Record<Kind, { headers: string[]; sample: string[][]; help: string }> = {
  legislation: {
    headers: [
      "assigned_number",
      "title",
      "summary",
      "body_text",
      "item_type_slug",
      "body_slug",
      "status",
      "adopted_at",
      "effective_date",
      "codification_reference",
    ],
    sample: [
      [
        "2019-014",
        "An ordinance amending Chapter 12, Noise",
        "Updates permissible decibel levels in residential districts.",
        "BE IT ORDAINED BY THE CITY COUNCIL…",
        "ordinance",
        "city-council",
        "adopted",
        "2019-05-14",
        "2019-06-01",
        "Code § 12-4",
      ],
    ],
    help: "Historical ordinances and resolutions. Status must be one of draft, in_review, approved, scheduled, adopted, failed, tabled, withdrawn.",
  },
  members: {
    headers: ["full_name", "email", "bio", "active"],
    sample: [["Ana Ruiz", "aruiz@example.gov", "Council Member, Ward 3", "true"]],
    help: "Elected and appointed officials. Seat assignments are made afterwards under Administration → Bodies.",
  },
  meetings: {
    headers: ["body_slug", "title", "starts_at", "location", "meeting_kind", "status"],
    sample: [
      [
        "city-council",
        "Regular Meeting",
        "2019-05-14T18:30:00-05:00",
        "Council Chambers, 100 Main St.",
        "regular",
        "adjourned",
      ],
    ],
    help: "Historical meeting records so the public calendar and archive are continuous. Kind: regular, special, emergency, continued, workshop.",
  },
};

function DataImport() {
  const [kind, setKind] = useState<Kind>("legislation");
  const [table, setTable] = useState<CsvTable | null>(null);
  const [fileName, setFileName] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const lookups = useQuery({
    queryKey: ["import", "lookups"],
    queryFn: async () => {
      const [bodies, types] = await Promise.all([
        supabase.from("bodies").select("id,slug,name"),
        supabase.from("item_types").select("id,slug,name"),
      ]);
      if (bodies.error) throw bodies.error;
      if (types.error) throw types.error;
      return { bodies: bodies.data ?? [], types: types.data ?? [] };
    },
  });

  async function readFile(file: File) {
    const text = await file.text();
    const parsed = toTable(text);
    setTable(parsed);
    setFileName(file.name);
    setLog([]);
    const missing = TEMPLATES[kind].headers.filter(
      (h) => !parsed.headers.includes(h) && h !== "bio" && h !== "summary",
    );
    if (missing.length) {
      toast.error(`Missing columns: ${missing.join(", ")}`);
    } else {
      toast.success(`${parsed.rows.length} rows ready to review`);
    }
  }

  const runImport = useMutation({
    mutationFn: async () => {
      if (!table || table.rows.length === 0) throw new Error("Load a CSV file first");
      const bodyBySlug = new Map((lookups.data?.bodies ?? []).map((b) => [b.slug, b.id]));
      const typeBySlug = new Map((lookups.data?.types ?? []).map((t) => [t.slug, t.id]));
      const messages: string[] = [];
      let ok = 0;

      for (const [index, row] of table.rows.entries()) {
        const line = index + 2;
        try {
          if (kind === "legislation") {
            if (!row.title) throw new Error("title is required");
            const { error } = await supabase.from("legislative_items").insert({
              assigned_number: row.assigned_number || null,
              title: row.title,
              summary: row.summary || null,
              body_text: row.body_text || null,
              item_type_id: typeBySlug.get(row.item_type_slug) ?? null,
              body_id: bodyBySlug.get(row.body_slug) ?? null,
              status: (row.status || "adopted") as never,
              adopted_at: row.adopted_at ? new Date(row.adopted_at).toISOString() : null,
              effective_date: row.effective_date || null,
              codification_reference: row.codification_reference || null,
            });
            if (error) throw error;
          } else if (kind === "members") {
            if (!row.full_name) throw new Error("full_name is required");
            const { error } = await supabase.from("members").insert({
              full_name: row.full_name,
              email: row.email || null,
              bio: row.bio || null,
              active: row.active !== "false",
            });
            if (error) throw error;
          } else {
            if (!row.title || !row.starts_at) throw new Error("title and starts_at are required");
            const bodyId = bodyBySlug.get(row.body_slug);
            if (!bodyId) throw new Error(`unknown body_slug "${row.body_slug}"`);
            const { error } = await supabase.from("meetings").insert({
              body_id: bodyId,
              title: row.title,
              starts_at: new Date(row.starts_at).toISOString(),
              location: row.location || null,
              meeting_kind: (row.meeting_kind || "regular") as never,
              status: (row.status || "adjourned") as never,
            });
            if (error) throw error;
          }
          ok += 1;
        } catch (e) {
          messages.push(`Row ${line}: ${(e as Error).message}`);
        }
      }
      messages.unshift(`${ok} of ${table.rows.length} rows imported.`);
      return messages;
    },
    onSuccess: (messages) => {
      setLog(messages);
      toast.success(messages[0]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tpl = TEMPLATES[kind];

  return (
    <StaffShell>
      <StaffHeader
        title="Data migration"
        description="Import legacy records from your prior agenda system using CSV exports, then verify before go-live."
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-sm border border-rule bg-card p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="eyebrow">Record set</span>
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as Kind);
                  setTable(null);
                  setLog([]);
                }}
                className="mt-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
              >
                <option value="legislation">Legislative files</option>
                <option value="members">Members &amp; officials</option>
                <option value="meetings">Historical meetings</option>
              </select>
            </label>
            <button
              onClick={() => downloadCsv(`civicledger_${kind}_template.csv`, toCsv(tpl.headers, tpl.sample))}
              className="inline-flex items-center gap-1.5 rounded-sm border border-input px-3 py-2 text-sm font-semibold"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download template
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{tpl.help}</p>

          <label className="mt-4 block">
            <span className="eyebrow">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
              className="mt-1.5 block w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          {table ? (
            <>
              <p className="mt-4 text-xs text-muted-foreground">
                {fileName} — {table.rows.length} rows. Showing the first 10 for review.
              </p>
              <div className="mt-2 overflow-x-auto rounded-sm border border-rule">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Preview of rows to import</caption>
                  <thead className="border-b border-rule bg-muted/40">
                    <tr>
                      {table.headers.map((h) => (
                        <th key={h} scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-rule/60 last:border-0">
                        {table.headers.map((h) => (
                          <td key={h} className="max-w-[220px] truncate px-2 py-1.5">
                            {r[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => runImport.mutate()}
                disabled={runImport.isPending}
                className="mt-4 inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {runImport.isPending ? "Importing…" : `Import ${table.rows.length} rows`}
              </button>
            </>
          ) : null}

          {log.length > 0 ? (
            <div className="mt-4 rounded-sm border border-rule bg-muted/30 p-3">
              <h2 className="eyebrow">Import log</h2>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {log.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <aside aria-label="Migration guidance" className="space-y-4">
          <div className="rounded-sm border border-rule bg-card p-4">
            <h2 className="eyebrow">Recommended order</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
              <li>Configure bodies, item types and numbering rules first.</li>
              <li>Import members, then assign them to seats.</li>
              <li>Import historical meetings so the archive is continuous.</li>
              <li>Import adopted legislation last and spot-check twenty files.</li>
            </ol>
          </div>
          <div className="rounded-sm border border-rule bg-card p-4">
            <h2 className="eyebrow">Before you start</h2>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>Imports write directly to the live record — run a database backup first.</li>
              <li>
                Numbering rules are not advanced by an import; set the next sequence manually under
                Administration → Numbering afterwards.
              </li>
              <li>Attachments and scanned PDFs are uploaded per file, not by CSV.</li>
              <li>Every imported row is written to the audit trail.</li>
            </ul>
          </div>
        </aside>
      </div>
    </StaffShell>
  );
}
