import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const answerSchema = z.object({
  workingTitle: z.string().trim().min(1).max(300),
  requestedAction: z.string().trim().max(4000),
  problem: z.string().trim().max(4000),
  background: z.string().trim().max(6000),
  fiscalImpact: z.string().trim().max(3000),
  fundingSource: z.string().trim().max(500),
  legalAuthority: z.string().trim().max(2000),
  outreach: z.string().trim().max(2000),
  timing: z.string().trim().max(500),
  department: z.string().trim().max(200),
  sponsor: z.string().trim().max(200),
});

const inputSchema = z.object({
  bodyId: z.string().uuid(),
  itemTypeId: z.string().uuid(),
  answers: answerSchema,
});

/**
 * Drafts formal legislative language from the staff intake questionnaire.
 * The caller must hold submission permission for the selected body.
 */
export const draftAgendaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed, error: permError } = await supabase.rpc("can_submit_to_body", {
      _user_id: userId,
      _body_id: data.bodyId,
    });
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("You do not have permission to submit items to this board.");

    const [{ data: body }, { data: itemType }, { data: settings }] = await Promise.all([
      supabase.from("bodies").select("name").eq("id", data.bodyId).maybeSingle(),
      supabase
        .from("item_types")
        .select("name,readings_required,requires_public_hearing")
        .eq("id", data.itemTypeId)
        .maybeSingle(),
      supabase.from("settings").select("municipality_name").eq("id", 1).maybeSingle(),
    ]);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI drafting is not configured.");

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText, Output, NoObjectGeneratedError } = await import("ai");

    const gateway = createLovableAiGatewayProvider(apiKey, { structuredOutputs: true });
    const model = gateway("openai/gpt-5.6-sol");

    const a = data.answers;
    const typeName = itemType?.name ?? "Legislative item";
    const prompt = [
      `Municipality: ${settings?.municipality_name ?? "the municipality"}`,
      `Legislative body: ${body?.name ?? "the legislative body"}`,
      `Item type: ${typeName}`,
      itemType?.readings_required ? `Readings required: ${itemType.readings_required}` : "",
      itemType?.requires_public_hearing ? "A public hearing is required." : "",
      "",
      "Staff intake questionnaire:",
      `Working title: ${a.workingTitle}`,
      `Requested action: ${a.requestedAction}`,
      `Problem or need: ${a.problem}`,
      `Background and prior action: ${a.background}`,
      `Fiscal impact: ${a.fiscalImpact}`,
      `Funding source: ${a.fundingSource}`,
      `Legal authority / code sections: ${a.legalAuthority}`,
      `Public outreach and stakeholders: ${a.outreach}`,
      `Timing or deadline: ${a.timing}`,
      `Submitting department: ${a.department}`,
      `Sponsor: ${a.sponsor}`,
      "",
      "Draft the item. Requirements:",
      "- title: a formal caption in the conventional municipal style for this item type, one sentence, no trailing period, under 200 characters.",
      "- summary: 2-4 sentences of neutral staff-report prose stating what the item does and why.",
      `- bodyText: the operative legislative text for a ${typeName}. Use the conventional structure: WHEREAS recitals drawn only from the facts given, then the enacting clause (BE IT ORDAINED / BE IT RESOLVED as appropriate for this item type), then numbered operative sections, then an effective-date section. Plain text with blank lines between sections; no markdown.`,
      "- fiscalImpact: one short paragraph; write 'None.' if there is no fiscal impact.",
      "",
      "Never invent dollar amounts, code sections, dates, vote counts, or facts that were not supplied. Where a required detail is missing, insert a clearly bracketed placeholder such as [INSERT SECTION NUMBER].",
    ]
      .filter(Boolean)
      .join("\n");

    const schema = z.object({
      title: z.string(),
      summary: z.string(),
      bodyText: z.string(),
      fiscalImpact: z.string(),
    });

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema }),
        system:
          "You are an experienced municipal clerk and legislative drafter. You produce accurate, conservative, plain-language legislative drafts that follow standard municipal drafting conventions and never fabricate facts.",
        prompt,
        providerOptions: { lovable: { reasoningEffort: "none" } },
      });
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The drafter returned an unusable response. Please try again.");
      }
      const message = error instanceof Error ? error.message : "AI drafting failed";
      if (message.includes("429")) throw new Error("AI drafting is rate limited. Try again shortly.");
      if (message.includes("402"))
        throw new Error("AI credits are exhausted. Add credits to continue drafting.");
      throw new Error(message);
    }
  });
