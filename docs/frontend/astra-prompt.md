# Prompt for Astra

Paste everything below the line into Astra, and give it access to the repository. The files it should read first are listed in the prompt.

---

You're doing the creative pass on **Launchpad**, the Cal Hacks application portal. The product already works end to end:

- signup, login, and onboarding;
- the Hacker and Judge editor, with drafts and Launch Readiness;
- review and submission;
- the portal and the Rocket Mission Tracker.

Claude Code built all of it with a plain baseline style and neutral placeholder art. Your job is to make it look and feel like the product in the plan, without touching how it works.

**Read these first, in this order:**

1. `docs/frontend/astra-handoff.md`: your brief, write set, frozen contract, motion rules, and tasks. It is the source of truth for this pass.
2. `PROJECT_PLAN.md` sections 1, 13, and 14: the product thesis, the visual and creative direction, and the page-level experience. Section 0 has an ownership amendment explaining why your scope is creative only.
3. `content/copy.ts`, `app/globals.css`, `app/fonts.ts`, and `components/art/`.

**Your scope (creative only):**

- **Art.** Original illustrations replacing the `components/art/` placeholders: the mark, the hero, the animal engineer, the rocket stages, stickers, and the liftoff and landing moments.
- **Motion.** Choreography beyond the baseline, in CSS and SVG only, following the reduced-motion and duration rules.
- **Polish.** Type scale, spacing, surfaces, and states, through `app/globals.css` tokens, the class maps, and `className` strings in `components/**`.
- **Voice.** The copy in `COPY`, `FIELD_COPY`, and `SECTION_COPY`. `LOCKED` strings are plan-literal and stay as they are.
- **QA.** A final look-and-feel pass at 375px and 1280px, with reduced motion on and off.

**Hard rules:**

- Edit only the write set in the handoff. Do not touch `app/**` pages and layouts, `lib/**`, `tests/**`, `e2e/**`, `supabase/**`, configs, or `package.json`. Add no dependencies.
- Keep every prop, id, role, `aria-*`, `data-*`, and `data-testid`, and the elements listed in the frozen contract. The tests select on them.
- Keep the contrast rules: navy text on coral, coral never as text, and no white text on coral, gold, or sky.
- Decorative art stays `aria-hidden`. Nothing important may depend on animation. Autoplaying motion stops within 5 seconds.
- If an idea needs anything outside your write set (a new prop, markup change, copy key, or logic), append it to `docs/frontend/astra-requests.md`, ship a fallback, and keep going.

**Work efficiently; your usage is limited:**

- Spend effort where the demo shows it: landing and brand art first, then liftoff and landing, then polish, then copy.
- Use `npm run dev` and `http://localhost:3000/dev/gallery`, which shows every view and state with replayable motion. You don't need Docker or Supabase for design work.
- Don't read `lib/`, `tests/`, `e2e/`, or `supabase/`. The handoff tells you everything the views need.
- Batch your edits, then verify once per batch with `npm run lint`, `npm run typecheck`, and `npm run test:unit`. Fix anything they report before moving on.

**When you finish,** reply with:

- the files you changed and any new assets;
- token and font changes;
- anything you're unsure keeps the contract;
- open requests.

Claude will run the full test suites and handle any contract or logic fixes.
