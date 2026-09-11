# Environment and deployment

## Deployment decisions

Recorded on 2026-09-11:

- **Event schedule:** the Cal Hacks 13.0 regular round, set in `EVENT_SCHEDULE` in `lib/event.ts` (updated on 2026-09-11):
  - Applications are open now.
  - The deadline is 11:59 PM Pacific on September 20, 2026 (`APPLICATION_DEADLINE`).
  - Results are released September 25, 2026.
  - The event runs October 23 to 25, 2026.

  The landing page timeline and the countdowns on the landing page and the portal show these dates. Nothing enforces the deadline: applicants can still save and submit after it passes.
- **Confirm email:** on in the hosted Supabase project. Applicants receive confirmation emails only after custom SMTP is configured (see [Hosted Supabase](#hosted-supabase), step 3).
- **Origin for confirmation links:** `SITE_URL` stays unset, so links use Vercel's production URL (`VERCEL_PROJECT_PRODUCTION_URL`).

## Environment variables

The application reads two required variables and one optional one:

| Variable | Local value | Hosted value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` from `supabase status` | Dashboard → Project Settings → API Keys → publishable key |
| `SITE_URL` (optional, server-only) | Leave unset; `http://localhost:3000` is used | Leave unset on Vercel (this deployment's decision). Set the public origin only when the app is served from a domain Vercel does not report as production. |

- **Confirmation-link origin.** `signUp` sends Supabase an `emailRedirectTo` of `<origin>/auth/callback`. `getSiteUrl()` in `lib/env.ts` chooses the origin in this order:
  1. `SITE_URL`, which must be an `http://` or `https://` URL (any path is ignored);
  2. `VERCEL_PROJECT_PRODUCTION_URL` on Vercel Production;
  3. `VERCEL_URL` on Vercel Preview;
  4. `http://localhost:3000` outside production builds.

  A production build with none of these sends no redirect, and Supabase uses its own Site URL. The request `Host` header is never used. An invalid value makes `signUp` return `unexpected_error` instead of emailing a broken link. Vercel sets the `VERCEL_*` variables itself.
- **Browser-safe by design.** Both `NEXT_PUBLIC_` values may appear in the browser. Authorization comes from the user's session and Row Level Security.
- **Fixed at build time.** Next.js inlines `NEXT_PUBLIC_` values during `next build`, so after changing them on Vercel you must redeploy.
- **Validated before use.** `lib/env.ts` checks that both values are present before creating a Supabase client. It also rejects a key that looks like a secret key (`sb_secret_…`) or a legacy JWT with `role: service_role`.
- **No privileged key.** The app never uses a service-role or secret key, and none should be added.
  - The Supabase Vercel integration also injects server secrets such as `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, and `POSTGRES_*`. App code must not read them.
  - Adding the two variables manually is the simplest way to keep secrets out of the project.
- **Missing values.** `proxy.ts` skips session refresh when the variables are missing, so the placeholder page still builds and runs. Server Component reads and the `signUp`, `signIn`, and `signOut` actions throw a clear configuration error; the other actions return `unexpected_error`.

The integration tests read the API URL, publishable key, and database URL from `supabase status`. `TEST_SUPABASE_PUBLISHABLE_KEY` and `TEST_DATABASE_URL` can each override the matching status value. Setting `TEST_SUPABASE_URL` skips `supabase status` entirely, so the other two variables must then be set as well. The API and database hosts must be `127.0.0.1`, `localhost`, or `::1`.

## Local development

Prerequisites: Node.js 22.12 or newer (24 LTS recommended; see `engines` in `package.json`) and Docker Desktop.

1. Install dependencies and start Supabase. The first start pulls images and applies the migrations and seed.

   ```bash
   npm install
   npm run db:start
   ```

2. Create `.env.local` with the two `NEXT_PUBLIC_` lines printed by:

   ```bash
   npx supabase status -o env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL,auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

   The command also prints secret keys for the local stack. Do not copy those into `.env.local`.

3. Start the app at http://localhost:3000:

   ```bash
   npm run dev
   ```

Other database commands:

| Command | Effect |
|---|---|
| `npm run db:reset` | Recreates the local database, re-applies migrations and seed, and deletes all local auth users. |
| `npm run db:types` | Regenerates `types/database.ts` from the local schema. Commit the result. |
| `npm run db:advisors` | Runs Supabase's security and performance advisors against the local database. |
| `npm run db:stop` | Stops the local stack. |

Local Auth settings in `supabase/config.toml`:

- Email confirmation is off, so local signups are signed in immediately. `/auth/callback` still handles confirmation links if you turn it on.
- Minimum password length is 8, matching the Zod schema.
- Site URL is `http://localhost:3000`. The redirect allow list also includes `/auth/callback` on port 3000 (`next dev`) and port 3100 (the E2E server).
- Sign-ups plus sign-ins are limited to 300 per 5 minutes per IP (the hosted default is 30), so the integration and E2E suites can create many accounts.
- Realtime, Storage, Edge Functions, and Analytics are disabled.
- Studio runs at http://127.0.0.1:54323.

After changing `supabase/config.toml`, restart the stack with `npm run db:stop` and then `npm run db:start`. Local data is kept.

### Local Organizer account

1. Create the account yourself. Sign up at http://localhost:3000/signup and stop at onboarding without starting an application, or use Studio → Authentication → Add user.
2. Immediately, in Studio's SQL editor, run:

   ```sql
   select private.promote_to_organizer('you@example.org');
   ```

3. The role is read from `profiles` on every request, so an existing session sees the Organizer role without signing in again.

Only promote an account you just created. With email confirmation off, anyone can register any address, so an account that already existed for that email may belong to someone else.

## Hosted Supabase

The repository does not create or link a hosted project. When deploying:

1. **Create a project.** Use Postgres 17 to match `major_version` in `supabase/config.toml`.

2. **Apply migrations:**

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push --dry-run
   npx supabase db push
   ```

   To load demo data, use `npx supabase db push --include-seed`. The seed file is recorded by hash and runs once. Seed users cannot sign in.

3. **Configure Auth in the dashboard.** `supabase/config.toml` holds local values, so do not run `supabase config push` without reviewing `supabase config diff` first. Set:

   - **Authentication → Sign In / Providers → Email:** keep email signup enabled and **Confirm email** on (the hosted default, and this deployment's decision). `signUp` returns `requiresEmailConfirmation: true`, the signup page asks the applicant to check their email, and the link completes at `/auth/callback` in the same browser.
   - **Custom SMTP (Authentication → Emails → SMTP Settings):** configure it before sharing the link, with a provider such as Resend, Postmark, or Amazon SES. Without it, Supabase's built-in sender delivers only to members of the project's organization (other addresses fail with "Email address not authorized") and sends only a few emails per hour, so applicants could not confirm their accounts. Once custom SMTP is on, Supabase starts at 30 emails per hour; raise the email limit under **Authentication → Rate Limits** to cover the expected signups.
   - **Fallback if SMTP cannot be ready in time:** turn **Confirm email** off. Applicants are then signed in immediately, but email addresses are not verified, so create the Organizer account before the URL is shared (step 4).
   - **Password minimum length:** 8.
   - **URL Configuration:**
     - Site URL: the Vercel production URL, such as `https://<project>.vercel.app`, or the production custom domain if one is assigned.
     - Redirect URLs: `https://<production-domain>/auth/callback`. Add `http://localhost:3000/**` to test locally against the hosted project, and `https://*-<vercel-team-slug>.vercel.app/**` only to test signup on Preview deployments. Supabase refuses a confirmation redirect that is not on this list.
     - If you add a custom domain later, Vercel's production URL becomes that domain, so update the Site URL and the redirect list to match.
   - **Rate Limits:** the default is 30 sign-ups plus sign-ins per 5 minutes per IP. Server Actions call Supabase Auth from Vercel's servers, so many visitors may share an IP. Raise the limit if a live demo needs it.

4. **Create the Organizer account.** Create the user in **Authentication → Users** with auto-confirm. You can instead sign up through the deployed app and stop at onboarding without starting an application. Then immediately run in the SQL editor:

   ```sql
   select private.promote_to_organizer('organizer@your-domain.example');
   ```

   If Supabase reports that the address is already registered, do not promote that account: someone else may have created it. Delete it or use a different address.

   Keep the credentials in a password manager. Never commit them.

5. **Check Advisors.** **Advisors → Security** should report no issues for the app tables and functions.

## Vercel

1. **Import the repository.** Vercel detects Next.js automatically, so no `vercel.json` is needed.
2. **Add the variables.** Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for **Production** and **Preview** (and **Development** if you use `vercel env pull`). Leave `SITE_URL` unset. Redeploy after any change.
3. **Node.js version.** Vercel takes it from `engines` (`>=22.12.0`), which currently resolves to Node.js 24.
4. **Function region.** Set it close to the Supabase region under **Settings → Functions**. `proxy.ts` runs on the Node.js runtime and is deployed as Routing Middleware in every region.
5. **Deployment Protection.** Preview deployments may require Vercel login. Run signed-out and incognito checks, including a full signup with a real inbox, against the production URL.
6. **Check for leaked secrets.** After a build, this should find nothing:

   ```bash
   grep -rE "sb_secret_[A-Za-z0-9]" .next/static
   ```
