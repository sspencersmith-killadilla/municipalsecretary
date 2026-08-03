export type NoticeKind =
  | "subscription_confirm"
  | "agenda_posted"
  | "agenda_amended"
  | "meeting_cancelled"
  | "minutes_published"
  | "approval_requested"
  | "records_request_received"
  | "records_request_closed"
  | "comment_received";

export const NOTICE_LABELS: Record<NoticeKind, string> = {
  subscription_confirm: "Confirm your subscription",
  agenda_posted: "Agenda posted",
  agenda_amended: "Agenda amended",
  meeting_cancelled: "Meeting cancelled",
  minutes_published: "Minutes published",
  approval_requested: "Approval requested",
  records_request_received: "Records request received",
  records_request_closed: "Records request closed",
  comment_received: "Public comment received",
};
