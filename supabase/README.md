# Supabase setup

Accounts, the database, and file storage (Plan B.1). The tables and access rules
are in [`migrations/`](migrations/). Run these steps once per Supabase project.

## Set up a project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run each file in `migrations/`, in order.
3. Under **Authentication > Sign In / Providers > Email**, keep email and password
   on, and turn on **Confirm email**. Turn off every other provider, because the
   app asks for nothing but an email address and password (NFR8).
4. Under **Authentication > Emails > SMTP Settings**, add a free SMTP sender such
   as Resend. Supabase's built-in email only reaches our team, so sign-up fails
   for everyone else without this.
5. Under **Authentication > URL Configuration**, set the Site URL to the deployed
   web app. Add these to the redirect URLs, for the deployed app and for
   `http://localhost:5173`: `/reports` (after confirming an email) and
   `/reset-password` (after asking for a new password).
6. Copy `web/.env.example` to `web/.env` and `reader/.env.example` to
   `reader/.env`, and fill in the project URL and anon key. Never commit the real
   values, and never put the service role key in either file.

## Test the access rules

```sh
supabase/tests/run.sh
```

This needs Postgres installed. It runs the migration on a throwaway local database
with stand-ins for Supabase's auth and storage, then tries everything account B
must not be able to do to account A's reports, findings, and files. It doesn't
touch a real project.

Run the same cross-account test through the app on the real project too (Plan,
Milestone 4), because the stand-ins can't prove how Supabase's own API behaves.

## Rules to keep

- A report's text, source, and file are never edited (NFR4). Patients can only
  change its exam date.
- A finding's `wording` is never edited. Patients can correct everything else, and
  a corrected finding is marked `entered_by_patient`.
- Every new table turns on row-level security and gets a test in
  `tests/access.sql`.
