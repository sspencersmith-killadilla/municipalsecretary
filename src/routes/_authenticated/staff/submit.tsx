import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { useSession } from "@/lib/session";
import { draftAgendaItem } from "@/lib/drafting.functions";
import { EMPTY_INTAKE, INTAKE_QUESTIONS, type DraftResult, type IntakeAnswers } from "@/lib/intake";

export const Route = createFileRoute("/_authenticated/staff/submit")({
  head: () => ({
    meta: [
      { title: "Submit an Item — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Complete the intake questionnaire to submit an item to a board or council agenda, with AI-assisted drafting.",
      },
      { property: "og:title", content: "Submit an agenda item" },
      {
        property: "og:description",
        content: "Board-scoped intake questionnaire with AI-assisted legislative drafting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubmitItem,
});

function SubmitItem() {
  const { userId, canManage } = useSession();
  const navigate = useNavigate();
  const draft = useServerFn(draftAgendaItem);

  const [bodyId, setBodyId] = useState("");
  const [itemTypeId, setItemTypeId] = useState("");
  const [answers, setAnswers] = useState<IntakeAnswers>(EMPTY_INTAKE);
  const [result, setResult] = useState<DraftResult | null>(null);

  const bodiesQuery = useQuery({
    queryKey: ["submit", "bodies", userId, canManage],
    enabled: !!userId,
    queryFn: async () => {
      if (canManage) {
        const { data, error } = await supabase
          .from("bodies")
          .select("id,name")
          .eq("active", true)
          .order("sort_order");
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from("body_permissions")
        .select("bodies(id,name,active,sort_order)")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.bodies as { id: string; name: string; active: boolean } | null)
        .filter((b): b is { id: string; name: string; active: boolean } => !!b && b.active)
        .map((b) => ({ id: b.id, name: b.name }));
    },
  });

  const typesQuery = useQuery({
    queryKey: ["submit", "item-types"],
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

  const generate = useMutation({
    mutationFn: async () => draft({ data: { bodyId, itemTypeId, answers } }),
    onSuccess: (data) => {
      setResult(data as DraftResult);
      toast.success("Draft generated — review and edit before filing.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("Generate or write a draft first.");
      const { data, error } = await supabase
        .from("legislative_items")
        .insert({
          title: result.title.trim(),
          summary: result.summary.trim() || null,
          body_text: result.bodyText.trim() || null,
          fiscal_impact: result.fiscalImpact.trim() || null,
          department: answers.department.trim() || null,
          sponsor: answers.sponsor.trim() || null,
          body_id: bodyId,
          item_type_id: itemTypeId,
          status: "draft",
          created_by: userId,
          custom_values: { intake: answers },
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Legislative file created");
      navigate({ to: "/staff/legislation/$itemId", params: { itemId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bodies = bodiesQuery.data ?? [];
  const missingRequired = INTAKE_QUESTIONS.filter(
    (q) => q.required && !answers[q.key].trim(),
  ).length;
  const canGenerate = !!bodyId && !!itemTypeId && missingRequired === 0;

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Intake"
        title="Submit an item for an agenda"
        description="Answer the intake questionnaire for the board you're filing with. The drafter turns your answers into formal legislative language you can edit before filing."
      />
      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-sm border border-border bg-card">
            <h2 className="border-b border-rule px-5 py-3 font-display text-base font-bold">
              1. Where is this going?
            </h2>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow">Board or council</span>
                <select
                  value={bodyId}
                  onChange={(e) => setBodyId(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                >
                  <option value="">Select a board…</option>
                  {bodies.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="eyebrow">Item type</span>
                <select
                  value={itemTypeId}
                  onChange={(e) => setItemTypeId(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                >
                  <option value="">Select a type…</option>
                  {(typesQuery.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {!bodiesQuery.isLoading && bodies.length === 0 ? (
                <p className="sm:col-span-2 text-sm text-seal">
                  You don't have submission rights to any board yet. Ask an administrator to grant
                  board access under Administration → Board access.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-sm border border-border bg-card">
            <h2 className="border-b border-rule px-5 py-3 font-display text-base font-bold">
              2. Intake questionnaire
            </h2>
            <div className="space-y-4 p-5">
              {INTAKE_QUESTIONS.map((q) => (
                <label key={q.key} className="block">
                  <span className="eyebrow">
                    {q.label}
                    {q.required ? " *" : ""}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{q.help}</span>
                  {q.multiline ? (
                    <textarea
                      rows={3}
                      value={answers[q.key]}
                      onChange={(e) => setAnswers((s) => ({ ...s, [q.key]: e.target.value }))}
                      className="mt-1.5 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                    />
                  ) : (
                    <input
                      value={answers[q.key]}
                      onChange={(e) => setAnswers((s) => ({ ...s, [q.key]: e.target.value }))}
                      className="mt-1.5 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                    />
                  )}
                </label>
              ))}
              <div className="flex items-center gap-3 border-t border-rule pt-4">
                <button
                  onClick={() => generate.mutate()}
                  disabled={!canGenerate || generate.isPending}
                  className="inline-flex items-center gap-2 rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {generate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generate.isPending ? "Drafting…" : "Draft with AI"}
                </button>
                {!canGenerate ? (
                  <span className="text-xs text-muted-foreground">
                    Select a board and item type, then complete the required fields.
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-sm border border-border bg-card xl:sticky xl:top-6 xl:self-start">
          <h2 className="border-b border-rule px-5 py-3 font-display text-base font-bold">
            3. Review the draft
          </h2>
          {result ? (
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="eyebrow">Caption / title</span>
                <textarea
                  rows={2}
                  value={result.title}
                  onChange={(e) => setResult({ ...result, title: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Staff summary</span>
                <textarea
                  rows={4}
                  value={result.summary}
                  onChange={(e) => setResult({ ...result, summary: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Legislative text</span>
                <textarea
                  rows={18}
                  value={result.bodyText}
                  onChange={(e) => setResult({ ...result, bodyText: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 font-mono text-xs leading-relaxed"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Fiscal impact</span>
                <textarea
                  rows={3}
                  value={result.fiscalImpact}
                  onChange={(e) => setResult({ ...result, fiscalImpact: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
                <button
                  onClick={() => create.mutate()}
                  disabled={create.isPending}
                  className="rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {create.isPending ? "Filing…" : "File as legislative draft"}
                </button>
                <button
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                  className="rounded-sm border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Redraft
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                AI-assisted drafting. Staff and the city attorney remain responsible for the final
                text; bracketed placeholders must be resolved before introduction.
              </p>
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground">
              The generated caption, staff summary, legislative text and fiscal impact will appear
              here for editing before the file is created.
            </div>
          )}
        </section>
      </div>
    </StaffShell>
  );
}
