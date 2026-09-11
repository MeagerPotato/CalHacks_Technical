import { IDENTITY_RESPONSE_KEYS } from "@/lib/domain/applicant-identity";
import {
  PUBLIC_ACCOUNT_ROLES,
  RECOMMENDATIONS,
  type AccountRole,
  type ApplicationStatus,
  type ApplicationType,
  type Recommendation,
} from "@/lib/domain/enums";
import {
  APPLICATION_LIMITS,
  EXPERIENCE_LEVELS,
  HACKER_SKILLS,
  JUDGE_AVAILABILITY_BLOCKS,
  JUDGE_EXPERTISE_AREAS,
  PROJECT_CATEGORIES,
  getApplicationSections,
  isRequiredApplicationField,
  type ApplicationFieldKey,
  type ApplicationSectionId,
} from "@/lib/validation/application";
import { RUBRIC_DIMENSIONS, RUBRIC_SCORE_RANGE, type RubricDimension } from "@/lib/validation/review";

// =============================================================================
// Shared form contract (data shape for the frontend).
//
// Structure, required flags, limits, and option values are derived from the Zod
// schemas so they cannot drift. Labels here are plain descriptive names taken from
// PROJECT_PLAN.md; the frontend owns final copy, help text, rubric anchors, and
// presentation, and may edit labels freely without touching validation.
// =============================================================================

export interface ChoiceOption<V extends string = string> {
  readonly value: V;
  readonly label: string;
}

function toOptions<const V extends string>(values: readonly V[], labels: Record<V, string>): readonly ChoiceOption<V>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

// ---------------------------------------------------------------------------
// Enum labels
// ---------------------------------------------------------------------------

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  hacker: "Hacker",
  judge: "Judge",
  organizer: "Organizer",
};

/** Roles offered at public signup (never includes organizer). */
export const PUBLIC_ACCOUNT_ROLE_OPTIONS = toOptions(PUBLIC_ACCOUNT_ROLES, {
  hacker: ACCOUNT_ROLE_LABELS.hacker,
  judge: ACCOUNT_ROLE_LABELS.judge,
});

export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  hacker: "Hacker",
  judge: "Judge",
};

/** Direct status copy required alongside any themed presentation. */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Application submitted",
  in_review: "Under review",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
};

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_yes: "Strong yes",
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

export const RECOMMENDATION_OPTIONS = toOptions(RECOMMENDATIONS, RECOMMENDATION_LABELS);

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

export const EXPERIENCE_LEVEL_OPTIONS = toOptions(EXPERIENCE_LEVELS, {
  first_project: "First project",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
});

export const HACKER_SKILL_OPTIONS = toOptions(HACKER_SKILLS, {
  web: "Web development",
  mobile: "Mobile apps",
  ai_ml: "AI / machine learning",
  data: "Data science",
  hardware: "Hardware",
  design: "Design",
  game_dev: "Game development",
  security: "Security",
  cloud: "Cloud and infrastructure",
  robotics: "Robotics",
  ar_vr: "AR / VR",
  blockchain: "Blockchain",
});

/** Also the category list for the Expertise Radar (include zero-count categories). */
export const JUDGE_EXPERTISE_OPTIONS = toOptions(JUDGE_EXPERTISE_AREAS, {
  ai_ml: "AI / machine learning",
  web: "Web",
  mobile: "Mobile",
  hardware: "Hardware",
  data: "Data",
  security: "Security",
  design_ux: "Design / UX",
  developer_tools: "Developer tools",
  health: "Health",
  climate: "Climate",
  fintech: "Fintech",
  education: "Education",
});

export const JUDGE_AVAILABILITY_OPTIONS = toOptions(JUDGE_AVAILABILITY_BLOCKS, {
  friday_evening: "Friday evening",
  saturday_morning: "Saturday morning",
  saturday_afternoon: "Saturday afternoon",
  saturday_evening: "Saturday evening",
  sunday_morning: "Sunday morning",
  sunday_afternoon: "Sunday afternoon",
});

