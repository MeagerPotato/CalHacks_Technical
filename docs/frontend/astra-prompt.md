# Prompt for Astra

Paste everything below the line into Astra, and give it access to the repository on the `phase-2-applicant` branch. The files it should read first are listed in the prompt.

---

You're taking **CalHacks Mission Control**, the Cal Hacks application portal, for a **second creative pass**. Your first pass set the brand, art, motion, and polish. Since then Claude Code has built new surfaces with a plain functional baseline, and they need your design:

- **An application switcher.** One account can now apply as both a Hacker and a Judge and switch between the two dashboards.
- **A mission timeline and live countdowns.** The landing page has a timeline of the Cal Hacks 13.0 schedule, and the landing page and portal have countdowns to the application deadline ("time to launch") and to the event ("time to landing").
- **A red required-question asterisk**, and a searchable country picker in the application's About you section.
- **Signup and onboarding updates.** Signup has Hacker and Judge checkboxes (one or both), and onboarding shows "Applying as" badges.
- **The organizer pages:** the Mission Control dashboard, the applications table, and the blind review workspace.

Nothing about how the product works should change. Your job is to make these surfaces look and feel like the rest of the product.

**Read these first, in this order:**

1. `docs/frontend/astra-handoff.md`: your round 2 brief, write set, frozen contract, motion rules, and tasks. It is the source of truth for this pass. Start with "What is new in round 2" and "Round 2 tasks".
2. `docs/frontend/organizer.md`: the organizer views' contract, especially "What Astra may and may not change".
3. `PROJECT_PLAN.md` sections 13 and 14: the visual direction and the page-level experience.
4. `content/copy.ts`, `app/globals.css`, and the components named in the handoff's table of new surfaces.

**Top priority: the application switcher.** The user sketched it. In the portal welcome, where the "Hacker" badge sits today, draw one segmented pill reading "Hacker | Judge":

- The application on screen is filled: **Hacker in the coral red** and **Judge in the sky blue** from the existing palette.
- The application not on screen stays the **beige page color**.
- Keep everything else on that page roughly the same.
- The switcher only appears for accounts holding both applications. Style it through `SWITCHER_CURRENT_CLASSES` and `SWITCHER_OTHER_CLASSES` in `components/portal/ApplicationSwitcher.tsx`.

**Then, in order:**

1. **The mission timeline (`MissionTimeline`).** Give it a rocket and space theme: a flight path joining the four stops, and a rocket at the current stop.
2. **The countdown panel (`CountdownPanel`).** Make it a mission-control readout. Do not animate each tick, and keep the pause toggle easy to find.
3. **The required asterisk and the country picker.**
4. **The organizer pages.**
5. **Signup checkboxes and onboarding badges.**
6. **Voice** for the new `COPY.schedule`, `COPY.portal.switcherLabel`, and `ORGANIZER_COPY` values. Never write dates or times into copy; they come from the event config.

**Environment.** Design work needs no Docker or Supabase:

```bash
npm install
npm run dev
```

- `http://localhost:3000/dev/gallery` shows every applicant view and state. The switcher is at `?portal=both-hacker` and `?portal=both-judge`, the countdowns are at `#gallery-schedule`, the timeline has four schedule moments, and the country picker and asterisks are in `#gallery-fields`.
- `http://localhost:3000/dev/gallery/organizer` shows every organizer state, chosen with `?dashboard=`, `?applications=`, and `?workspace=`.
- `http://localhost:3000` is the landing page, with the live timeline and countdowns.

**Hard rules:**

- Edit only the write set in the handoff. Do not touch `app/**` pages, layouts, containers, or galleries, `lib/**` (including `lib/event.ts`), `tests/**`, `e2e/**`, `supabase/**`, configs, or `package.json`. Add no dependencies.
- Keep every prop, id, role, `aria-*`, `data-*`, and `data-testid`, and the elements listed in the frozen contract and in `organizer.md`. The tests select on them.
- Keep the contrast rules: navy text on coral, coral never as text, no white text on coral, gold, or sky, and the red asterisk at 4.5:1 or better.
- Decorative art stays `aria-hidden`. Nothing important may depend on animation. Autoplaying motion stops within 5 seconds, and the countdown digits never animate per tick.
- If an idea needs anything outside your write set (a new prop, markup change, copy key, or logic), append it to `docs/frontend/astra-requests.md`, ship a fallback, and keep going.

**Work efficiently; your usage is limited:**

- Spend effort where the demo shows it: the switcher first, then the timeline and countdowns, then the rest.
- Don't read `lib/`, `tests/`, `e2e/`, or `supabase/`. The handoff and `organizer.md` tell you everything the views need.
- Batch your edits, then verify once per batch with `npm run lint`, `npm run typecheck`, and `npm run test:unit`. Fix anything they report before moving on.

**When you finish,** reply with:

- the files you changed and any new assets;
- token and font changes;
- anything you're unsure keeps the contract;
- open requests.

Claude will run the full test suites and handle any contract or logic fixes.
