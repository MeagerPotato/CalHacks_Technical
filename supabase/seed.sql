-- =============================================================================
-- CalHacks Mission Control demo seed data
--
-- Loaded by `supabase db reset` after migrations, executed as postgres.
-- Every account created here has an EMPTY password and cannot sign in.
-- Create the organizer login and any demo applicant logins privately
-- (see docs/infrastructure/environment-and-deployment.md). Never commit credentials.
--
-- Contents: 13 applications (7 Hacker, 6 Judge) across every status, 3 completed
-- reviews written by a non-loginable seed organizer, and varied Judge expertise tags
-- (mobile and climate intentionally have no judges, to show coverage gaps).
-- All names, schools, companies, and answers are fictional.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Auth users (profiles are created by the on_auth_user_created trigger)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  seed.id::uuid,
  'authenticated',
  'authenticated',
  seed.email,
  '',
  now() - seed.age,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('account_role', seed.account_role, 'display_name', seed.display_name),
  now() - seed.age,
  now() - seed.age,
  '',
  '',
  '',
  ''
from (
  values
    ('a0000000-0000-4000-8000-000000000001', 'maya.chen@example.com', 'hacker', 'Maya Chen', interval '9 days'),
    ('a0000000-0000-4000-8000-000000000002', 'jordan.alvarez@example.com', 'hacker', 'Jordan Alvarez', interval '5 days'),
    ('a0000000-0000-4000-8000-000000000003', 'priya.natarajan@example.com', 'hacker', 'Priya Natarajan', interval '8 days'),
    ('a0000000-0000-4000-8000-000000000004', 'samuel.okafor@example.com', 'hacker', 'Samuel Okafor', interval '7 days'),
    ('a0000000-0000-4000-8000-000000000005', 'lena.fischer@example.com', 'hacker', 'Lena Fischer', interval '4 days'),
    ('a0000000-0000-4000-8000-000000000006', 'diego.ramirez@example.com', 'hacker', 'Diego Ramirez', interval '10 days'),
    ('a0000000-0000-4000-8000-000000000007', 'aisha.rahman@example.com', 'hacker', 'Aisha Rahman', interval '12 days'),
    ('a0000000-0000-4000-8000-000000000008', 'evelyn.park@example.com', 'judge', 'Evelyn Park', interval '6 days'),
    ('a0000000-0000-4000-8000-000000000009', 'marcus.bell@example.com', 'judge', 'Marcus Bell', interval '9 days'),
    ('a0000000-0000-4000-8000-000000000010', 'sofia.rossi@example.com', 'judge', 'Sofia Rossi', interval '8 days'),
    ('a0000000-0000-4000-8000-000000000011', 'kenji.watanabe@example.com', 'judge', 'Kenji Watanabe', interval '6 days'),
    ('a0000000-0000-4000-8000-000000000012', 'hannah.lee@example.com', 'judge', 'Hannah Lee', interval '11 days'),
    ('a0000000-0000-4000-8000-000000000013', 'omar.haddad@example.com', 'judge', 'Omar Haddad', interval '3 days'),
    ('a0000000-0000-4000-8000-000000000099', 'seed.reviewer@example.com', 'hacker', 'Seed Reviewer', interval '14 days')
) as seed (id, email, account_role, display_name, age);

-- The seed reviewer authors the demo reviews. It has no password and cannot sign in.
select private.promote_to_organizer('seed.reviewer@example.com');

-- ---------------------------------------------------------------------------
-- Applications
-- Draft completion_percent values match lib/validation completion rules
-- (verified by tests/integration/schema-drift.test.ts).
-- ---------------------------------------------------------------------------