export const PROJECT_CATEGORY_OPTIONS = toOptions(PROJECT_CATEGORIES, {
  ai_ml: "AI / machine learning",
  hardware: "Hardware",
  health: "Health",
  sustainability: "Sustainability",
  education: "Education",
  fintech: "Fintech",
  social_impact: "Social impact",
  developer_tools: "Developer tools",
  entertainment: "Entertainment",
  beginner_friendly: "Beginner-friendly",
});

// ---------------------------------------------------------------------------
// Application form structure
// ---------------------------------------------------------------------------

export type ApplicationFieldKind =
  | "short_text"
  | "long_text"
  | "whole_number"
  | "single_choice"
  | "multi_choice"
  | "link_list"
  | "agreement";

interface FieldPresentation {
  readonly label: string;
  readonly kind: ApplicationFieldKind;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly maxItems?: number;
  readonly options?: readonly ChoiceOption[];
}

export interface ApplicationFieldConfig extends FieldPresentation {
  readonly key: string;
  /** Derived from the submission schema. */
  readonly required: boolean;
  /** Withheld in blind review (see lib/domain/applicant-identity.ts). */
  readonly identifying: boolean;
}

export interface ApplicationSectionConfig {
  readonly id: ApplicationSectionId;
  readonly label: string;
  readonly fields: readonly ApplicationFieldConfig[];
}

export interface ApplicationFormConfig {
  readonly type: ApplicationType;
  readonly sections: readonly ApplicationSectionConfig[];
}

const SHARED_FIELDS = {
  preferredName: { label: "Preferred name", kind: "short_text", maxLength: APPLICATION_LIMITS.preferredName },
  location: { label: "Location / time zone", kind: "short_text", maxLength: APPLICATION_LIMITS.shortText },
  bio: { label: "Short biography", kind: "long_text", maxLength: APPLICATION_LIMITS.bio },
  links: {
    label: "Relevant links",
    kind: "link_list",
    maxItems: APPLICATION_LIMITS.links,
    maxLength: APPLICATION_LIMITS.url,
  },
  codeOfConductAccepted: { label: "Code of conduct agreement", kind: "agreement" },
} as const satisfies Record<string, FieldPresentation>;

const HACKER_FIELDS = {
  ...SHARED_FIELDS,
  school: { label: "School", kind: "short_text", maxLength: APPLICATION_LIMITS.shortText },
  major: { label: "Major / area of study", kind: "short_text", maxLength: APPLICATION_LIMITS.shortText },
  graduationYear: {
    label: "Graduation year",
    kind: "whole_number",
    min: APPLICATION_LIMITS.graduationYear.min,
    max: APPLICATION_LIMITS.graduationYear.max,
  },
  experienceLevel: { label: "Experience level", kind: "single_choice", options: EXPERIENCE_LEVEL_OPTIONS },
  skills: {
    label: "Skills or interests",
    kind: "multi_choice",
    options: HACKER_SKILL_OPTIONS,
    maxItems: APPLICATION_LIMITS.skills,
  },
  previousHackathonCount: {
    label: "Previous hackathon count",
    kind: "whole_number",
    min: APPLICATION_LIMITS.previousHackathonCount.min,
    max: APPLICATION_LIMITS.previousHackathonCount.max,
  },
  buildGoals: {
    label: "What do you hope to build or learn at Cal Hacks?",
    kind: "long_text",
    maxLength: APPLICATION_LIMITS.longAnswer,
  },
  proudProject: {
    label: "Tell us about something you made, explored, or taught yourself.",
    kind: "long_text",
    maxLength: APPLICATION_LIMITS.longAnswer,
  },
} as const satisfies Record<ApplicationFieldKey<"hacker">, FieldPresentation>;

