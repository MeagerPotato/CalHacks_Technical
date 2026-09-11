"use client";

import type { ReactNode } from "react";

import { LiftoffMoment } from "@/components/art/LiftoffMoment";
import { EditorHeader } from "@/components/application/EditorHeader";
import { EditorLayout } from "@/components/application/EditorLayout";
import { LaunchTransition } from "@/components/application/LaunchTransition";
import { SaveStatus } from "@/components/application/SaveStatus";
import { SectionNav } from "@/components/application/SectionNav";
import { SectionPanel } from "@/components/application/SectionPanel";
import { SectionSelect } from "@/components/application/SectionSelect";
import { SubmittedApplicationView } from "@/components/application/SubmittedApplicationView";
import { Button } from "@/components/ui/Button";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { LiveStatus, NoticeFromView } from "@/components/ui/Notice";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import { COPY, LOCKED } from "@/content/copy";
import { APPLICATION_FORMS, APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import type { ApplicantApplication } from "@/lib/data/types";
import { toSummaryItems } from "@/lib/editor/feedback";
import { REVIEW_STEP, applicationStepHref, sectionForField, sectionHeadingId, type EditorStep } from "@/lib/editor/steps";
import { portalMissionRoute, portalRoute } from "@/lib/routes";
import type { FieldErrors } from "@/lib/validation/errors";
import { toAnswerSections } from "@/lib/view-models/answers";
import { resolveSectionCopy } from "@/lib/view-models/fields";
import { toSectionNavItems } from "@/lib/view-models/readiness";
import type { TimestampView } from "@/lib/view-models/types";

import { ApplicationField } from "./ApplicationField";
import { ReviewStep } from "./ReviewStep";
import { useApplicationEditor } from "./use-application-editor";

function pickErrors(errors: FieldErrors, keys: readonly string[]): FieldErrors {
  const picked: FieldErrors = {};
  for (const key of keys) {
    if (errors[key]?.length) {
      picked[key] = errors[key];
    }
  }
  return picked;
}

interface ApplicationWorkspaceProps {
  application: ApplicantApplication;
  initialStep: EditorStep;
  /** Server-formatted last save time (null before the first save). */
  lastSaved: TimestampView | null;
  /** Server-formatted launch time (null for drafts). */
  launched: TimestampView | null;
}

/**
 * One persistent client tree for the application page: the section editor and review for drafts, the liftoff
 * screen right after submission, and the read-only application once it can no longer be edited.
 */
export function ApplicationWorkspace({ application, initialStep, lastSaved, launched }: ApplicationWorkspaceProps) {
  // Destructured here because the hook result holds a ref: the React hooks lint treats any property read from an
  // object that contains a ref as a ref read during render.
  const {
    state,
    saved,
    type,
    step,
    phase,
    errors,
    values,
    dirtyKeys,
    saveStatus,
    selectValue,
    announcement,
    summaryRef,
    noticeRef,
    selectStep,
    changeSelection,
    goToSelection,
    handleNoticeAction,
    activateSummaryItem,
    saveAndContinue,
    saveDraft,
    changeField,
    submit,
  } = useApplicationEditor({ application, initialStep });

  let content: ReactNode;

  if (phase === "launched") {
    content = (
      <LaunchTransition heading={LOCKED.launch.heading} message={COPY.review.launchMessage} art={<LiftoffMoment />} />
    );
  } else if (phase === "locked" || !saved.isEditable) {
    content = (
      <SubmittedApplicationView
        heading={COPY.submitted.title}
        status={saved.status}
        statusLabel={APPLICATION_STATUS_LABELS[saved.status]}
        launched={launched}
        launchedPrefix={COPY.portal.launched}
        trackLabel={LOCKED.portal.trackMission}
        trackHref={portalMissionRoute(type)}
        sections={toAnswerSections(type, saved.responses, { editable: false })}
        notice={state.notice ? <NoticeFromView view={state.notice} /> : undefined}
      />
    );
  } else {
    const form = APPLICATION_FORMS[type];
    const section = step === REVIEW_STEP ? null : (form.sections.find((candidate) => candidate.id === step) ?? null);
    const sectionCopy = section ? resolveSectionCopy(type, section) : null;
    const navItems = toSectionNavItems(type, saved.completion, step, {
      justCompleted: state.justCompleted,
      attentionFieldKeys: Object.keys(errors),
    });
    const summaryErrors = section ? pickErrors(errors, section.fields.map((field) => field.key)) : errors;
    const summaryItems = toSummaryItems(type, summaryErrors, (key) =>
      applicationStepHref(type, sectionForField(type, key) ?? step, key),
    );
    const saving = state.saveStatus === "saving";

    content = (
      <EditorLayout
        header={
          <EditorHeader
            title={COPY.editor.title(APPLICATION_TYPE_LABELS[type])}
            status={saved.status}
            statusLabel={APPLICATION_STATUS_LABELS[saved.status]}
            backHref={portalRoute(type)}
            backLabel={COPY.editor.backToPortal}
          />
        }
        progress={
          <>
            <ProgressMeter
              id="application-progress"
              value={saved.completion.percent}
              label={COPY.editor.progressLabel}
              valueText={COPY.portal.progressValue(saved.completion.percent)}
            />
            <SaveStatus view={saveStatus} lastSaved={lastSaved} lastSavedPrefix={COPY.editor.lastSaved} />
          </>
        }
        nav={
          <SectionNav
            label={COPY.editor.sectionNavLabel}
            items={navItems}
            onSelect={(item, event) => selectStep(item.step, event)}
          />
        }
        mobileNav={
          <SectionSelect
            id="application-section-select"
            label={COPY.editor.sectionSelectLabel}
            items={navItems}
            value={selectValue}
            onValueChange={changeSelection}
            goLabel={COPY.editor.goToSection}
            onGo={goToSelection}
          />
        }
        notices={
          <>
            {state.notice ? (
              <NoticeFromView ref={noticeRef} view={state.notice} onAction={handleNoticeAction} live="assertive" />
            ) : null}
            <ErrorSummary
              ref={summaryRef}
              title={COPY.editor.errorSummaryTitle}
              items={summaryItems}
              formErrors={state.formErrors}
              onItemActivate={activateSummaryItem}
            />
          </>
        }
      >
        {section && sectionCopy ? (
          <SectionPanel
            step={section.id}
            headingId={sectionHeadingId(section.id)}
            title={sectionCopy.label}
            intro={sectionCopy.intro}
            requiredLegend={section.fields.some((field) => field.required) ? COPY.editor.requiredLegend : null}
            onSubmit={saveAndContinue}
            actions={
              <>
                <Button type="submit" variant="primary" pending={saving}>
                  {LOCKED.editor.saveAndContinue}
                </Button>
                <Button variant="secondary" pending={saving} onClick={() => void saveDraft()}>
                  {LOCKED.editor.saveDraft}
                </Button>
              </>
            }
          >
            {section.fields.map((field) => (
              <ApplicationField
                key={field.key}
                type={type}
                field={field}
                value={values[field.key]}
                errors={errors[field.key]}
                onChange={changeField}
              />
            ))}
          </SectionPanel>
        ) : (
          <ReviewStep
            saved={saved}
            errors={errors}
            answerErrors={state.serverErrors}
            justCompleted={state.justCompleted}
            hasUnsavedChanges={dirtyKeys.length > 0}
            submitting={phase === "submitting"}
            onSelectStep={selectStep}
            onSubmit={() => void submit()}
          />
        )}
      </EditorLayout>
    );
  }

  return (
    <>
      {content}
      {/* Mounted in every phase, so the submission announcement survives the swap to the liftoff screen. */}
      <LiveStatus message={announcement} />
    </>
  );
}
