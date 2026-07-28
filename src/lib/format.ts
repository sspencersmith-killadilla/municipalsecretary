export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export const ITEM_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  scheduled: "Scheduled",
  adopted: "Adopted",
  failed: "Failed",
  tabled: "Tabled",
  withdrawn: "Withdrawn",
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  in_progress: "In Progress",
  adjourned: "Adjourned",
  cancelled: "Cancelled",
};

export function statusTone(status: string) {
  switch (status) {
    case "adopted":
    case "approved":
    case "adjourned":
      return "bg-success/12 text-success border-success/30";
    case "failed":
    case "withdrawn":
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "in_review":
    case "tabled":
      return "bg-warning/15 text-warning-foreground border-warning/40";
    case "scheduled":
    case "published":
    case "in_progress":
      return "bg-seal/10 text-seal border-seal/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
