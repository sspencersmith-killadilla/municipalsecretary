import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  meetingId: z.string().uuid(),
  onlyMissing: z.boolean().default(true),
});

/**
 * Generates plain-language council briefings for every item on a meeting agenda.
 * Restricted to clerks and administrators.
 */
export const generateMeetingBriefings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed, error: permError } = await supabase.rpc("can_manage", {
      _user_id: userId,
    });
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("Only clerks and administrators can generate briefings.");

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id,title,starts_at,bodies(name)")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (meetingError) throw new Error(meetingError.message);
    if (!meeting) throw new Error("Meeting not found.");

    const { data: agenda, error: agendaError } = await supabase
      .from("agenda_items")
      .select(
        "id,title,display_number,section_name,section_order,position,legislative_items(summary,body_text,fiscal_impact,department,sponsor,plain_summary,item_types(name))",
      )
      .eq("meeting_id", data.meetingId)
      .order("section_order")
      .order("position");
    if (agendaError) throw new Error(agendaError.message);

    const { data: existing } = await supabase
      .from("agenda_item_briefings")
      .select("agenda_item_id")
      .eq("meeting_id", data.meetingId);
    const done = new Set((existing ?? []).map((r) => r.agenda_item_id));

    const rows = (agenda ?? []).filter((r) => !(data.onlyMissing && done.has(r.id)));
    if (rows.length === 0) return { generated: 0 };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI briefings are not configured.");

    const { draftBriefings } = await import("@/lib/briefings.server");

    const sources = rows.map((r) => {
      const li = r.legislative_items as {
        summary?: string | null;
        body_text?: string | null;
        fiscal_impact?: string | null;
        department?: string | null;
        sponsor?: string | null;
        plain_summary?: string | null;
        item_types?: { name?: string | null } | null;
      } | null;
      return {
        agendaItemId: r.id,
        displayNumber: r.display_number,
        section: r.section_name,
        title: r.title,
        itemTypeName: li?.item_types?.name ?? null,
        summary: li?.plain_summary ?? li?.summary ?? null,
        bodyText: li?.body_text ?? null,
        fiscalImpact: li?.fiscal_impact ?? null,
        department: li?.department ?? null,
        sponsor: li?.sponsor ?? null,
      };
    });

    const label = `${(meeting.bodies as { name?: string } | null)?.name ?? ""} — ${meeting.title} (${meeting.starts_at})`;

    const chunks: (typeof sources)[] = [];
    for (let i = 0; i < sources.length; i += 8) chunks.push(sources.slice(i, i + 8));

    const drafts = (await Promise.all(chunks.map((c) => draftBriefings(apiKey, label, c)))).flat();

    const payload = drafts.map((b) => ({
      agenda_item_id: b.agendaItemId,
      meeting_id: data.meetingId,
      plain_summary: b.plainSummary,
      why_it_matters: b.whyItMatters,
      department: b.department || "Unassigned",
      category: b.category,
      cost_disclosed: b.costDisclosed,
      cost_amount: b.costDisclosed ? b.costAmount : null,
      is_grant: b.isGrant,
      grant_award_amount: b.grantAwardAmount,
      local_match_amount: b.localMatchAmount,
      considerations: b.considerations ?? [],
      generated_at: new Date().toISOString(),
    }));

    if (payload.length > 0) {
      const { error } = await supabase
        .from("agenda_item_briefings")
        .upsert(payload, { onConflict: "agenda_item_id" });
      if (error) throw new Error(error.message);
    }

    return { generated: payload.length };
  });
