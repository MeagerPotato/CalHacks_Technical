import type {
  HackerApplicationDraftInput,
  HackerApplicationResponses,
  JudgeApplicationDraftInput,
  JudgeApplicationResponses,
} from "@/lib/validation/application";

/** A complete, valid Hacker application. */
export const validHackerResponses = {
  fullName: "Test Hacker",
  birthdate: "2005-04-12",
  countryOfResidence: "US",
  cityOfResidence: "Berkeley",
  githubUrl: "https://github.com/test-hacker",
  bio: "Student builder who enjoys small web projects.",
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
  fullName: "Test Judge",
  birthdate: "1990-02-03",
  countryOfResidence: "CA",
  cityOfResidence: "Toronto",
  linkedinUrl: "https://www.linkedin.com/in/test-judge",
  bio: "Engineer who mentors student teams.",
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
  fullName: "Partial Hacker",
  birthdate: "2006-01-20",
  countryOfResidence: "US",
  cityOfResidence: "Berkeley",
  bio: "Student builder who is partway through this application.",
  school: "Example University",
} satisfies HackerApplicationDraftInput;

/**
 * A valid Judge draft in progress: About and Professional are complete, Judging is started, and
 * Short answers and Agreements are untouched.
 */
export const partialJudgeResponses = {
  fullName: "Partial Judge",
  birthdate: "1988-07-19",
  countryOfResidence: "US",
  cityOfResidence: "San Francisco",
  bio: "Engineer who is partway through this application.",
  company: "Example Labs",
  roleTitle: "Staff Engineer",
  yearsExperience: 9,
  expertiseAreas: ["web", "security"],
  judgingExperience: "Judged two student hackathons.",
} satisfies JudgeApplicationDraftInput;

/**
 * A Hacker draft that saves but cannot be submitted: the required `proudProject` answer and the
 * code of conduct agreement are missing. Every saved answer is valid.
 */
export const draftInvalidHackerResponses = {
  fullName: "Draft Hacker",
  birthdate: "2004-10-01",
  countryOfResidence: "US",
  cityOfResidence: "Berkeley",
  bio: "Student builder with a draft that is not ready to submit.",
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
 * of conduct agreement are missing. Every saved answer is valid.
 */
export const draftInvalidJudgeResponses = {
  fullName: "Draft Judge",
  birthdate: "1985-03-30",
  countryOfResidence: "US",
  cityOfResidence: "San Francisco",
  bio: "Engineer with a draft that is not ready to submit.",
  company: "Example Labs",
  roleTitle: "Staff Engineer",
  yearsExperience: 9,
  expertiseAreas: ["web"],
  judgingExperience: "Judged two student hackathons.",
  availability: ["sunday_morning"],
  preferredCategories: ["developer_tools"],
  evaluationApproach: "I look for a working core and honest reflection on what is unfinished.",
} satisfies JudgeApplicationDraftInput;
