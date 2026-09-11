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
      title: "Mission timeline",
      stops: {
        applicationsOpen: "Applications open",
        applicationDeadline: "Application deadline",
        resultsReleased: "Results released",
        event: "Event dates",
      },
      states: {
        complete: "Complete",
        active: "Happening now",
        next: "Up next",
        upcoming: "Upcoming",
      },
      openNow: "Open now",
      toBeAnnounced: "To be announced",
    },
    countdown: {
      title: "Mission clock",
      pause: "Pause countdowns",
      launch: {
        title: "Time to launch",
        caption: "Applications due",
        completeText: "The application deadline has passed.",
      },
      landing: {
        title: "Time to landing",
        caption: "Cal Hacks starts",
        completeText: "Cal Hacks has started.",
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
    switcherLabel: "Your applications",
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
