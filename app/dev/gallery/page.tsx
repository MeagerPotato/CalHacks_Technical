import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnswerSummary } from "@/components/application/AnswerSummary";
import { EditorHeader } from "@/components/application/EditorHeader";
import { LaunchTransition } from "@/components/application/LaunchTransition";
import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { SaveStatus } from "@/components/application/SaveStatus";
import { SectionNav } from "@/components/application/SectionNav";
import { SectionSelect } from "@/components/application/SectionSelect";
import { SubmittedApplicationView } from "@/components/application/SubmittedApplicationView";
import { EngineerArt } from "@/components/art/EngineerArt";
import { HeroArt } from "@/components/art/HeroArt";
import { LandingMoment } from "@/components/art/LandingMoment";
import { BrandMark } from "@/components/art/BrandMark";
import { LiftoffMoment } from "@/components/art/LiftoffMoment";
import { RocketArt } from "@/components/art/RocketArt";
import { Sticker } from "@/components/art/Sticker";
import { CheckEmailNotice } from "@/components/auth/CheckEmailNotice";
import { GallerySection } from "@/components/dev/GallerySection";
import { MissionTracker } from "@/components/mission/MissionTracker";
import { LaunchReadiness } from "@/components/portal/LaunchReadiness";
import { PortalDraftDashboard } from "@/components/portal/PortalDraftDashboard";
import { PortalSubmittedDashboard } from "@/components/portal/PortalSubmittedDashboard";
import { CountdownPanel } from "@/components/schedule/CountdownPanel";
import { MissionTimeline } from "@/components/schedule/MissionTimeline";
import { AppLink } from "@/components/ui/AppLink";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Field, FieldGroup } from "@/components/ui/Field";
import { NoticeFromView } from "@/components/ui/Notice";
import { PageError, PageLoading, PageNotFound } from "@/components/ui/PageState";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextInput } from "@/components/ui/TextInput";
import { Timestamp } from "@/components/ui/Timestamp";
import { COPY, LOCKED } from "@/content/copy";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  EXPERIENCE_LEVEL_OPTIONS,
  HACKER_SKILL_OPTIONS,
} from "@/lib/application-config";
import { APPLICATION_STATUSES } from "@/lib/domain/enums";
import { EVENT_SCHEDULE } from "@/lib/event";
import { ROUTES } from "@/lib/routes";
import { toScheduleViews } from "@/lib/view-models/schedule";

import { LiveCountdowns } from "../../_components/LiveCountdowns";
import { ComboboxExample } from "./_components/ComboboxExample";
import { MotionReplay } from "./_components/MotionReplay";
import { PendingExample } from "./_components/PendingExample";
import {
  missionViews,
  notices,
  portalViews,
  readinessItems,
  reviewAnswerSections,
  sampleTimestamp,
  saveStatusViews,
  scheduleExamples,
  sectionNavItems,
  submittedAnswerSections,
  summaryItems,
  type GalleryVariant,
} from "./_fixtures";

// Development-only text in this file describes the gallery itself; product copy comes from content/copy.ts.

export const metadata: Metadata = { title: "Component gallery", robots: { index: false, follow: false } };

const GALLERY_PATH = "/dev/gallery";
const REPLAY = "Replay motion";
const ROCKET_STAGES = ["launch", "cruise", "landing"] as const;
const STICKERS = ["star", "wrench", "planet", "antenna", "bolt", "patch"] as const;
const SKILL_LIMIT = 8;

function pickVariant<T>(
  raw: string | string[] | undefined,
  variants: readonly GalleryVariant<T>[],
  fallback: string,
): GalleryVariant<T> {
  return variants.find((variant) => variant.id === raw) ?? variants.find((variant) => variant.id === fallback)!;
}

function galleryHref(portal: string, mission: string, anchor: string): string {
  return `${GALLERY_PATH}?${new URLSearchParams({ portal, mission }).toString()}#${anchor}`;
}

