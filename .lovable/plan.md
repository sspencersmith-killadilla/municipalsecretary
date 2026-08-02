# Mobile Meeting Console Quick Wins

## Goal
Make the live meeting console usable on phones and tablets during a real meeting, with larger touch targets, a stacked layout, and a simplified at-a-glance view for board members.

## What we’ll build

### 1. Responsive console layout
- Collapse the current 3-column desktop grid into a single stacked column on small screens.
- Promote the **current agenda item + open motion + quorum badge** into a sticky top summary card so clerks and members always see the live state without scrolling.
- Increase tap targets for all console buttons (roll-call status chips, vote buttons, agenda actions) to at least 44×44 px.

### 2. Board-member “meeting at a glance” view
- For users without `canManage` (board members, viewers), render a read-only mobile card showing:
  - Meeting status, quorum, and current item.
  - Open motion text and current vote tally.
  - Recent speaker-queue activity.
- Hide clerk-only controls (record roll call, create motion, edit minutes) instead of just disabling them.

### 3. Touch-optimized roll call & voting
- Roll call: replace the tiny status chips with a full-width row per member containing 4 large segmented buttons (`Present`, `Remote`, `Absent`, `Excused`).
- Voting: when a motion is open, show a grid of large choice buttons (`Aye`, `Nay`, `Abstain`, `Recuse`) per member, suitable for a clerk tapping on a tablet.
- Add haptic/visual feedback on tap (active state + toast confirmation).

### 4. Mobile staff navigation
- Replace the horizontal text-only mobile nav in `StaffShell` with an icon + label bottom tab bar on small screens, so clerks can jump between Console, Briefings, and Meetings quickly during a meeting.
- Keep the existing sidebar on `lg` screens unchanged.

## Files to touch

- `src/routes/_authenticated/staff/console/$meetingId.tsx`
  - Refactor layout with responsive grid/flex stacking.
  - Extract `CurrentItemCard`, `RollCallPanel`, `VotingPanel`, `AgendaList`, `MinutesPanel` sub-components.
  - Add board-member read-only summary.
- `src/components/StaffShell.tsx`
  - Swap the horizontal mobile nav for a bottom tab bar (`sm:hidden`).
- `src/styles.css`
  - Add any needed mobile utility variables (already Tailwind v4).
- `src/lib/votes.ts`
  - No logic changes; reuse existing `computeTally` and `quorumRequired`.

## Out of scope (for this quick-win pass)

- Offline/PWA installability (not requested).
- Native mobile app.
- Real-time subscriptions/WebSockets (console already refreshes via queries).
- New backend tables or permissions.

## Acceptance criteria

1. Console renders in a single readable column on a 375 px wide viewport with no horizontal overflow.
2. Roll-call buttons are easy to tap; a clerk can mark a 7-member board present in under 10 taps.
3. Board-member view shows current item, open motion, and tally without edit controls.
4. Mobile bottom tab bar provides one-tap access to Console, Briefings, and Meetings.
5. All existing desktop functionality remains unchanged at `lg` and above.

## Suggested order

1. Refactor console layout + current-item summary card.
2. Build responsive roll-call and voting panels.
3. Add board-member read-only summary.
4. Replace mobile staff nav with bottom tab bar.
5. Verify on mobile, tablet, and desktop viewports.