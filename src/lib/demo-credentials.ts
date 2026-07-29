/** Demo credentials shown on the sign-in page of the public demo site. */
export const DEMO_ADMIN_EMAIL = "admin@civicledger.demo";
export const DEMO_ADMIN_PASSWORD = "CivicLedger#2026";
export const DEMO_ADMIN_NAME = "Demo City Clerk";

/** Shared password for every demo account. */
export const DEMO_PASSWORD = DEMO_ADMIN_PASSWORD;

export type DemoRole = "admin" | "clerk" | "attorney" | "department_staff" | "board_member";

export type DemoAccount = {
  email: string;
  name: string;
  title: string;
  department?: string;
  role: DemoRole;
  /** Group heading on the sign-in page. */
  group: "Administration" | "Staff" | "Board members";
  /** What this login is good for. */
  blurb: string;
  /** Existing member record to link this login to (matched by full name). */
  memberName?: string;
  /** Body slugs this account may submit agenda items to. */
  submitBodies?: string[];
  landing: "/staff/admin" | "/dashboard" | "/staff/submit" | "/staff/briefings";
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: DEMO_ADMIN_EMAIL,
    name: DEMO_ADMIN_NAME,
    title: "City Clerk",
    department: "City Clerk",
    role: "admin",
    group: "Administration",
    blurb:
      "Full administration portal: bodies, seats, item types, numbering, vote rules, members and settings.",
    landing: "/staff/admin",
  },
  {
    email: "clerk@civicledger.demo",
    name: "Renee Alcott",
    title: "Deputy Clerk",
    department: "City Clerk",
    role: "clerk",
    group: "Staff",
    blurb:
      "Builds agendas, posts notices, runs the meeting console, moderates comments and finalizes minutes.",
    submitBodies: ["city-council", "planning-commission"],
    landing: "/dashboard",
  },
  {
    email: "attorney@civicledger.demo",
    name: "Victor Nunes",
    title: "City Attorney",
    department: "Legal",
    role: "attorney",
    group: "Staff",
    blurb: "Reviews and approves legislative files in the workflow queue before agendizing.",
    submitBodies: ["city-council"],
    landing: "/dashboard",
  },
  {
    email: "publicworks@civicledger.demo",
    name: "Grace Lindholm",
    title: "Public Works Director",
    department: "Public Works",
    role: "department_staff",
    group: "Staff",
    blurb: "Submits Council items through the intake questionnaire with AI-assisted drafting.",
    submitBodies: ["city-council"],
    landing: "/staff/submit",
  },
  {
    email: "planning@civicledger.demo",
    name: "Omar Vasilev",
    title: "Planning Director",
    department: "Planning & Development",
    role: "department_staff",
    group: "Staff",
    blurb: "Submits items to both the Planning Commission and the City Council.",
    submitBodies: ["planning-commission", "city-council"],
    landing: "/staff/submit",
  },
  {
    email: "mayor@civicledger.demo",
    name: "Marcia Delgado",
    title: "Mayor",
    role: "board_member",
    group: "Board members",
    blurb: "Council briefing dashboard: plain-language agenda, fiscal impact and packets.",
    memberName: "Marcia Delgado",
    landing: "/staff/briefings",
  },
  {
    email: "councilmember@civicledger.demo",
    name: "Tom Okafor",
    title: "Mayor Pro Tem",
    role: "board_member",
    group: "Board members",
    blurb: "Council seat 2 — read the briefing packet ahead of the next regular meeting.",
    memberName: "Tom Okafor",
    landing: "/staff/briefings",
  },
  {
    email: "planningchair@civicledger.demo",
    name: "Helen Vasquez",
    title: "Planning Commission Chair",
    role: "board_member",
    group: "Board members",
    blurb: "Chairs the Planning Commission and also holds Council seat 3.",
    memberName: "Helen Vasquez",
    landing: "/staff/briefings",
  },
];
