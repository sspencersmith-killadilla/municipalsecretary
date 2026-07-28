/** Questionnaire that staff complete when submitting an item for an agenda. */
export type IntakeAnswers = {
  workingTitle: string;
  requestedAction: string;
  problem: string;
  background: string;
  fiscalImpact: string;
  fundingSource: string;
  legalAuthority: string;
  outreach: string;
  timing: string;
  department: string;
  sponsor: string;
};

export const EMPTY_INTAKE: IntakeAnswers = {
  workingTitle: "",
  requestedAction: "",
  problem: "",
  background: "",
  fiscalImpact: "",
  fundingSource: "",
  legalAuthority: "",
  outreach: "",
  timing: "",
  department: "",
  sponsor: "",
};

export const INTAKE_QUESTIONS: {
  key: keyof IntakeAnswers;
  label: string;
  help: string;
  multiline?: boolean;
  required?: boolean;
}[] = [
  {
    key: "workingTitle",
    label: "Working title",
    help: "A plain-language name for this item. The drafter will formalize it.",
    required: true,
  },
  {
    key: "requestedAction",
    label: "Requested action",
    help: "What exactly is the body being asked to do? (adopt, authorize, appropriate, approve…)",
    multiline: true,
    required: true,
  },
  {
    key: "problem",
    label: "Problem or need",
    help: "Why is this coming forward now? What problem does it solve?",
    multiline: true,
    required: true,
  },
  {
    key: "background",
    label: "Background and prior action",
    help: "History, prior votes, studies, related files, contract or bid details.",
    multiline: true,
  },
  {
    key: "fiscalImpact",
    label: "Fiscal impact",
    help: "Dollar amounts, recurring vs one-time, revenue or cost. Write 'None' if none.",
    multiline: true,
  },
  {
    key: "fundingSource",
    label: "Funding source",
    help: "Fund, account, grant, or budget line supporting the expenditure.",
  },
  {
    key: "legalAuthority",
    label: "Legal authority / code sections",
    help: "Charter or code sections amended, created, or relied upon.",
    multiline: true,
  },
  {
    key: "outreach",
    label: "Public outreach and stakeholders",
    help: "Notices published, hearings held, boards consulted, affected parties.",
    multiline: true,
  },
  {
    key: "timing",
    label: "Timing or deadline",
    help: "Grant deadline, contract expiration, statutory clock, or requested meeting date.",
  },
  { key: "department", label: "Submitting department", help: "Department responsible for the item." },
  {
    key: "sponsor",
    label: "Sponsor",
    help: "Elected official, staff member, or department sponsoring the item.",
  },
];

export type DraftResult = {
  title: string;
  summary: string;
  bodyText: string;
  fiscalImpact: string;
};
