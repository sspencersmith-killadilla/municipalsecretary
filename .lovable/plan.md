## CivicLedger — municipal legislative management platform

An end-to-end alternative to Legistar/Granicus: legislative file drafting, routing/approvals, agenda assembly, packet generation, live meeting console with electronic voting, minutes, and a public transparency portal. Everything municipality-specific (bodies, item types, numbering, workflows, voting/quorum rules) is defined in an admin portal rather than hardcoded.

### Backend

Lovable Cloud provides the database, auth, storage (attachments/packets), and server logic. Staff sign in with email/password plus Google; the public browses anonymously with no account.

### Roles

Stored in a dedicated roles table (never on profiles) and checked server-side: `admin`, `clerk`, `attorney`, `department_staff`, `board_member`, `viewer`. Admin manages users and role assignment in the admin portal.

---

## Phase 1 — Configuration foundation + legislative files

Admin portal (`/admin`) where everything is defined before any content exists:

- **Bodies**: City Council, Planning Commission, boards/committees — each with seat count, terms, quorum rule, default meeting cadence and location.
- **Members & seats**: people assigned to seats on bodies, with terms and vacancies.
- **Item types**: Ordinance, Resolution, Proclamation, Contract, Appointment, Presentation, Minutes Approval — each with its own required fields, required number of readings, and whether it needs a public hearing.
- **Numbering rules**: per item type and body, a pattern builder (e.g. `ORD-{YYYY}-{seq:000}`) with sequence reset policy (annual/never).
- **Vote rules**: named rules (simple majority, majority of full membership, two-thirds, supermajority of quorum) assignable per item type and body; abstention and recusal handling configured here.
- **Workflow templates**: ordered approval steps (e.g. Department → Attorney → Finance → Clerk), each step assigned to a role or specific user, with parallel-vs-sequential and required/optional flags.
- **Agenda templates**: ordered section list (Call to Order, Consent, Public Hearings, Old Business, New Business, Adjournment) per body, with numbering style.
- **Meeting rules**: notice period, agenda posting deadline, public comment settings.

**Legislative files** module: create an item, pick body + item type (fields render from the type config), enter title/sponsor/summary/fiscal impact, attach files, draft body text with version history. Auto-number on adoption per the numbering rule. Every item carries a full audit trail.

## Phase 2 — Workflow routing and agenda assembly

- Items enter the configured workflow; approvers see a queue, approve/reject with comments, and rejections return the item to the author.
- **Agenda builder**: clerk picks a meeting, drags approved items into template sections, reorders, marks consent items, sets time-certain entries. Agenda auto-numbers from the template.
- **Meeting records**: scheduled meetings per body with date/time/location, status (draft → published → in progress → adjourned), notice/posting deadline warnings.
- **Packet generation**: a printable/exportable agenda and full packet (cover, agenda, each item with attachments), published to the portal.

## Phase 3 — Live meeting console

Clerk-run console for an in-progress meeting:

- **Roll call**: mark present/absent/excused; quorum computed live from the body's configured quorum rule, with a clear blocked state when quorum fails.
- **Item flow**: advance through the agenda, mark the current item, log public speakers and hearing open/close.
- **Motions**: record motion text, mover, seconder, amendments.
- **Voting**: open a vote, each member's aye/nay/abstain/recuse recorded (clerk-entered, and board members can cast from their own device when signed in). Result computed from the item's configured vote rule, showing the threshold and whether it passed.
- **Readings**: items requiring multiple readings track reading count and carry forward automatically.
- **Minutes**: actions, motions, and vote tallies stream into a draft minutes document as the meeting runs; clerk edits and finalizes afterward, and approved minutes become a legislative item of their own.

## Phase 4 — Public portal

Anonymous, fast, and crawlable:

- Home with upcoming meetings and recently adopted legislation.
- Meeting calendar; per-meeting page with agenda, packet, minutes, and vote results.
- Legislation search and browse with filters (type, body, sponsor, status, date range) and full-text search.
- Item detail with history, attachments, and every recorded vote.
- Adopted-ordinance browsing with the assigned numbers.
- Board/member pages with voting records.
- Per-page SEO metadata and structured data on meeting and legislation pages.

## Phase 5 — Polish

Notifications for pending approvals and upcoming deadlines, saved searches, CSV/PDF exports, an admin dashboard with pipeline metrics, and accessibility passes on the public portal.

---

### Technical notes

- Data model centers on: `bodies`, `body_seats`, `members`, `item_types`, `numbering_rules`, `vote_rules`, `workflow_templates` + `workflow_steps`, `agenda_templates` + `template_sections`, `legislative_items` + `item_versions` + `item_attachments`, `workflow_instances` + `step_actions`, `meetings`, `agenda_items`, `roll_call`, `motions`, `votes`, `minutes`, `user_roles`, `audit_log`.
- RLS on every table with explicit grants: public read limited to published meetings, published agendas, adopted items, and finalized minutes; drafts and internal workflow data restricted to authenticated staff by role via a security-definer `has_role` function.
- All writes go through server functions with server-side role and rule enforcement — vote thresholds, quorum, and numbering are computed on the server, never trusted from the client.
- Attachments and generated packets live in Cloud storage with signed access for drafts and public access once published.
- Design direction: an institutional, records-office aesthetic — dense typographic tables, restrained civic palette, strong document hierarchy. Not a generic SaaS dashboard.

### Build order

I will ship Phase 1 first so the configuration and item model are correct, then layer phases 2–5, checking in with you after each phase.
