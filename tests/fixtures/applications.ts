import type { HackerApplicationResponses, JudgeApplicationResponses } from "@/lib/validation/application";

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
