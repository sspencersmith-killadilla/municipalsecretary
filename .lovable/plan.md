## Goal

Close the three gaps that decide whether a small/mid-size city can actually run CivicLedger day to day: nobody gets notified, a new city can't set itself up, and there's no way to report out or plug into the existing city website.

Verified current state: subscriber records are stored but never emailed (no email domain configured, no send code anywhere), roles are only granted by the signup trigger — the admin portal has Bodies / Board access / Item types / Vote rules / Numbering / Members / Settings but no user & role management, and there are no reporting or embed routes.

---

## 1. Notifications & email (the daily clerk need)

Prerequisite: connect a sender domain (e.g. a subdomain of civicplexus.org). One-time setup dialog; nothing else in this phase works until it's done.

Branded templates matching the parchment/ink design:
- **Subscriber confirmation** (double opt-in — the `confirmed` flag exists and is never set today)
- **Agenda posted** — sent on meeting publish, with packet link and meeting details
- **Agenda amended / meeting cancelled** — tied to the notice record
- **Minutes published**
- **Approval requested / item returned** — to the assigned staff approver
- **Records request received / due-date reminder / closed** — to the requester's tracking code
- **Public comment received** — digest to the clerk

Mechanics:
- Fan-out from the existing publish/finalize actions through a server-side notifier that resolves the recipient list from `subscriptions` (per body, per notification type).
- A one-click unsubscribe/manage page keyed off the existing `subscriptions.token`.
- A staff **Notifications log** page so the clerk can prove a notice went out — an important open-meetings evidence trail.

## 2. Onboarding & user management

**Setup wizard** at `/staff/setup`, run once by the first admin:
1. Municipality name, tagline, seal/logo, contact email, timezone
2. Notice days, posting deadline hours, records response days, public-comment defaults
3. Create bodies and seats (council + common boards as presets)
4. Choose item types, numbering patterns, vote rules from templates
5. Import members/roster (reuse the existing CSV import), invite staff
6. Readiness checklist with a "you're live" state

**User & role management** in the admin portal:
- Invite staff by email (creates the account, assigns role and board permissions in one step)
- Role editor for admin / clerk / attorney / department staff / board member / viewer
- Link a member record to a user account so board members see their own briefings
- Deactivate a departing employee without deleting their audit trail

## 3. Reporting & website embed

**Clerk reports** at `/staff/reports`, each viewable and exportable to CSV/PDF:
- Attendance by member and by meeting (state reporting + per-diem)
- Voting record by member and by item type
- Item turnaround: intake → adoption, and items stalled in review
- Records-request performance: on-time rate, average days, overdue queue
- Meeting-cost / agenda-volume trend for budget season

**Embeddable widgets** so the city's existing website can show live data:
- `/embed/upcoming` — next meetings for one body
- `/embed/agenda/:meetingId` — current agenda with packet link
- Lightweight, theme-parameterized HTML with a copy-paste `<iframe>` snippet generator in the admin portal, plus permissive CORS on those routes only.

---

## Technical notes

- Deployment stays one instance per city — no tenant column, no cross-city routing. The setup wizard is what makes a fresh instance usable.
- New tables: `notification_log` (recipient, type, entity, sent_at, status) and `staff_invites`. `subscriptions` gains per-type granularity if needed; grants + RLS written in the same migration, staff-read/service-write only.
- Emails send from server functions triggered by existing publish/finalize actions — no queue, no cron table.
- Embed routes are public read-only, served through a publishable-key client against the existing public RLS policies; cancelled meetings stay excluded.
- Reports read through role-checked server functions so member PII stays behind the existing column grants.
- Self-hosting guide and clerk handbook get sections for email domain setup, the wizard, and embedding.

## Suggested order

Email + notifications first (highest daily value), then setup wizard + user management (makes a fresh install deployable), then reports + embeds.