insert into public.applications (
  id,
  user_id,
  application_type,
  responses,
  completion_percent,
  status,
  launched_at,
  review_started_at,
  decision_released_at,
  created_at,
  updated_at
)
values
  -- Hacker: partially completed draft (8 of 12 required answers)
  (
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'hacker',
    '{
      "preferredName": "Maya Chen",
      "location": "Oakland, CA (Pacific Time)",
      "bio": "Second-year student who likes building small tools for student clubs.",
      "links": [],
      "school": "Bayview State University",
      "major": "Computer Science",
      "graduationYear": 2028,
      "experienceLevel": "beginner",
      "skills": ["web", "design"]
    }'::jsonb,
    67,
    'draft',
    null, null, null,
    now() - interval '9 days',
    now() - interval '2 days'
  ),
  -- Hacker: early draft (3 of 12 required answers)
  (
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    'hacker',
    '{
      "preferredName": "Jordan Alvarez",
      "location": "Sacramento, CA (Pacific Time)",
      "bio": "Community college student getting into hardware projects."
    }'::jsonb,
    25,
    'draft',
    null, null, null,
    now() - interval '5 days',
    now() - interval '5 days'
  ),
  -- Hacker: submitted, awaiting review
  (
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000003',
    'hacker',
    '{
      "preferredName": "Priya Natarajan",
      "location": "San Jose, CA (Pacific Time)",
      "bio": "Data science student who volunteers as a peer tutor.",
      "links": ["https://example.com/priya"],
      "school": "Golden Hills University",
      "major": "Data Science",
      "graduationYear": 2027,
      "experienceLevel": "intermediate",
      "skills": ["data", "ai_ml", "web"],
      "previousHackathonCount": 3,
      "buildGoals": "I want to build a tool that helps students find open study rooms and learn more about deploying machine learning models.",
      "proudProject": "I built a spreadsheet-to-dashboard script for my tutoring center that now tracks weekly attendance.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'submitted',
    now() - interval '3 days', null, null,
    now() - interval '8 days',
    now() - interval '3 days'
  ),
  -- Hacker: submitted, awaiting review
  (
    'b0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000004',
    'hacker',
    '{
      "preferredName": "Samuel Okafor",
      "location": "Los Angeles, CA (Pacific Time)",
      "bio": "Mechanical engineering student who enjoys robotics clubs.",
      "links": [],
      "school": "Redwood Technical Institute",
      "major": "Mechanical Engineering",
      "graduationYear": 2026,
      "experienceLevel": "advanced",
      "skills": ["hardware", "robotics"],
      "previousHackathonCount": 6,
      "buildGoals": "I hope to prototype an assistive device with a team and practice writing firmware.",
      "proudProject": "I taught myself CAD and designed a 3D-printed gripper for our robotics team.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'submitted',
    now() - interval '2 days', null, null,
    now() - interval '7 days',
    now() - interval '2 days'
  ),
  -- Hacker: submitted, awaiting review
  (
    'b0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000005',
    'hacker',
    '{
      "preferredName": "Lena Fischer",
      "location": "Portland, OR (Pacific Time)",
      "bio": "First-year student exploring mobile development.",
      "links": [],
      "school": "Lakeside University",
      "major": "Undeclared",
      "graduationYear": 2029,
      "experienceLevel": "first_project",
      "skills": ["mobile", "design"],
      "previousHackathonCount": 0,
      "buildGoals": "I want to ship my first app and learn how teams split up work during a hackathon.",
      "proudProject": "I followed an online course and made a simple habit tracker for my phone.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'submitted',
    now() - interval '1 day', null, null,
    now() - interval '4 days',
    now() - interval '1 day'
  ),
  -- Hacker: in review with a completed review, ready for a decision
  (
    'b0000000-0000-4000-8000-000000000006',
    'a0000000-0000-4000-8000-000000000006',
    'hacker',
    '{
      "preferredName": "Diego Ramirez",
      "location": "Fresno, CA (Pacific Time)",
      "bio": "Computer engineering student and teaching assistant for an intro programming course.",
      "links": ["https://example.com/diego"],
      "school": "Mission Valley College",
      "major": "Computer Engineering",
      "graduationYear": 2027,
      "experienceLevel": "intermediate",
      "skills": ["web", "cloud", "security"],
      "previousHackathonCount": 2,
      "buildGoals": "I want to learn how to secure a small web service end to end while building something useful for local farmworkers.",
      "proudProject": "I ran weekend workshops teaching classmates how to use Git and deploy their first websites.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'in_review',
    now() - interval '4 days', now() - interval '1 day', null,
    now() - interval '10 days',
    now() - interval '1 day'
  ),
  -- Hacker: accepted
  (
    'b0000000-0000-4000-8000-000000000007',
    'a0000000-0000-4000-8000-000000000007',
    'hacker',
    '{
      "preferredName": "Aisha Rahman",
      "location": "Berkeley, CA (Pacific Time)",
      "bio": "Bioengineering student interested in health technology.",
      "links": ["https://example.com/aisha"],
      "school": "Bayview State University",
      "major": "Bioengineering",
      "graduationYear": 2026,
      "experienceLevel": "advanced",
      "skills": ["ai_ml", "hardware", "data"],
      "previousHackathonCount": 5,
      "buildGoals": "I hope to build a low-cost sensor that helps clinics monitor medication storage temperatures.",
      "proudProject": "I led a student team that built an open-source calibration rig for pulse oximeters.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'accepted',
    now() - interval '6 days', now() - interval '3 days', now() - interval '2 days',
    now() - interval '12 days',
    now() - interval '2 days'
  ),
  -- Judge: partially completed draft (6 of 12 required answers)
  (
    'b0000000-0000-4000-8000-000000000008',
    'a0000000-0000-4000-8000-000000000008',
    'judge',
    '{
      "preferredName": "Evelyn Park",
      "location": "Seattle, WA (Pacific Time)",
      "bio": "Engineering manager who mentors early-career developers.",
      "links": [],
      "company": "Cobalt Analytics",
      "roleTitle": "Engineering Manager",
      "yearsExperience": 12,
      "expertiseAreas": ["data", "web"]
    }'::jsonb,
    50,
    'draft',
    null, null, null,
    now() - interval '6 days',
    now() - interval '1 day'
  ),
  -- Judge: submitted, awaiting review
  (
    'b0000000-0000-4000-8000-000000000009',
    'a0000000-0000-4000-8000-000000000009',
    'judge',
    '{
      "preferredName": "Marcus Bell",
      "location": "San Francisco, CA (Pacific Time)",
      "bio": "Machine learning engineer focused on developer tooling.",
      "links": ["https://example.com/marcus"],
      "company": "Tidewater Labs",
      "roleTitle": "Senior ML Engineer",
      "yearsExperience": 8,
      "expertiseAreas": ["ai_ml", "developer_tools"],
      "judgingExperience": "Judged two university hackathons and mentored at a regional coding bootcamp.",
      "availability": ["saturday_afternoon", "sunday_morning"],
      "preferredCategories": ["ai_ml", "developer_tools"],
      "conflictsOfInterest": "",
      "evaluationApproach": "I look for a clear problem, a working core, and evidence the team understands what is left to build.",
      "motivation": "Hackathons helped me start my career and I want to give students thoughtful feedback.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'submitted',
    now() - interval '4 days', null, null,
    now() - interval '9 days',
    now() - interval '4 days'
  ),
  -- Judge: submitted, awaiting review
  (
    'b0000000-0000-4000-8000-000000000010',
    'a0000000-0000-4000-8000-000000000010',
    'judge',
    '{
      "preferredName": "Sofia Rossi",
      "location": "Austin, TX (Central Time)",
      "bio": "Product designer who teaches evening UX classes.",
      "links": [],
      "company": "Parcel and Pine Studio",
      "roleTitle": "Principal Product Designer",
      "yearsExperience": 10,
      "expertiseAreas": ["design_ux", "education"],
      "judgingExperience": "Mentored design teams at three student hackathons.",
      "availability": ["sunday_morning", "sunday_afternoon"],
      "preferredCategories": ["education", "social_impact", "beginner_friendly"],
      "evaluationApproach": "I focus on whether the experience solves a real need and how the team tested their assumptions.",
      "motivation": "I enjoy helping first-time builders see how design decisions shape their projects.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'submitted',
    now() - interval '3 days', null, null,
    now() - interval '8 days',
    now() - interval '3 days'
  ),
  -- Judge: submitted, awaiting review
  (
    'b0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000011',
    'judge',
    '{
      "preferredName": "Kenji Watanabe",
      "location": "San Diego, CA (Pacific Time)",
      "bio": "Embedded systems engineer working on connected devices.",
      "links": ["https://example.com/kenji"],
      "company": "Brightline Robotics",
      "roleTitle": "Staff Firmware Engineer",
      "yearsExperience": 15,
      "expertiseAreas": ["hardware", "security"],
      "judgingExperience": "Judged hardware tracks at two community maker events.",
      "availability": ["saturday_evening", "sunday_afternoon"],
      "preferredCategories": ["hardware", "sustainability"],
      "conflictsOfInterest": "Advises the robotics club at Redwood Technical Institute.",
      "evaluationApproach": "I ask teams to demo the riskiest part first and explain the tradeoffs they made under time pressure.",
      "motivation": "I want to encourage more students to try hardware projects.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'submitted',
    now() - interval '2 days', null, null,
    now() - interval '6 days',
    now() - interval '2 days'
  ),
  -- Judge: waitlisted
  (
    'b0000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000012',
    'judge',
    '{
      "preferredName": "Hannah Lee",
      "location": "New York, NY (Eastern Time)",
      "bio": "Full-stack developer at a payments startup.",
      "links": [],
      "company": "Signal Harbor",
      "roleTitle": "Software Engineer",
      "yearsExperience": 3,
      "expertiseAreas": ["web", "fintech"],
      "judgingExperience": "No formal judging yet; I have reviewed pull requests for an open-source project.",
      "availability": ["sunday_afternoon"],
      "preferredCategories": ["fintech", "developer_tools"],
      "evaluationApproach": "I would compare what the team planned against what they finished and reward clear explanations.",
      "motivation": "I want to learn how experienced judges evaluate projects and support new builders.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'waitlisted',
    now() - interval '5 days', now() - interval '2 days', now() - interval '1 day',
    now() - interval '11 days',
    now() - interval '1 day'
  ),
  -- Judge: submitted, awaiting review
  (
    'b0000000-0000-4000-8000-000000000013',
    'a0000000-0000-4000-8000-000000000013',
    'judge',
    '{
      "preferredName": "Omar Haddad",
      "location": "Chicago, IL (Central Time)",
      "bio": "Health data analyst and volunteer mentor.",
      "links": [],
      "company": "",
      "roleTitle": "Senior Data Analyst",
      "yearsExperience": 6,
      "expertiseAreas": ["health", "data", "ai_ml"],
      "judgingExperience": "Mentored teams at a healthcare datathon.",
      "availability": ["friday_evening", "saturday_morning"],
      "preferredCategories": ["health", "ai_ml"],
      "evaluationApproach": "I look at whether the team handled data responsibly and can explain their results honestly.",
      "motivation": "I want to help students build health tools that respect patient privacy.",
      "codeOfConductAccepted": true
    }'::jsonb,
    100,
    'submitted',
    now() - interval '1 day', null, null,
    now() - interval '3 days',
    now() - interval '1 day'
  );

