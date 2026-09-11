import type { ApplicationSectionId } from "@/lib/validation/application";

// =============================================================================
// Applicant product copy.
//
// LOCKED        Plan-literal wording from PROJECT_PLAN.md sections 7, 13, and 14: rocketry
//               headings, literal button labels, and the irreversible-submission notice.
//               Tests and accessible names depend on these strings. Claude owns them.
// COPY          Supporting and marketing text, written as neutral placeholders. Astra owns
//               the voice: rewrite any value, but keep every key and function signature.
// FIELD_COPY    Optional per-field label overrides and help prose (Astra-editable).
// SECTION_COPY  Optional section intros (Astra-editable).
//
// Hints that restate validation rules (number ranges, link format, item limits) are built
// from the form config in lib/view-models/fields.ts so they cannot drift from the schemas.
// Application status labels live in lib/application-config.ts.
// =============================================================================

export const LOCKED = {
  brand: "CalHacks Mission Control",
  landing: {
    heroTitle: "Build what comes next.",
    heroSubtitle: "Your Cal Hacks mission starts here.",
    signIn: "Sign in",
    applyNow: "Apply now",
    promises: {
      assemble: "Assemble",
      launch: "Launch",
      explore: "Explore",
    },
  },
  auth: {
    signIn: "Sign in",
    createAccount: "Create account",
    signOut: "Sign out",
  },
  portal: {
    trackMission: "Track your mission",
  },
  editor: {
    launchReadiness: "Launch readiness",
    saveDraft: "Save draft",
    saveAndContinue: "Save & continue",
  },
  review: {
    heading: "Ready for launch",
    submit: "Submit application",
    irreversible: "You can't edit your application after you submit it.",
  },
  launch: {
    heading: "Liftoff!",
  },
  mission: {
    cruising: "Cruising to your destination",
    landed: "Landing complete",
    legs: {
      launch: "Launch",
      cruise: "Cruise",
      landing: "Landing",
    },
  },
} as const;

