export type VoteChoice = "aye" | "nay" | "abstain" | "recuse" | "absent";

export type VoteRule = {
  id: string;
  name: string;
  fraction: number;
  basis: "present" | "full_membership" | "quorum";
  abstain_counts_as: string;
  recusal_reduces_base: boolean;
};

export type TallyInput = {
  votes: { member_id: string; choice: VoteChoice }[];
  seatCount: number;
  presentCount: number;
  rule?: VoteRule | null;
};

export type Tally = {
  aye: number;
  nay: number;
  abstain: number;
  recuse: number;
  absent: number;
  base: number;
  threshold: number;
  passed: boolean;
  ruleName: string;
  explanation: string;
};

/** Quorum for a body given its configured rule. */
export function quorumRequired(quorumType: string, quorumValue: number | null, seats: number) {
  switch (quorumType) {
    case "fixed":
      return Math.max(1, Math.round(quorumValue ?? 1));
    case "two_thirds_of_full":
      return Math.ceil((seats * 2) / 3);
    case "majority_of_full":
    default:
      return Math.floor(seats / 2) + 1;
  }
}

export function computeTally({ votes, seatCount, presentCount, rule }: TallyInput): Tally {
  const count = (c: VoteChoice) => votes.filter((v) => v.choice === c).length;
  const aye = count("aye");
  const nay = count("nay");
  const abstain = count("abstain");
  const recuse = count("recuse");
  const absent = count("absent");

  const fraction = rule?.fraction ?? 0.5;
  const basis = rule?.basis ?? "present";
  const abstainCounts = rule?.abstain_counts_as ?? "not_counted";
  const recusalReduces = rule?.recusal_reduces_base ?? true;

  let base: number;
  if (basis === "full_membership") {
    base = seatCount - (recusalReduces ? recuse : 0);
  } else {
    base = presentCount - recuse;
    if (abstainCounts === "not_counted") base -= abstain;
  }
  base = Math.max(base, 0);

  // "More than" the fraction of the base: e.g. majority of 7 -> 4.
  const threshold = Math.floor(base * fraction) + 1;
  const effectiveAye = abstainCounts === "aye" ? aye + abstain : aye;
  const passed = base > 0 && effectiveAye >= threshold;

  const basisLabel =
    basis === "full_membership"
      ? "full membership"
      : basis === "quorum"
        ? "the quorum present"
        : "members present and voting";

  return {
    aye,
    nay,
    abstain,
    recuse,
    absent,
    base,
    threshold,
    passed,
    ruleName: rule?.name ?? "Simple Majority",
    explanation: `${threshold} of ${base} required (${rule?.name ?? "Simple Majority"} — ${basisLabel}).`,
  };
}
