# Prompt for Astra

> Astra ran this prompt on 2026-09-11. What it changed is in [astra-handoff.md](astra-handoff.md#final-pass-results).

Paste everything below the line into Astra, working in this repository on the `astra-final-pass` branch.

---

You're taking **CalHacks Mission Control**, the Cal Hacks application portal, for a **final creative pass**. Your first two passes set the brand, art, and motion, and designed the round 2 surfaces, and they have shipped. This pass is short polish: a few layout and voice fixes, then a last look-and-feel check.

Nothing about how the product works should change.

**Read these first, in this order:**

1. `docs/frontend/astra-handoff.md`, starting with "Final pass tasks, in priority order". It is the source of truth for your write set, the frozen contract, the contrast rules, and the motion rules.
2. `docs/frontend/organizer.md`, "What Astra may and may not change", before you touch an organizer view.
3. The components named in each task.

**Tasks, in order:**

1. **Applications filter row.** Every filter shows its longest option in full at 1280px and wider.
2. **Timeline flight path.** At 1280px the route reads as one continuous path joining the four stops. At 375px the stacked timeline still reads as a sequence.
3. **Mission clock at 375px.** No stray decoration beside the heading.
4. **Clear themed copy.** Keep the voice, but make each themed phrase understandable on its own, especially the "to be announced" text and the countdown captions. Never write dates or times into copy.
5. **QA.** Check each page at 375px and 1280px, with reduced motion on and off. Tab through each page to confirm the focus rings, including on dark panels.

**Environment.** Design work needs no Docker or Supabase:

```bash
npm install
npm run dev
```

- `http://localhost:3000/dev/gallery` shows every applicant view and state, including the timeline and the live countdowns (`#gallery-schedule`).
- `http://localhost:3000/dev/gallery/organizer` shows every organizer state, including the applications filters.
- `http://localhost:3000` is the landing page. The live site is https://calhackstechnical.vercel.app.

**Hard rules:**

- **Write set.** Edit only the write set in the handoff. Don't touch:
  - `app/**` pages, layouts, containers, or galleries;
  - `lib/**`, `tests/**`, `e2e/**`, or `supabase/**`;
  - configs or `package.json`.

  Add no dependencies.
- **Frozen contract.** Keep every prop, id, role, `aria-*`, `data-*`, and `data-testid`, and every element listed in the frozen contract and in `organizer.md`. The tests select on them.
- **Contrast.**
  - Navy text on coral.
  - Coral is never text.
  - No white text on coral, gold, or sky.
  - The red asterisk stays at 4.5:1 or better.
- **Motion.**
  - Decorative art stays `aria-hidden`, and nothing important may depend on animation.
  - Autoplaying motion stops within 5 seconds, the countdown digits never animate per tick, and the timeline's rocket never loops.
- **Requests.** If an idea needs anything outside your write set, append it to `docs/frontend/astra-requests.md`, ship a fallback, and keep going.

**Work efficiently; your usage is limited:**

- Do the tasks in order and stop when they are done.
- Don't read `lib/`, `tests/`, `e2e/`, or `supabase/`. The handoff and `organizer.md` tell you everything the views need.
- Batch your edits, then verify once per batch with `npm run lint`, `npm run typecheck`, and `npm run test:unit`. Fix anything they report before moving on.

**When you finish,** reply with:

- the files you changed and any new assets;
- token and font changes;
- anything you're unsure keeps the contract;
- open requests.

Claude will run the full test suites and handle any contract or logic fixes.