export const COPY = {
  meta: {
    description: "Apply to Cal Hacks as a Hacker or Judge and follow your application from launch to landing.",
    titles: {
      portal: "Portal",
      application: "Your application",
      mission: "Mission tracker",
    },
  },
  common: {
    skipToContent: "Skip to main content",
    loading: "Loading…",
    optional: "(optional)",
    required: "(required)",
    opensInNewTab: "(opens in a new tab)",
    errorPrefix: "Error:",
  },
  landing: {
    tagline: "Your ideas are cleared for takeoff.",
    navLabel: "Main",
    portalCard: {
      title: "Start your mission",
      body: "Bring your curiosity. Apply as a Hacker or Judge, or pick up where you left off.",
    },
    promises: {
      assemble: "A little about you. A little about what you love to build. Save your draft as you go.",
      launch: "Give your answers one last look. When everything is ready, send your application on its way.",
      explore: "Follow your application from submission to decision. Your mission tracker shows where things stand.",
    },
  },
  schedule: {
    timeline: {
      title: "Your flight plan",
      stops: {
        applicationsOpen: "Applications open",
        applicationDeadline: "Application deadline",
        resultsReleased: "Results released",
        event: "Event dates",
      },
      states: {
        complete: "Checkpoint complete",
        active: "Happening now",
        next: "Next checkpoint",
        upcoming: "Upcoming checkpoint",
      },
      openNow: "Applications are open",
      toBeAnnounced: "Date to be announced",
    },
    countdown: {
      title: "Mission clock",
      launch: {
        title: "Time to launch",
        caption: "Applications close:",
        completeText: "Applications are closed.",
      },
      landing: {
        title: "Time to landing",
        caption: "Cal Hacks begins:",
        completeText: "Touchdown! Cal Hacks has begun.",
      },
      units: {
        days: "Days",
        hours: "Hours",
        minutes: "Minutes",
        seconds: "Seconds",
      },
      remaining: (days: number, hours: number, minutes: number) => {
        const named = (
          [
            [days, "day", "days"],
            [hours, "hour", "hours"],
            [minutes, "minute", "minutes"],
          ] as const
        )
          .filter(([count]) => count > 0)
          .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`);
        if (named.length === 0) {
          return "Less than a minute left";
        }
        if (named.length === 1) {
          return `${named[0]} left`;
        }
        return named.length === 2
          ? `${named[0]} and ${named[1]} left`
          : `${named[0]}, ${named[1]}, and ${named[2]} left`;
      },
    },
  },
  auth: {
    signOut: {
      pending: "Signing out…",
    },
    login: {
      title: "Sign in",
      description: "Welcome back to the workshop. Sign in to pick up where you left off.",
      email: "Email",
      password: "Password",
      pending: "Signing in…",
      noAccount: "New to CalHacks Mission Control?",
      createAccountLink: "Create an account",
    },
    signup: {
      title: "Create your account",
      description: "Choose how you want to take part in Cal Hacks.",
      roleLegend: "I'm applying as",
      roleHint: "Choose one or both.",
      roleDescriptions: {
        hacker: "Build a project with a team during the event.",
        judge: "Evaluate projects and give teams feedback.",
      },
      email: "Email",
      password: "Password",
      passwordHint: (minLength: number) => `Use at least ${minLength} characters.`,
      pending: "Creating your account…",
      haveAccount: "Already have an account?",
      signInLink: "Sign in",
    },
    checkEmail: {
      title: "Check your email",
      body: (email: string) =>
        `We sent a confirmation link to ${email}. Open it in this browser to finish creating your account.`,
      signInLink: "Go to sign in",
    },
    demo: {
      title: "Demo accounts",
      body: "For reviewing this project. These are shared demo logins with sample data, not real accounts.",
      emailLabel: "Email",
      passwordLabel: "Password",
      accounts: [
        { label: "Organizer", email: "organizer@calhacks.com", password: "ILoveHacking" },
        { label: "Applicant", email: "applicant@gmail.com", password: "ILoveRockets" },
      ],
    },
    callbackErrors: {
      link_expired: {
        title: "That link has expired",
        body: "Sign in if you already confirmed your email. Otherwise, sign up again to get a new link.",
      },
      confirm_link_other_browser: {
        title: "Open the link in the same browser",
        body: "Confirmation links only work in the browser where you created your account. Sign in if you already confirmed.",
      },
      invalid_link: {
        title: "That link isn't valid",
        body: "Sign in, or sign up again to get a new confirmation link.",
      },
      auth_callback_failed: {
        title: "We couldn't confirm your email",
        body: "Try signing in. If that doesn't work, sign up again.",
      },
    },
  },
  authNotices: {
    invalid_credentials: { title: "Email or password is incorrect", body: "Check your details and try again." },
    email_not_confirmed: { title: "Confirm your email first", body: "Open the confirmation link we emailed you, then sign in." },
    rate_limited: { title: "Too many attempts", body: "Wait a moment, then try again." },
    forbidden: { title: "Sign-up is unavailable", body: "Try again later." },
    unexpected_error: { title: "Something went wrong", body: "Try again in a moment." },
    network: { title: "We couldn't reach CalHacks Mission Control", body: "Check your connection and try again." },
    validation_failed: {
      title: "Check your details",
      body: "Something in this form couldn't be accepted. Reload the page and try again.",
    },
  },
  onboarding: {
    title: "Confirm your account",
    description: "Check your details, then start your application.",
    accountType: "Applying as",
    displayName: "Display name",
    displayNameHint: "Shown on your dashboard.",
    submit: "Start application",
    pending: "Setting up your application…",
    wrongRole: "Chose the wrong applications? Sign out and create a new account with a different email.",
  },
  portal: {
    greeting: (name: string | null) => (name ? `Welcome, ${name}` : "Welcome"),
    reference: (reference: string) => `Application ${reference}`,
    switcherLabel: "Switch applications",
    progressTitle: "Your application",
    progressLabel: "Application progress",
    progressValue: (percent: number) => `${percent}% complete`,
    nextStep: "Next up",
    startCta: "Start application",
    continueCta: "Continue application",
    reviewCta: "Review and submit",
    lastSaved: "Last saved",
    notSaved: "Not saved yet",
    deadlineTitle: "Application deadline",
    deadlineTba: "To be announced",
    statusTitle: "Application status",
    launched: "Launched",
    viewApplication: "View submitted application",
  },
  readiness: {
    states: {
      complete: "Complete",
      in_progress: "In progress",
      not_started: "Not started",
    },
    current: "Current section",
    needsAttention: "Needs attention",
    progress: (completed: number, total: number) =>
      total === 0 ? "No required answers" : `${completed} of ${total} required answers`,
  },
  editor: {
    title: (typeLabel: string) => `${typeLabel} application`,
    backToPortal: "Back to portal",
    sectionNavLabel: "Application sections",
    sectionSelectLabel: "Section",
    goToSection: "Go",
    progressLabel: "Application progress",
    railLabel: "Section help",
    reviewStep: "Review",
    clearSelection: "Clear selection",
    errorSummaryTitle: "There is a problem",
    selectedCount: (count: number, max: number) => `${count} of ${max} selected`,
    characterCount: (count: number, max: number) => `${count} of ${max} characters`,
    hints: {
      wholeNumber: (min: number, max: number) => `Enter a whole number from ${min} to ${max}.`,
      chooseUpTo: (maxItems: number) => `Choose up to ${maxItems}.`,
      maxCharacters: (maxLength: number) => `Up to ${maxLength} characters.`,
      profileLink: (example: string) => `Paste the full link to your profile, like ${example}`,
      searchableChoice: "Start typing to filter the list, then choose an option.",
    },
    requiredLegend: "Questions marked with an asterisk (*) are required.",
    combobox: {
      showOptions: "Show options",
      noResults: "No matches. Check the spelling or clear the text to see every option.",
    },
    saveStatus: {
      saved: "All changes saved",
      saving: "Saving…",
      dirty: "Unsaved changes",
      invalid: (count: number) => (count === 1 ? "1 answer needs attention" : `${count} answers need attention`),
      error: "Not saved",
      blocked: "Editing is closed",
    },
    announce: {
      saved: "Draft saved.",
      nothingToSave: "All changes saved.",
      saving: "Saving…",
      submitting: "Submitting…",
      submitted: "Application submitted.",
    },
    lastSaved: "Last saved",
    leaveUnsaved: "Some changes couldn't be saved. Leave this page anyway?",
  },
  fields: {
    codeOfConductAgreement: "I agree to follow the Cal Hacks code of conduct.",
  },
  review: {
    intro: "One last preflight check. Read through your answers and use the edit links for any finishing touches.",
    missing: (count: number) =>
      count === 1 ? "1 required answer is missing." : `${count} required answers are missing.`,
    goToMissing: (sectionLabel: string) => `Go to ${sectionLabel}`,
    unsaved: "Some changes haven't been saved yet. Save them before you submit.",
    notAnswered: "Not answered",
    notAnsweredRequired: "Not answered (required)",
    editSection: (sectionLabel: string) => `Edit ${sectionLabel}`,
    agreementAccepted: "Accepted",
    agreementNotAccepted: "Not accepted",
    launchMessage: "Your application is on its way to Mission Control.",
  },
  submitted: {
    title: "Your submitted application",
    locked: "This application has been submitted, so it can no longer be edited.",
  },
  mission: {
    backToPortal: "Back to portal",
    progressLabel: "Mission progress",
    legStates: {
      complete: "Completed",
      current: "Current stage",
      upcoming: "Upcoming",
    },
    launched: "Launched",
    received: "Mission Control has received your application.",
    reviewNote: "Mission Control is reviewing your application.",
    reviewStarted: "Review started",
    decisionPending: "Decision not released yet",
    released: "Released",
    decision: {
      accepted: "Congratulations! Your application to Cal Hacks was accepted.",
      waitlisted: "Your application to Cal Hacks is on the waitlist.",
    },
  },
  notices: {
    conflict: {
      title: "Your application changed somewhere else",
      body: "Try saving again, or reload the latest version. Your unsaved edits stay on this page.",
    },
    unauthenticated: {
      title: "You've been signed out",
      body: "Sign in again in a new tab, then try again. Your edits stay on this page.",
    },
    not_found: { title: "We couldn't find your application", body: "Reload the page to continue." },
    forbidden: { title: "You don't have access to this", body: "Reload the page or sign in with a different account." },
    rate_limited: { title: "Too many attempts", body: "Wait a moment, then try again." },
    validation_failed: {
      title: "Some answers couldn't be saved",
      body: "Remove any unusual characters and try again.",
    },
    unexpected_error: { title: "Something went wrong", body: "Try again in a moment." },
    network: {
      title: "We couldn't reach CalHacks Mission Control",
      body: "Check your connection and try again. Your edits stay on this page.",
    },
    stale_deployment: { title: "CalHacks Mission Control was updated", body: "Reload the page to continue." },
    application_locked: {
      title: "Application submitted",
      body: "This application has already been submitted, so it can't be edited.",
    },
    unconfirmed_submit: {
      title: "We couldn't confirm your submission",
      body: "Check your application status before trying again.",
    },
    actions: {
      retry: "Try again",
      reload: "Reload",
      reloadLatest: "Reload latest",
      signInNewTab: "Sign in in a new tab",
      checkStatus: "Check status",
      dismiss: "Dismiss",
    },
  },
  pages: {
    error: {
      title: "Something went wrong",
      body: "We couldn't load this page. Try again.",
      retry: "Try again",
    },
    notFound: {
      title: "Page not found",
      body: "We couldn't find that page.",
      home: "Go to the CalHacks Mission Control home page",
    },
  },
} as const;

/** Optional label overrides and help prose, keyed by response field key. */
export const FIELD_COPY: Readonly<Record<string, { readonly label?: string; readonly help?: string } | undefined>> = {};

/** Optional intros shown at the top of each application section. */
export const SECTION_COPY: Readonly<Partial<Record<ApplicationSectionId, { readonly intro?: string }>>> = {
  about: { intro: "Every mission starts with a person. Tell us a little about you." },
  education: { intro: "Tell us where you are learning and what you are exploring." },
  experience: { intro: "Show us the interests and experience you bring to the workshop." },
  professional: { intro: "Tell us about the work you do and the expertise you bring to the workshop." },
  judging: { intro: "Share your judging experience, when you can help, and anything that could be a conflict of interest." },
  short_answers: { intro: "A few questions, answered in your own words. We want to hear how you think." },
  agreements: { intro: "Great things get built when people look out for each other. Review the agreement before you continue." },
};

// =============================================================================
// Organizer product copy (Phase 3).
//
// ORGANIZER_LOCKED  Plan-literal organizer wording from PROJECT_PLAN.md sections 13 and 14: the Mission Control
//                   heading, KPI names, the Expertise Radar and its coverage gap, and literal review labels.
//                   Tests and accessible names depend on these strings. Claude owns them.
// ORGANIZER_COPY    Supporting organizer text, written as neutral placeholders. Astra owns the voice: rewrite any
//                   value, but keep every key and function signature.
//
// Status, type, recommendation, rubric, and expertise labels live in lib/application-config.ts.
// =============================================================================

export const ORGANIZER_LOCKED = {
  dashboard: {
    heading: "Mission Control",
    kpis: {
      submitted: "Submitted",
      needsReview: "Needs review",
      reviewsComplete: "Reviews complete",
      decisionsMade: "Decisions made",
    },
    startReviewing: "Start reviewing",
    expertiseRadar: "Expertise Radar",
    coverageGap: "Coverage gap",
  },
  workspace: {
    applicant: (reference: string) => `Applicant ${reference}`,
    saveReviewAndContinue: "Save review and continue",
    saveDraft: "Save draft",
    nextApplication: "Next application",
    notes: "Private organizer notes",
    recommendation: "Recommendation",
  },
} as const;

export const ORGANIZER_COPY = {
  meta: {
    titles: {
      dashboard: "Mission Control",
      applications: "Applications",
      review: "Review application",
    },
  },
  nav: {
    label: "Mission Control",
    dashboard: "Dashboard",
    applications: "Applications",
  },
  queue: {
    label: "Review queue",
    value: (reviewed: number, total: number) =>
      total === 0 ? "No submitted applications yet" : `${reviewed} of ${total} reviewed`,
    remaining: (remaining: number) =>
      remaining === 1 ? "1 application needs review" : `${remaining} applications need review`,
  },
  rows: {
    notSubmitted: "Not submitted",
    notScored: "Not scored",
    noRecommendation: "No recommendation",
    reviewStates: {
      complete: "Review complete",
      inProgress: "Review in progress",
      none: "Not reviewed",
    },
  },
  dashboard: {
    intro: "A live read on submissions, reviews, and decisions across the whole mission.",
    kpisTitle: "Mission instruments",
    queueTitle: "Review queue",
    queueEmpty: "The review queue is clear for now.",
    breakdownTitle: "Applications by type and status",
    breakdownTotal: (count: number) => (count === 1 ? "1 application" : `${count} applications`),
    breakdownCount: (count: number, total: number) => `${count} of ${total}`,
    radarIntro: "See where the judging crew is strong and where another specialist could help.",
    radarImageLabel: (areaCount: number, judgeCount: number) =>
      `Radar chart of ${areaCount} areas of expertise across ${judgeCount} submitted ${judgeCount === 1 ? "Judge" : "Judges"}. The table after it lists the same numbers.`,
    radarTableCaption: "Submitted Judges by area of expertise",
    radarColumns: {
      area: "Area of expertise",
      judges: "Judges",
    },
    gapBody: "No submitted Judge has listed these areas yet.",
    noGaps: "Every expertise area has at least one Judge on the radar.",
    noJudges: "The radar is waiting for its first submitted Judge application.",
    recentTitle: "Recent submissions",
    recentEmpty: "No applications have reached Mission Control yet.",
    viewAll: "View all applications",
    emptyTitle: "No applications yet",
    emptyBody: "Mission instruments come online when the first application launches.",
  },
  applications: {
    heading: "Applications",
    intro: "Find the right application and keep the review queue moving.",
    filtersTitle: "Tune the application feed",
    search: "Search",
    searchHint: "Search by name, email, school, or company.",
    type: "Application type",
    status: "Status",
    reviewState: "Review",
    sort: "Sort by",
    anyType: "All types",
    anyStatus: "All statuses except draft",
    anyReviewState: "Reviewed or not",
    reviewStateOptions: {
      reviewed: "Reviewed",
      unreviewed: "Not reviewed",
    },
    sortOptions: {
      submitted_desc: "Newest submitted first",
      submitted_asc: "Oldest submitted first",
      score_desc: "Highest score first",
      score_asc: "Lowest score first",
    },
    apply: "Apply filters",
    clear: "Clear filters",
    caption: (sortLabel: string) => `Applications (${sortLabel})`,
    columns: {
      applicant: "Applicant",
      reference: "Reference",
      type: "Type",
      status: "Status",
      submitted: "Submitted",
      score: "Score",
      review: "Review",
    },
    sortAction: (sortLabel: string) => `(sort: ${sortLabel})`,
    email: "Email",
    affiliation: "School or company",
    resultCount: (total: number) => (total === 1 ? "1 application" : `${total} applications`),
    range: (from: number, to: number, total: number) => `Showing ${from} to ${to} of ${total}`,
    paginationLabel: "Pages",
    pageStatus: (page: number, pageCount: number) => `Page ${page} of ${pageCount}`,
    previousPage: "Previous page",
    nextPage: "Next page",
    lastPage: "Go to the last page",
    emptyTitle: "No applications yet",
    emptyBody: "Submitted applications will appear here as they reach Mission Control.",
    noResultsTitle: "No applications match these filters",
    noResultsBody: "Adjust the search coordinates or clear the filters.",
    pastEndTitle: "There are no applications on this page",
    pastEndBody: "The results have fewer pages than this link expects.",
  },
  workspace: {
    backToList: "Back to applications",
    submitted: "Submitted",
    blind: {
      on: "Blind review is on. You can focus on the work before seeing who made it.",
      off: "Identifying details are visible for this review.",
      reveal: "Show identifying details",
      hide: "Hide identifying details",
    },
    identity: {
      title: "Applicant identity",
      name: "Name",
      email: "Email",
      birthdate: "Birthdate",
      countryOfResidence: "Country of residence",
      cityOfResidence: "City of residence",
      affiliation: {
        hacker: "School",
        judge: "Company / organization",
      },
      links: "Links",
      notProvided: "Not provided",
    },
    narrativeTitle: "Application answers",
    scorecard: {
      title: "Scorecard",
      hint: (min: number, max: number) => `Use the full runway: score each area from ${min} (low) to ${max} (high).`,
      anchors: {
        low: "Little evidence",
        middle: "Some evidence",
        high: "Strong evidence",
      },
      overallScore: "Overall score",
      overallPending: "Score every area to complete the readout.",
      overallValue: (score: string, max: number) => `${score} out of ${max}`,
      recommendationHint: "This guides the team; it does not release a decision.",
      notesHint: "Private workspace notes, visible only to organizers.",
      characterCount: (count: number, max: number) => `${count} of ${max} characters`,
      saveReview: "Save review",
      errorSummaryTitle: "There is a problem",
      completedAt: "Review completed",
      draftSavedAt: "Draft saved",
      notSaved: "No review saved yet",
      noScore: "Not scored",
      noRecommendation: "No recommendation",
      noNotes: "No notes",
    },
    status: {
      saving: "Saving review…",
      draftSaved: "Draft review saved.",
      reviewSaved: "Review saved.",
      revealing: "Loading identifying details…",
      hiding: "Hiding identifying details…",
      releasing: "Releasing decision…",
    },
    access: {
      owned: {
        title: "Another organizer is reviewing this application",
        body: "Their scorecard is visible here, but only they can make changes.",
      },
      notSubmitted: {
        title: "This application hasn't been submitted",
        body: "It can be reviewed after the applicant submits it.",
      },
      decided: {
        title: "A decision has been released",
        body: "This review can no longer be changed.",
      },
    },
    completed: {
      title: "Review complete",
      body: "The scorecard is saved and can be updated until a decision is released.",
    },
    continued: {
      title: (reference: string) => `Review for Applicant ${reference} saved`,
      body: "The next application in the queue is ready for review.",
    },
    queueDone: {
      title: "Review saved",
      body: "The review queue is clear. Nice work, Mission Control.",
    },
    decision: {
      title: "Decision",
      intro: "A released decision lands in the applicant's portal. Saving the scorecard alone never sends it.",
      legend: "Decision to release",
      release: "Release decision",
      chooseError: "Choose a decision to release.",
      saveFirst: "Save your review before releasing a decision.",
      unavailable: "Complete the review before releasing a decision.",
      confirmTitle: (label: string) => `Release the ${label} decision?`,
      confirmBody: "The applicant will see this decision in their portal, and it cannot be changed here afterward.",
      confirm: "Confirm release",
      cancel: "Cancel",
      released: (label: string) => `Decision released: ${label}`,
      releasedAt: "Released",
    },
    notFound: {
      title: "Application not found",
      body: "The link may be wrong, or the application may no longer exist.",
    },
  },
  notices: {
    unauthenticated: {
      title: "You've been signed out",
      body: "Sign in again in a new tab, then try again. Your review stays on this page.",
    },
    forbidden: {
      title: "You don't have access to this",
      body: "Reload the page, or sign in with an organizer account.",
    },
    not_found: {
      title: "We couldn't find this application",
      body: "Reload the page to check whether it still exists.",
    },
    validation_failed: {
      title: "Some review answers couldn't be saved",
      body: "Check your answers and try again.",
    },
    conflict: {
      title: "This review changed somewhere else",
      body: "Try saving again, or reload the latest version.",
    },
    rate_limited: { title: "Too many attempts", body: "Wait a moment, then try again." },
    invalid_status_transition: {
      title: "That change isn't allowed right now",
      body: "The application's status may have changed. Reload the page to see it.",
    },
    review_owned_by_another_organizer: {
      title: "Another organizer is reviewing this application",
      body: "Reload the page to see their review.",
    },
    review_locked: {
      title: "A decision has been released",
      body: "Reviews can't be changed after a decision is released. Reload the page to see it.",
    },
    review_already_completed: {
      title: "This review is already complete",
      body: "Reload the page to see the latest version.",
    },
    review_not_completed: {
      title: "Complete the review first",
      body: "Save a complete review before releasing a decision.",
    },
    unexpected_error: { title: "Something went wrong", body: "Try again in a moment." },
    network: {
      title: "We couldn't reach CalHacks Mission Control",
      body: "Check your connection and try again. Your review stays on this page.",
    },
    stale_deployment: { title: "CalHacks Mission Control was updated", body: "Reload the page to continue." },
  },
} as const;