const JUDGE_FIELDS = {
  ...SHARED_FIELDS,
  company: { label: "Company / organization", kind: "short_text", maxLength: APPLICATION_LIMITS.shortText },
  roleTitle: { label: "Role / title", kind: "short_text", maxLength: APPLICATION_LIMITS.shortText },
  yearsExperience: {
    label: "Years of relevant experience",
    kind: "whole_number",
    min: APPLICATION_LIMITS.yearsExperience.min,
    max: APPLICATION_LIMITS.yearsExperience.max,
  },
  expertiseAreas: {
    label: "Areas of expertise",
    kind: "multi_choice",
    options: JUDGE_EXPERTISE_OPTIONS,
    maxItems: APPLICATION_LIMITS.expertiseAreas,
  },
  judgingExperience: {
    label: "Prior judging or mentoring experience",
    kind: "long_text",
    maxLength: APPLICATION_LIMITS.mediumAnswer,
  },
  availability: {
    label: "Availability blocks",
    kind: "multi_choice",
    options: JUDGE_AVAILABILITY_OPTIONS,
    maxItems: APPLICATION_LIMITS.availability,
  },
  preferredCategories: {
    label: "Preferred project categories",
    kind: "multi_choice",
    options: PROJECT_CATEGORY_OPTIONS,
    maxItems: APPLICATION_LIMITS.preferredCategories,
  },
  conflictsOfInterest: {
    label: "Conflicts of interest",
    kind: "long_text",
    maxLength: APPLICATION_LIMITS.mediumAnswer,
  },
  evaluationApproach: {
    label: "How do you evaluate an ambitious project that is not fully finished?",
    kind: "long_text",
    maxLength: APPLICATION_LIMITS.longAnswer,
  },
  motivation: {
    label: "Why do you want to judge at Cal Hacks?",
    kind: "long_text",
    maxLength: APPLICATION_LIMITS.longAnswer,
  },
} as const satisfies Record<ApplicationFieldKey<"judge">, FieldPresentation>;

const SECTION_LABELS = {
  about: "About you",
  education: "Education",
  experience: "Experience",
  professional: "Professional background",
  judging: "Judging",
  short_answers: "Short answers",
  agreements: "Agreements",
} as const satisfies Record<ApplicationSectionId, string>;

function buildForm(type: ApplicationType, fields: Record<string, FieldPresentation>): ApplicationFormConfig {
  return {
    type,
    sections: getApplicationSections(type).map((section) => ({
      id: section.id as ApplicationSectionId,
      label: SECTION_LABELS[section.id as ApplicationSectionId],
      fields: section.fields.map((key) => ({
        key,
        required: isRequiredApplicationField(type, key),
        identifying: (IDENTITY_RESPONSE_KEYS[type] as readonly string[]).includes(key),
        ...fields[key],
      })),
    })),
  };
}

/** Sectioned field configuration per application type, in form order. */
export const APPLICATION_FORMS: Record<ApplicationType, ApplicationFormConfig> = {
  hacker: buildForm("hacker", HACKER_FIELDS),
  judge: buildForm("judge", JUDGE_FIELDS),
};

// ---------------------------------------------------------------------------
// Organizer rubrics
// ---------------------------------------------------------------------------

export const RUBRIC_DIMENSION_LABELS = {
  hacker: {
    motivation: "Motivation and curiosity",
    initiative: "Initiative and evidence of building/learning",
    growth: "Growth potential",
    community: "Community contribution",
  },
  judge: {
    expertise: "Relevant expertise",
    evaluation: "Evaluation and communication mindset",
    motivation: "Motivation to judge",
    availability: "Availability and fit",
  },
} as const satisfies { [T in ApplicationType]: Record<RubricDimension<T>, string> };

export interface RubricDimensionConfig {
  readonly key: string;
  readonly label: string;
  readonly minScore: number;
  readonly maxScore: number;
}

export const RUBRIC_FORMS: Record<ApplicationType, readonly RubricDimensionConfig[]> = {
  hacker: RUBRIC_DIMENSIONS.hacker.map((key) => ({
    key,
    label: RUBRIC_DIMENSION_LABELS.hacker[key],
    minScore: RUBRIC_SCORE_RANGE.min,
    maxScore: RUBRIC_SCORE_RANGE.max,
  })),
  judge: RUBRIC_DIMENSIONS.judge.map((key) => ({
    key,
    label: RUBRIC_DIMENSION_LABELS.judge[key],
    minScore: RUBRIC_SCORE_RANGE.min,
    maxScore: RUBRIC_SCORE_RANGE.max,
  })),
};
