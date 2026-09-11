import type {
  HackerApplicationDraftInput,
  HackerApplicationResponses,
  JudgeApplicationDraftInput,
  JudgeApplicationResponses,
} from "@/lib/validation/application";

/** A complete, valid Hacker application. */
export const validHackerResponses = {
  preferredName: "Test Hacker",
  location: "Berkeley, CA (Pacific Time)",
  bio: "Student builder who enjoys small web projects.",
  links: ["https://example.com/test-hacker"],
  school: "Example University",
  major: "Computer Science",
  graduationYear: 2027,
  experienceLevel: "intermediate",
  skills: ["web", "ai_ml"],
  previousHackathonCount: 2,
  buildGoals: "Build a tool that helps students find study partners.",
  proudProject: "I built a course planner for my student club.",
  codeOfConductAccepted: true,
} satisfies HackerApplicationResponses;

/** A complete, valid Judge application. */
export const validJudgeResponses = {
  preferredName: "Test Judge",
  location: "San Francisco, CA (Pacific Time)",
  bio: "Engineer who mentors student teams.",
  links: [],
  company: "Example Labs",
  roleTitle: "Staff Engineer",
  yearsExperience: 9,
  expertiseAreas: ["web", "security"],
  judgingExperience: "Judged two student hackathons.",
  availability: ["sunday_morning"],
  preferredCategories: ["developer_tools"],
  conflictsOfInterest: "",
  evaluationApproach: "I look for a working core and honest reflection on what is unfinished.",
  motivation: "I want to give students useful feedback.",
  codeOfConductAccepted: true,
} satisfies JudgeApplicationResponses;

/**
 * A valid Hacker draft in progress: About is complete, Education is started, and Experience,
 * Short answers, and Agreements are untouched.
 */
export const partialHackerResponses = {
  preferredName: "Partial Hacker",
  location: "Berkeley, CA (Pacific Time)",
  bio: "Student builder who is partway through this application.",
  links: ["https://example.com/partial-hacker"],
  school: "Example University",
} satisfies HackerApplicationDraftInput;

/**
 * A valid Judge draft in progress: About and Professional are complete, Judging is started, and
 * Short answers and Agreements are untouched.
 */
export const partialJudgeResponses = {
  preferredName: "Partial Judge",
  location: "San Francisco, CA (Pacific Time)",
  bio: "Engineer who is partway through this application.",
  company: "Example Labs",
  roleTitle: "Staff Engineer",
  yearsExperience: 9,
  expertiseAreas: ["web", "security"],
  judgingExperience: "Judged two student hackathons.",
} satisfies JudgeApplicationDraftInput;

/**
 * A Hacker draft that saves but cannot be submitted: the required `proudProject` answer and the
 * code of conduct agreement are missing, and the link is not http(s). Drafts accept any link text.
 */
export const draftInvalidHackerResponses = {
  preferredName: "Draft Hacker",
  location: "Berkeley, CA (Pacific Time)",
  bio: "Student builder with a draft that is not ready to submit.",
  links: ["ftp://example.com/draft-hacker"],
  school: "Example University",
  major: "Computer Science",
  graduationYear: 2027,
  experienceLevel: "beginner",
  skills: ["web"],
  previousHackathonCount: 0,
  buildGoals: "Build a tool that helps students share class notes.",
} satisfies HackerApplicationDraftInput;

/**
 * A Judge draft that saves but cannot be submitted: the required `motivation` answer and the code
 * of conduct agreement are missing, and the link is not http(s). Drafts accept any link text.
 */
export const draftInvalidJudgeResponses = {
  preferredName: "Draft Judge",
  location: "San Francisco, CA (Pacific Time)",
  bio: "Engineer with a draft that is not ready to submit.",
  links: ["ftp://example.com/draft-judge"],
  company: "Example Labs",
  roleTitle: "Staff Engineer",
  yearsExperience: 9,
  expertiseAreas: ["web"],
  judgingExperience: "Judged two student hackathons.",
  availability: ["sunday_morning"],
  preferredCategories: ["developer_tools"],
  evaluationApproach: "I look for a working core and honest reflection on what is unfinished.",
} satisfies JudgeApplicationDraftInput;