-- ---------------------------------------------------------------------------
-- Completed reviews (overall_score is computed by the reviews guard trigger)
-- ---------------------------------------------------------------------------

insert into public.reviews (
  id,
  application_id,
  reviewer_id,
  rubric_scores,
  notes,
  recommendation,
  completed_at,
  created_at,
  updated_at
)
values
  (
    'c0000000-0000-4000-8000-000000000006',
    'b0000000-0000-4000-8000-000000000006',
    'a0000000-0000-4000-8000-000000000099',
    '{"motivation": 4, "initiative": 5, "growth": 4, "community": 3}'::jsonb,
    'Clear teaching record and a realistic project goal.',
    'yes',
    now() - interval '20 hours',
    now() - interval '1 day',
    now() - interval '20 hours'
  ),
  (
    'c0000000-0000-4000-8000-000000000007',
    'b0000000-0000-4000-8000-000000000007',
    'a0000000-0000-4000-8000-000000000099',
    '{"motivation": 5, "initiative": 5, "growth": 4, "community": 5}'::jsonb,
    'Led a team project with strong community impact.',
    'strong_yes',
    now() - interval '68 hours',
    now() - interval '3 days',
    now() - interval '68 hours'
  ),
  (
    'c0000000-0000-4000-8000-000000000012',
    'b0000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000099',
    '{"expertise": 3, "evaluation": 3, "motivation": 4, "availability": 2}'::jsonb,
    'Enthusiastic but limited availability on judging day.',
    'maybe',
    now() - interval '46 hours',
    now() - interval '2 days',
    now() - interval '46 hours'
  );
