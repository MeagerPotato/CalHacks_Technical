# Environment and deployment

## Environment variables

The application reads exactly two variables:

| Variable | Local value | Hosted value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` from `supabase status` | Dashboard → Project Settings → API Keys → publishable key |

- **Browser-safe by design.** Both values may appear in the browser. Authorization comes from the user's session and Row Level Security.
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

- Email confirmation is off.
- Minimum password length is 8, matching the Zod schema.
- Site URL is `http://localhost:3000`.
- Realtime, Storage, Edge Functions, and Analytics are disabled.
- Studio runs at http://127.0.0.1:54323.

### Local Organizer account

1. Create the account yourself with Supabase Auth, for example in Studio → Authentication → Add user, or with `supabase.auth.signUp`. Phase 1 has no signup page; once the product phase adds `/signup`, that works too. Do not start an application with this account.
2. Immediately, in Studio's SQL editor, run:

   ```sql
   select private.promote_to_organizer('you@example.org');
   ```

3. The role is read from `profiles` on every request, so an existing session sees the Organizer role without signing in again.

Only promote an account you just created. With email confirmation off, anyone can register any address, so an account that already existed for that email may belong to someone else.

## Hosted Supabase

No hosted project has been created or linked in Phase 1. When deploying:

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

   - **Authentication → Sign In / Providers → Email:** keep email signup enabled and turn off **Confirm email**. Phase 1 has no email confirmation route. If confirmation stays on, `signUp` returns `requiresEmailConfirmation: true` and the user cannot sign in until confirmed. With confirmation off, email addresses are not verified, which is why the Organizer account must be created before the URL is shared (step 4).
   - **Password minimum length:** 8.
   - **URL Configuration:**
     - Site URL: the production URL.
     - Redirect URLs: `http://localhost:3000/**`, `https://*-<vercel-team-slug>.vercel.app/**`, and the production URL.
   - **Rate Limits:** the default is 30 sign-ups plus sign-ins per 5 minutes per IP. Server Actions call Supabase Auth from Vercel's servers, so many visitors may share an IP. Raise the limit if a live demo needs it.

4. **Create the Organizer account.** Create the user in **Authentication → Users** with auto-confirm. Once the product phase ships a signup page, you can instead sign up through the deployed app without starting an application. Then immediately run in the SQL editor:

   ```sql
   select private.promote_to_organizer('organizer@your-domain.example');
   ```

   If Supabase reports that the address is already registered, do not promote that account: someone else may have created it. Delete it or use a different address.

   Keep the credentials in a password manager. Never commit them.

5. **Check Advisors.** **Advisors → Security** should report no issues for the Launchpad tables and functions.

## Vercel

1. **Import the repository.** Vercel detects Next.js automatically, so no `vercel.json` is needed.
2. **Add the variables.** Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for **Production** and **Preview** (and **Development** if you use `vercel env pull`). Redeploy after any change.
3. **Node.js version.** Vercel takes it from `engines` (`>=22.12.0`), which currently resolves to Node.js 24.
4. **Function region.** Set it close to the Supabase region under **Settings → Functions**. `proxy.ts` runs on the Node.js runtime and is deployed as Routing Middleware in every region.
5. **Deployment Protection.** Preview deployments may require Vercel login. Run signed-out and incognito checks against the production URL.
6. **Check for leaked secrets.** After a build, this should find nothing:

   ```bash
   grep -rE "sb_secret_[A-Za-z0-9]" .next/static
   ```
