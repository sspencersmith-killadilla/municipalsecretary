# Making CivicLedger city-deployable: full compliance build-out

The core system (bodies, items, agendas, live console, voting, minutes, PDFs, AI intake, board permissions) exists. What follows is the remaining work, mostly statutory compliance, records law, accessibility, and operations. I'll build it phase by phase in this order.

Requirements vary by state (open-meetings act, retention schedule, publication rules), so everything is built as configurable settings rather than one state's rules hardcoded.

---

## Phase A — Open Meetings Act compliance

1. **Public notice engine** — a notice record per meeting: notice text, posting timestamp, posting locations, who posted, and the statutory deadline computed from existing `settings.notice_days` / `posting_deadline_hours`. Warn when publishing inside the deadline; every agenda change creates an "amended agenda" with its own posting timestamp and version.
2. **Proof-of-posting audit** — append-only posting records plus a downloadable posting-certificate PDF.
3. **Meeting kinds** — regular / special / emergency / continued, each with its own notice rule, plus cancellation and continuation notices on the public portal.
4. **Executive (closed) sessions** — closed agenda items requiring a statutory citation, sealed minutes restricted by role, and a public "action taken after closed session" record.

## Phase B — Public participation

5. **Public comment intake** — comment cards (speak or written-only), per-item or general, with open/close windows, staff moderation, and attachment to the meeting record.
6. **Speaker queue + timer** in the live console, feeding into minutes.
7. **Subscriptions** — email / RSS / ICS by body; automatic notices on agenda posting, meeting changes, and item status changes.

## Phase C — Records law and retention

8. **Document storage** — no storage bucket exists yet, so `item_attachments` can't actually receive files. Create a documents bucket with role-scoped RLS, size/type limits, and public vs. staff-only visibility per attachment.
9. **Retention schedule** — configurable retention class per record type, legal-hold flag that blocks disposal, and a disposition log.
10. **Public records (FOIA) requests** — intake form, due-date clock, redaction notes, response log, exportable packet.
11. **Full-text search + bulk export** across items, minutes, and attachments, plus a complete machine-readable archive export (no vendor lock-in).

## Phase D — Accessibility and publication quality

12. **WCAG 2.1 AA pass** on the public portal and staff console: contrast tokens, focus order, keyboard operation of tables and console, ARIA live regions, skip links, single `<main>`, plus a published Accessibility Statement with remediation contact.
13. **Accessible documents** — current jsPDF output is untagged; add document title/lang metadata and heading structure, and publish an HTML alternative of every packet and minutes document so posted records meet Section 508.
14. **Publication formatting** — ordinance number, adoption date, effective date, publication date, and codification reference on every adopted item, with plain-language public summaries.

## Phase E — Integrity, security, operations

15. **MFA for staff**, session timeout, and a role-change audit trail.
16. **Audit log viewer** with filters and export — the log is written today but never readable.
17. **Certification and signatures** — clerk attestation and mayor signature/veto/effective-date tracking on minutes and ordinances, plus an integrity hash printed on published PDFs.
18. **Operations documentation** — backup/restore, uptime, and incident runbook added to the self-hosting guide; privacy and cookie/analytics disclosure pages.
19. **Meeting media** — audio/video link per meeting with timestamped agenda-item indexing and a captions requirement note (integration point, not video hosting).

## Phase F — Adoption readiness

20. **Migration importers** for Legistar/Granicus CSV/XML exports of historic items, meetings, and minutes.
21. **Codification/vendor export** (Municode / American Legal) and an open-data JSON API for the portal.
22. **Operational material** — clerk runbook, department-submitter guide, and a realistic seeded agenda template set.

---

## Technical notes

- New tables: `meeting_notices`, `public_comments`, `records_requests`, `retention_policies`, `legal_holds`, `subscriptions`, `meeting_media`, `posting_certificates`; extend `meetings` with `meeting_kind`, `agenda_items` with closed-session fields, `minutes` with certification fields, `legislative_items` with effective/publication dates.
- Every new public-schema table gets explicit GRANTs and RLS; only published-record tables get a narrow `anon` SELECT.
- Notifications and FOIA clocks run through server functions plus a scheduled `/api/public/*` route driven by pg_cron, not client timers.
- Accessible PDFs likely need an HTML-first generation path alongside jsPDF; this is the largest single technical change in the list.
- Work lands phase by phase, with each phase verified in the browser before moving on.
