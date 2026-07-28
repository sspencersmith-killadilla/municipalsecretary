import { z } from "zod";

/** Categories used by the council briefing dashboard. */
export const BRIEFING_CATEGORIES = [
  "ordinance",
  "resolution",
  "grant",
  "public_hearing",
  "contract",
  "appointment",
  "other",
] as const;

export type BriefingCategory = (typeof BRIEFING_CATEGORIES)[number];

export type BriefingSource = {
  agendaItemId: string;
  displayNumber: string | null;
  section: string;
  title: string;
  itemTypeName: string | null;
  summary: string | null;
  bodyText: string | null;
  fiscalImpact: string | null;
  department: string | null;
  sponsor: string | null;
};

export type BriefingDraft = {
  agendaItemId: string;
  plainSummary: string;
  whyItMatters: string;
  department: string;
  category: BriefingCategory;
  costDisclosed: boolean;
  costAmount: number | null;
  isGrant: boolean;
  grantAwardAmount: number | null;
  localMatchAmount: number | null;
  considerations: string[];
};

const draftSchema = z.object({
  briefings: z.array(
    z.object({
      agendaItemId: z.string(),
      plainSummary: z.string(),
      whyItMatters: z.string(),
      department: z.string(),
      category: z.enum(BRIEFING_CATEGORIES),
      costDisclosed: z.boolean(),
      costAmount: z.number().nullable(),
      isGrant: z.boolean(),
      grantAwardAmount: z.number().nullable(),
      localMatchAmount: z.number().nullable(),
      considerations: z.array(z.string()),
    }),
  ),
});

/**
 * Turns raw agenda/legislative text into plain-language council briefings.
 * Server-only: reads the Lovable AI Gateway key from the environment.
 */
export async function draftBriefings(
  apiKey: string,
  meetingLabel: string,
  sources: BriefingSource[],
): Promise<BriefingDraft[]> {
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const { generateText, Output, NoObjectGeneratedError } = await import("ai");

  const gateway = createLovableAiGatewayProvider(apiKey, { structuredOutputs: true });
  const model = gateway("openai/gpt-5.6-sol");

  const payload = sources.map((s) => ({
    agendaItemId: s.agendaItemId,
    displayNumber: s.displayNumber,
    section: s.section,
    title: s.title,
    itemType: s.itemTypeName,
    department: s.department,
    sponsor: s.sponsor,
    summary: s.summary,
    fiscalImpact: s.fiscalImpact,
    legislativeText: s.bodyText ? s.bodyText.slice(0, 6000) : null,
  }));

  const prompt = [
    `Meeting: ${meetingLabel}`,
    "",
    "Agenda items (JSON):",
    JSON.stringify(payload, null, 1),
    "",
    "For EVERY item, return one briefing object with the same agendaItemId. Rules:",
    "- plainSummary: 1-2 sentences at an 8th-grade reading level explaining what this item actually does. No legalese, no 'Consider/Discuss/Act on'.",
    "- whyItMatters: one short sentence on the practical effect on residents or city operations.",
    "- department: the responsible city department. Infer it from the text when it is not stated; use 'Unassigned' only if there is truly no signal.",
    "- category: ordinance, resolution, grant, public_hearing, contract, appointment, or other.",
    "- costDisclosed: true ONLY when a specific dollar figure appears in the source text. costAmount: that figure as a plain number (no currency symbols), otherwise null.",
    "- isGrant: true for grant applications, awards or acceptances. grantAwardAmount: money coming in to the city. localMatchAmount: money the city must contribute (0 if the item states there is no match, null if unknown).",
    "- considerations: 0-3 very short bullet phrases a council member should ask about (deadlines, ongoing obligations, precedent, missing cost).",
    "",
    "Never invent dollar amounts, dates, or facts. If a cost is not stated, costDisclosed must be false and costAmount null.",
  ].join("\n");

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: draftSchema }),
      system:
        "You are a nonpartisan municipal policy analyst preparing a pre-meeting briefing for city council members and the city administrator. You are accurate, concise, neutral, and never fabricate figures.",
      prompt,
      providerOptions: { lovable: { reasoningEffort: "none" } },
    });

    const known = new Set(sources.map((s) => s.agendaItemId));
    return output.briefings.filter((b) => known.has(b.agendaItemId));
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("The briefing generator returned an unusable response. Please try again.");
    }
    const message = error instanceof Error ? error.message : "Briefing generation failed";
    if (message.includes("429")) throw new Error("AI is rate limited. Try again shortly.");
    if (message.includes("402"))
      throw new Error("AI credits are exhausted. Add credits to continue.");
    throw new Error(message);
  }
}
