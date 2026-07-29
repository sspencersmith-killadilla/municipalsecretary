## Goal

One scripted end-to-end tour of CivicLedger, captured once and published twice: a step-by-step PDF guide with screen grabs, and a real screen-recorded MP4 of the same session.

## Approach

A single Playwright script drives the live app in the sandbox, signing in as each demo persona in turn. Playwright records the whole session to video while also taking a labeled screenshot at every step. Both deliverables come from that one run, so the doc and the video never drift apart.

```text
walkthrough.py  ──►  screenshots/NN_step.png ──►  build_pdf.py  ──► walkthrough.pdf
                └─►  session.webm            ──►  ffmpeg edit  ──► walkthrough.mp4
```

## The script (chapters and steps)

**1. Public portal (signed out)**
Home, meetings calendar, a meeting detail page (agenda, notice banner, media, approved comments), the plain-text HTML alternative, legislation search and a file detail, boards list, filing a public comment / request to speak, subscribe page with the calendar and RSS feeds, records-request filing and tracking by code, accessibility statement.

**2. Staff: intake to agenda**
Sign in as Public Works Director → Submit an Item: pick a board, complete the intake questionnaire, run the AI draft, edit and file. Sign in as City Attorney → approvals queue, approve. Sign in as Deputy Clerk → agenda builder: add items to sections, reorder, mark consent, post the notice, publish, download the agenda packet PDF.

**3. Live meeting and minutes**
Deputy Clerk in the meeting console: call to order, roll call with live quorum, take up an item, speaker queue with timer, motion with mover/seconder, roll-call vote and automatic tally, closed-session panel, draft minutes, finalize with the SHA-256 seal, download the minutes PDF. Also shows the read-only observer banner when a board member opens the same console.

**4. Admin, briefings, records**
Demo City Clerk (admin): bodies and seats, item types, vote rules, numbering preview, members, board access, settings. Mayor persona: council briefing dashboard — stat cards, grant vs. local match, charts, filters, briefing cards. Back to clerk: comment moderation, records/FOIA queue with retention and legal holds, audit log, MFA enrollment screen.

Each step records a title, a one- or two-sentence "what you're seeing / what to click" caption, and the persona in use — this metadata feeds both outputs.

## PDF guide

ReportLab document, US Letter, styled to match the site's records-office look (ink/parchment palette, serif headings). Cover page, table of contents, then one section per chapter with numbered steps: heading, caption text, and the full-width screenshot with a thin rule border. A short "demo logins" table up front listing each persona and what it can do. Rendered pages are converted to images and visually inspected page by page before delivery; any clipped text, overlap, or bad spacing gets fixed and re-verified.

## Video

Playwright records the browser session at 1280×800. The raw capture is post-processed with ffmpeg:
- title card at the start and a closing card
- a chapter card between the four sections
- a lower-third caption bar showing the current step text and active persona, burned in at the right timestamps from the step metadata
- deliberate pacing: the script pauses on each screen long enough to read, and scrolls smoothly rather than jumping

Output is H.264 MP4, roughly 4–6 minutes, saved alongside the PDF.

## Notes and caveats

- The tour runs against the demo data and demo accounts already provisioned, so it will re-run cleanly whenever the app changes.
- Steps that mutate state (filing an item, publishing an agenda, finalizing minutes) will create real rows in the demo database — expected for a demo site, but worth knowing.
- The AI drafting step depends on a live model call; if it's slow the script waits, and if it fails the step is captured with the manual-edit path instead.
- Both files land in your Files panel as `civicledger-walkthrough.pdf` and `civicledger-walkthrough.mp4`. No changes are made to the app itself.

## Technical details

Playwright Python (already installed) with `record_video_dir` on the browser context; screenshots via `page.screenshot`, element screenshots for close-ups of the quorum and tally widgets. Sign-in uses the demo persona buttons on `/auth`, which call `ensureDemoAccounts` before signing in. Step metadata is written to a JSON manifest consumed by both the ReportLab builder and the ffmpeg caption filter graph. All intermediates live under `/tmp/walkthrough/`; only the two finished files go to `/mnt/documents/`.
