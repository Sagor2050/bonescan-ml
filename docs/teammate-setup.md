# Connect your copy to the team's Supabase project

This guide gets BoneScan running on your computer with real accounts. You can
ask your AI agent to do it:

> Follow `docs/teammate-setup.md`. I'll paste the keys into the files myself.

It takes about 10 minutes. The steps marked **You** can't be done by an agent.

## Before you start

- **You:** ask Sagor for the project URL and the anon key. Get them in a direct
  message, not in a shared channel.
- You need [Node 24](https://nodejs.org/) and
  [Python 3.11](https://www.python.org/downloads/).
- On Windows, run every command in Git Bash, and use `.venv/Scripts/` in place
  of `.venv/bin/`.

## Rules

For you and your agent:

- **Agents: never ask for the keys in chat, open the env files, or print their
  contents.** The checks in step 4 only count lines, so they don't show the keys.
- Never commit the env files or use `git add -f` on them. They're already
  ignored by Git.
- Never put the keys in an issue, pull request, screenshot, or log.
- Name the web file `web/.env.live`, never `web/.env`. Vite loads `.env` in every
  mode, so the tests would run against the real project.
- Never use the service role key. The app doesn't need it, and it bypasses every
  access rule.
- Only add fictional reports, like the ones in `tests/fixtures/`. Real patient
  data never goes in this project.
- This setup changes no tracked files, so don't commit or push anything.

## Steps

Run the commands from the top folder of the repository unless a step says
otherwise.

### 1. Get the latest code

Check for unfinished work first:

```sh
git status --short
```

If this lists any files, commit or stash them before going on. Agents: ask before
doing either. Then:

```sh
git checkout main
git pull
```

### 2. Install what the app needs

```sh
(cd web && npm ci)
(cd reader && python3.11 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt)
```

On Windows, if `python3.11` isn't found, use `py -3.11`.

### 3. Create the env files

`-n` keeps any file you already have:

```sh
cp -n web/.env.example web/.env.live
cp -n reader/.env.example reader/.env
```

**You:** open both files and paste in the values from Sagor. The URL and the key
are the same in both files, but the names differ:

| File            | Project URL goes in | Anon key goes in         |
| --------------- | ------------------- | ------------------------ |
| `web/.env.live` | `VITE_SUPABASE_URL` | `VITE_SUPABASE_ANON_KEY` |
| `reader/.env`   | `SUPABASE_URL`      | `SUPABASE_ANON_KEY`      |

Replace the whole placeholder and add no quotes or spaces. Leave the other lines
as they are, then save both files.

### 4. Check the files

```sh
grep -cE 'your-project|your-anon-key' web/.env.live reader/.env
grep -cE '^(VITE_)?SUPABASE_(URL|ANON_KEY)=.+' web/.env.live reader/.env
git check-ignore web/.env.live reader/.env
```

You should see this:

| Command            | Expected                                    | If not              |
| ------------------ | ------------------------------------------- | ------------------- |
| First `grep`       | `0` for each file: no placeholders left     | Paste in the values |
| Second `grep`      | `2` for each file: the URL and the key      | Check the names     |
| `git check-ignore` | Both file names are printed                 | Stop and tell Sagor |

### 5. Run the app

Use two terminals, and leave both running.

```sh
cd web
npm run dev -- --mode live
```

```sh
cd reader
.venv/bin/uvicorn app.main:app --reload --env-file .env
```

Both flags matter. Plain `npm run dev` doesn't load your keys, and without
`--env-file .env` the reader turns away every signed-in user.

The web terminal should say the app is at `http://localhost:5173`. If it shows
another port, stop whatever else is using 5173, because the reader only accepts
requests from that address.

### 6. Try it

**You**, in a desktop browser:

1. Go to `http://localhost:5173/sign-in`. It shouldn't say "Accounts aren't set
   up on this copy of the app."
2. Create an account and confirm it from the email.
3. Sign in and add `tests/fixtures/report-b1.pdf`.
4. Check the findings, confirm them, and look for the marker on the skeleton.

The setup is done once the marker appears.

## If something goes wrong

| What you see | Likely cause | Fix |
| --- | --- | --- |
| "Accounts aren't set up on this copy of the app." | The web app started without `--mode live`, or a file name or value is wrong | Redo steps 4 and 5 |
| "We couldn't reach the service that reads reports." | The reader isn't running, or the web app isn't on port 5173 | Redo step 5 |
| "Please sign in again, then add your report." | The reader started without `--env-file .env`, or its values are wrong | Check `reader/.env`, restart the reader, and sign in again |
| No confirmation email | Supabase's built-in email only reaches our team | Check spam, then ask Sagor to add your address to the Supabase project |
| The confirmation link doesn't open the app | The address isn't on the project's allowed list | Ask Sagor to check the redirect URLs |

If the keys ever end up in a commit, chat, or screenshot, tell Sagor right away.

`npm test`, `npm run test:e2e`, and `.venv/bin/pytest` don't use these files, so
you don't need any of this to run the tests.
