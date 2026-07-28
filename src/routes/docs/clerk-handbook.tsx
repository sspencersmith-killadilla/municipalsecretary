import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";

export const Route = createFileRoute("/docs/clerk-handbook")({
  head: () => ({
    meta: [
      { title: "Clerk Handbook — CivicLedger Training Guide" },
      {
        name: "description",
        content:
          "Step-by-step operating handbook for clerks, department staff and board members: drafting, agendas, notices, meetings, minutes and records requests.",
      },
      { property: "og:title", content: "CivicLedger Clerk Handbook" },
      {
        property: "og:description",
        content: "Training and go-live handbook for municipal clerk offices using CivicLedger.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClerkHandbook,
});

type Section = { id: string; title: string; blocks: (string | string[])[] };

const SECTIONS: Section[] = [
  {
    id: "roles",
    title: "1. Roles and who does what",
    blocks: [
      "Access is granted by role, and roles are stored separately from user profiles so they cannot be self-assigned.",
      [
        "Administrator — configures bodies, seats, item types, numbering, vote rules and board access.",
        "City Clerk — publishes notices and agendas, runs the meeting console, certifies minutes, manages records requests.",
        "City Attorney — reviews and approves items routed through workflow before agendizing.",
        "Department Staff — submits items to the boards they have been granted access to.",
        "Board Member — views packets; votes are recorded by the clerk at the console.",
        "Viewer — read-only staff access to the workspace.",
      ],
      "Grant board submission rights under Administration → Board access. A staff member may hold rights to any number of boards.",
    ],
  },
  {
    id: "setup",
    title: "2. First-week configuration",
    blocks: [
      [
        "Administration → Settings: municipality name, contact address, statutory notice days, posting deadline hours, records response days.",
        "Administration → Bodies: create each council, board and commission with seat count and quorum rule.",
        "Administration → Members: add officials, then assign them to seats with term dates.",
        "Administration → Item types: ordinances, resolutions, proclamations — set readings required and the default vote rule.",
        "Administration → Vote rules: simple majority, two-thirds, majority of full membership; set how abstentions and recusals count.",
        "Administration → Numbering: patterns such as {YYYY}-{seq:000}, resetting annually or never.",
      ],
      "Verify the numbering preview before the first live meeting. Numbers are assigned server-side and are never reused.",
    ],
  },
  {
    id: "intake",
    title: "3. Submitting an item",
    blocks: [
      "Staff open Submit an Item, choose a board they are authorized for, and complete the intake questionnaire — the purpose, the problem being solved, fiscal impact, legal authority, and any deadline.",
      "The drafting assistant turns those answers into a caption, summary, legislative text and fiscal note. Everything is editable before filing; nothing is filed automatically.",
      "Always have the attorney confirm the enacting clause, code citations and severability language before the item is agendized.",
    ],
  },
  {
    id: "agenda",
    title: "4. Building and publishing the agenda",
    blocks: [
      [
        "Open Meetings & Agendas and create the meeting with its body, date, time and location.",
        "Add approved items into the correct section, drag ordering with the Up/Down controls; numbering renumbers automatically.",
        "Mark consent-calendar items and time-certain hearings.",
        "Post the notice from the Notice panel — record where it was posted physically as well as electronically.",
        "Publish the agenda. The packet PDF, calendar feed and public meeting page update immediately.",
      ],
      "The compliance banner shows whether the notice satisfies the configured statutory window. If it does not, the system records the shortfall rather than hiding it; amend the notice or reschedule.",
    ],
  },
  {
    id: "meeting",
    title: "5. Running the meeting",
    blocks: [
      [
        "Open the Meeting Console and take the roll. Quorum is computed live against the body's rule.",
        "Take up an item to set the floor; the public page and speaker queue follow along.",
        "Call speakers from the queue with per-speaker timers.",
        "Record the motion, the mover and the seconder, then take the roll-call vote.",
        "The tally applies the item's vote rule, including abstention and recusal handling, and updates the file's status.",
      ],
      "Executive session: use the Closed Session panel, record the statutory citation, and publish the public action summary taken after the body returns to open session.",
    ],
  },
  {
    id: "minutes",
    title: "6. Minutes and certification",
    blocks: [
      "Generate the draft minutes from the recorded proceedings, edit for accuracy, and save as often as needed.",
      "Finalizing certifies the minutes: the system stamps who certified them, when, and a SHA-256 integrity seal over the text. The seal is published with the minutes so anyone can detect later alteration.",
      "Certified minutes are locked in the console. Corrections are made by the body adopting amended minutes at a subsequent meeting.",
    ],
  },
  {
    id: "records",
    title: "7. Public comment and records requests",
    blocks: [
      "Comment cards and requests to speak arrive under Public Comment. Approving a card publishes it to the meeting page; rejecting one keeps the submission in the record without publishing it.",
      "Records requests arrive under Records & FOIA with a tracking code and a statutory due date computed from business days. Log every status change, redaction rationale and fee estimate as you go — the trail is what defends the response.",
      "Retention schedules and legal holds live on the same page. Never dispose of a record class while a hold is active.",
    ],
  },
  {
    id: "golive",
    title: "8. Go-live checklist",
    blocks: [
      [
        "Bodies, seats, item types, vote rules and numbering configured and reviewed by the attorney.",
        "Legacy members, meetings and adopted legislation imported and spot-checked.",
        "Two-factor authentication enrolled for every administrator, clerk and attorney account.",
        "Notice templates and posting locations match the statute your jurisdiction operates under.",
        "One full rehearsal meeting run end to end in the console, including a vote and certified minutes.",
        "Accessibility statement and records-request page reviewed with your ADA coordinator.",
        "Backup and restore verified against the self-hosting guide.",
      ],
    ],
  },
];

function ClerkHandbook() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow">Training</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Clerk handbook</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The operating guide for the clerk&rsquo;s office: how items are drafted, agendized,
          noticed, heard, voted, certified and disclosed. Pair it with the{" "}
          <Link to="/docs/self-hosting" className="text-seal underline">
            self-hosting guide
          </Link>{" "}
          for infrastructure and backups.
        </p>

        <nav aria-label="Handbook contents" className="mt-8 rounded-sm border border-rule bg-card p-4">
          <h2 className="eyebrow">Contents</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-seal underline">
                  {s.title.replace(/^\d+\.\s*/, "")}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="mt-10 scroll-mt-8">
            <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">{s.title}</h2>
            {s.blocks.map((b, i) =>
              Array.isArray(b) ? (
                <ul key={i} className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                  {b.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={i} className="mt-4 text-sm leading-relaxed text-foreground">
                  {b}
                </p>
              ),
            )}
          </section>
        ))}

        <p className="mt-10 text-xs text-muted-foreground">
          This handbook describes how the software operates. It is not legal advice — confirm notice
          periods, quorum, executive-session citations and records deadlines against the statutes
          and charter that govern your jurisdiction.
        </p>
      </div>
    </PublicLayout>
  );
}