/**
 * Every view and state in one page, built from the real view-model functions and test fixture answers. It reads
 * no Supabase data, is never linked, and returns 404 in production builds. This is the design surface for
 * visual work: run `npm run dev` and open /dev/gallery. Views with fixed ids (the portal dashboard and the mission
 * tracker) show one variant at a time, chosen with ?portal= and ?mission=.
 */
export default async function GalleryPage({ searchParams }: PageProps<"/dev/gallery">) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const portal = pickVariant(params.portal, portalViews, "in-progress");
  const mission = pickVariant(params.mission, missionViews, "accepted");
  const { countdowns: liveCountdowns } = toScheduleViews(EVENT_SCHEDULE);

  return (
    <main id="main" tabIndex={-1}>
      <GallerySection
        id="gallery-organizer-link"
        title="Organizer pages"
        description="The organizer dashboard, applications table, and review workspace have their own gallery."
      >
        <AppLink href={`${GALLERY_PATH}/organizer`} variant="secondary">
          Open the organizer gallery
        </AppLink>
      </GallerySection>

      <GallerySection
        id="gallery-primitives"
        title="Buttons, links, badges, progress, timestamps"
        description="Primitive variants and states."
      >
        <Button variant="primary">{LOCKED.editor.saveAndContinue}</Button>
        <Button variant="secondary">{LOCKED.editor.saveDraft}</Button>
        <Button variant="quiet">{LOCKED.auth.signOut}</Button>
        <PendingExample example="button" />
        <Button variant="secondary" disabled>
          {LOCKED.editor.saveDraft}
        </Button>
        <AppLink href={ROUTES.portal}>{COPY.editor.backToPortal}</AppLink>
        <AppLink href={ROUTES.signup} variant="primary">
          {LOCKED.landing.applyNow}
        </AppLink>
        <AppLink href={ROUTES.login} variant="secondary">
          {LOCKED.landing.signIn}
        </AppLink>
        <AppLink href={ROUTES.home} variant="plain">
          <BrandMark />
        </AppLink>
        <AppLink href="https://example.com" newTab>
          Example external link
        </AppLink>
        {APPLICATION_STATUSES.map((status) => (
          <StatusBadge key={status} status={status} label={APPLICATION_STATUS_LABELS[status]} />
        ))}
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="info">Info</Badge>
        <Badge tone="highlight">Highlight</Badge>
        <Badge tone="success">Success</Badge>
        {[0, 45, 100].map((percent) => (
          <ProgressMeter
            key={percent}
            id={`gallery-progress-${percent}`}
            value={percent}
            label={COPY.editor.progressLabel}
            valueText={COPY.portal.progressValue(percent)}
          />
        ))}
        <Timestamp value={sampleTimestamp} prefix={COPY.portal.lastSaved} fallback={COPY.portal.notSaved} />
        <Timestamp value={null} fallback={COPY.portal.deadlineTba} />
      </GallerySection>

      <GallerySection
        id="gallery-fields"
        title="Form fields"
        description="Required asterisks, hints, counters, errors, choice limits, and the country picker."
      >
        <Field id="gallery-field-name" label="Full name" hint={COPY.editor.hints.maxCharacters(120)} required>
          {(control) => (
            <TextInput
              id={control.id}
              defaultValue="Ada Builder"
              describedBy={control.describedBy}
              invalid={control.invalid}
              required={control.required}
            />
          )}
        </Field>
        <ComboboxExample />
        <Field
          id="gallery-field-bio"
          label="Short biography"
          optionalText={COPY.common.optional}
          counter={{ current: 612, max: 600, text: COPY.editor.characterCount(612, 600) }}
          errors={["Use 600 characters or fewer."]}
        >
          {(control) => (
            <TextInput
              id={control.id}
              multiline
              rows={4}
              defaultValue="An answer that is longer than the limit allows."
              describedBy={control.describedBy}
              invalid={control.invalid}
            />
          )}
        </Field>
        <FieldGroup id="gallery-field-level" legend="Experience level">
          <RadioGroup
            idPrefix="gallery-field-level"
            name="gallery-level"
            options={EXPERIENCE_LEVEL_OPTIONS}
            value="intermediate"
          />
        </FieldGroup>
        <FieldGroup
          id="gallery-field-skills"
          legend="Skills or interests"
          counter={{ current: SKILL_LIMIT, max: SKILL_LIMIT, text: COPY.editor.selectedCount(SKILL_LIMIT, SKILL_LIMIT) }}
        >
          <CheckboxGroup
            idPrefix="gallery-field-skills"
            name="gallery-skills"
            options={HACKER_SKILL_OPTIONS}
            value={HACKER_SKILL_OPTIONS.slice(0, SKILL_LIMIT).map((option) => option.value)}
            maxItems={SKILL_LIMIT}
          />
        </FieldGroup>
        <FieldGroup id="gallery-field-agreement" legend="Code of conduct agreement" errors={["Accept the code of conduct."]}>
          <Checkbox id="gallery-field-agreement" label={COPY.fields.codeOfConductAgreement} checked={false} invalid />
        </FieldGroup>
        <ErrorSummary title={COPY.editor.errorSummaryTitle} items={summaryItems} formErrors={["A form-level message."]} />
      </GallerySection>

      <GallerySection id="gallery-notices" title="Notices" description="One notice per feedback code.">
        {notices.map((view) => (
          <NoticeFromView key={view.id} view={view} />
        ))}
      </GallerySection>

      <GallerySection id="gallery-page-states" title="Page states" description="Rendered without their main landmark.">
        <PageLoading label={COPY.common.loading} standalone={false} />
        <PageError
          title={COPY.pages.error.title}
          message={COPY.pages.error.body}
          retryLabel={COPY.pages.error.retry}
          standalone={false}
        />
        <PageNotFound
          title={COPY.pages.notFound.title}
          message={COPY.pages.notFound.body}
          homeHref={ROUTES.home}
          homeLabel={COPY.pages.notFound.home}
          standalone={false}
        />
      </GallerySection>

      <GallerySection id="gallery-art" title="Art slots" description="Neutral placeholders; replacements keep these props.">
        <BrandMark />
        <HeroArt />
        <EngineerArt variant="landing" />
        <EngineerArt variant="dashboard" />
        {ROCKET_STAGES.map((stage) => (
          <MotionReplay key={stage} label={REPLAY}>
            <RocketArt stage={stage} />
          </MotionReplay>
        ))}
        {STICKERS.map((name) => (
          <Sticker key={name} name={name} />
        ))}
        <MotionReplay label={REPLAY}>
          <LiftoffMoment />
        </MotionReplay>
        <MotionReplay label={REPLAY}>
          <LandingMoment decision="accepted" />
        </MotionReplay>
        <MotionReplay label={REPLAY}>
          <LandingMoment decision="waitlisted" />
        </MotionReplay>
      </GallerySection>

      <GallerySection id="gallery-auth" title="Check your email" description="Shown after signup when confirmation is on.">
        <CheckEmailNotice email="ada@example.com" signInHref={ROUTES.login} />
      </GallerySection>

      <GallerySection id="gallery-readiness" title="Launch Readiness" description="Just completed and needs attention.">
        <MotionReplay label={REPLAY}>
          <LaunchReadiness items={readinessItems} headingLevel={3} headingId="gallery-readiness-title" />
        </MotionReplay>
      </GallerySection>

      <GallerySection
        id="gallery-schedule"
        title="Mission clock"
        description="The live countdowns as the landing page and the portal show them."
      >
        {liveCountdowns ? <LiveCountdowns view={liveCountdowns} /> : null}
      </GallerySection>
      {scheduleExamples.map((example) => (
        <GallerySection
          key={example.id}
          id={`gallery-schedule-${example.id}`}
          title={`Schedule: ${example.label}`}
          description="The timeline and the countdown panel at this moment."
        >
          <MissionTimeline view={example.timeline} headingId={`gallery-timeline-${example.id}`} />
          {example.countdowns ? (
            <CountdownPanel
              view={example.countdowns}
              readings={example.readings}
              headingId={`gallery-countdowns-${example.id}`}
            />
          ) : null}
        </GallerySection>
      ))}

      <GallerySection id="gallery-portal" title="Portal dashboard" description="Choose a state.">
        {portalViews.map((variant) => (
          <AppLink
            key={variant.id}
            href={galleryHref(variant.id, mission.id, "gallery-portal")}
            variant="secondary"
            aria-current={variant.id === portal.id ? "true" : undefined}
          >
            {variant.label}
          </AppLink>
        ))}
      </GallerySection>
      <GallerySection id="gallery-portal-view" title={`Portal dashboard: ${portal.label}`}>
        {portal.view.kind === "draft" ? (
          <PortalDraftDashboard view={portal.view} />
        ) : (
          <PortalSubmittedDashboard view={portal.view} />
        )}
      </GallerySection>

      <GallerySection id="gallery-editor" title="Application editor" description="Header, navigation, and save states.">
        <EditorHeader
          title={COPY.editor.title(APPLICATION_TYPE_LABELS.hacker)}
          status="draft"
          statusLabel={APPLICATION_STATUS_LABELS.draft}
          backHref={ROUTES.portal}
          backLabel={COPY.editor.backToPortal}
        />
        <SectionNav label={COPY.editor.sectionNavLabel} items={sectionNavItems} />
        <SectionSelect
          id="gallery-section-select"
          label={COPY.editor.sectionSelectLabel}
          items={sectionNavItems}
          value="education"
          goLabel={COPY.editor.goToSection}
        />
        {saveStatusViews.map((view) => (
          <SaveStatus key={view.state} view={view} lastSaved={sampleTimestamp} lastSavedPrefix={COPY.editor.lastSaved} />
        ))}
      </GallerySection>

      <GallerySection id="gallery-review" title="Review" description="Answers with errors, and the submit control.">
        <AnswerSummary sections={reviewAnswerSections} />
        <ReviewSubmit
          noteId="gallery-review-note"
          note={LOCKED.review.irreversible}
          submitLabel={LOCKED.review.submit}
          pending={false}
        />
        <PendingExample example="review-submit" />
      </GallerySection>

      <GallerySection id="gallery-submitted" title="Submitted application" description="Read-only after launch.">
        <SubmittedApplicationView
          heading={COPY.submitted.title}
          status="submitted"
          statusLabel={APPLICATION_STATUS_LABELS.submitted}
          launched={sampleTimestamp}
          launchedPrefix={COPY.portal.launched}
          trackLabel={LOCKED.portal.trackMission}
          trackHref={ROUTES.portalMission}
          sections={submittedAnswerSections}
        />
      </GallerySection>

      <GallerySection id="gallery-liftoff" title="Liftoff" description="Shown after a successful submission.">
        <MotionReplay label={REPLAY}>
          <LaunchTransition heading={LOCKED.launch.heading} message={COPY.review.launchMessage} art={<LiftoffMoment />} />
        </MotionReplay>
      </GallerySection>

      <GallerySection id="gallery-mission" title="Mission tracker" description="Choose a state.">
        {missionViews.map((variant) => (
          <AppLink
            key={variant.id}
            href={galleryHref(portal.id, variant.id, "gallery-mission")}
            variant="secondary"
            aria-current={variant.id === mission.id ? "true" : undefined}
          >
            {variant.label}
          </AppLink>
        ))}
      </GallerySection>
      <GallerySection id="gallery-mission-view" title={`Mission tracker: ${mission.label}`}>
        <MotionReplay label={REPLAY}>
          <MissionTracker
            view={mission.view}
            backHref={ROUTES.portal}
            backLabel={COPY.mission.backToPortal}
            progressLabel={COPY.mission.progressLabel}
            releasedPrefix={COPY.mission.released}
          />
        </MotionReplay>
      </GallerySection>
    </main>
  );
}
