# Credentials Manager

A small internal app for sharing credentials for cloud environments.

- **Environments** (e.g. `toronto-dev`) hold any number of **credentials**. A credential is a free-form key and value, such as `database url` → `https://…`, with an optional description.
- **Superusers** manage everything. They create environments and credentials, create user accounts, and choose which environments each user can see.
- **Users** have read-only access to the environments they've been given. Values are masked until revealed or copied.
- Every sign-in, every reveal and copy of a value, and every change is written to an **audit log** that superusers can browse.

Stack: Next.js 16 (App Router, Server Actions), Postgres via Drizzle ORM, Tailwind and shadcn/ui. It's designed to run on Vercel and Neon at little or no cost.

## How it works

| Topic | Behaviour |
|---|---|
| Secrets at rest | Each value is encrypted with AES-256-GCM using `ENCRYPTION_KEY`. A random IV is used per value, and the credential id is bound as additional authenticated data (AAD). The database only ever holds `v1:…` ciphertext. |
| Display | Values are never included in page HTML. Reveal and Copy fetch one value through a Server Action, which checks access and writes an audit entry before returning it. A revealed value is hidden again after 30 s, or as soon as you navigate away. |
| Access | Access is granted per environment. Superusers can see everything. If a user tries an environment they don't have, they get a 404 that doesn't reveal its name. |
| Accounts | A superuser creates the account and a one-time temporary password is generated. The user must change it at first sign-in. A superuser can reset a password, which generates a new temporary password and signs the user out everywhere. |
| Removing users | Deactivation is reversible. The user is signed out, can't sign in, and keeps their grants and audit history. |
| Roles | Superusers can promote and demote other users. Nobody can change their own role or deactivate themselves, and the last active superuser can't be demoted or deactivated. |
| Sessions | Random token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie (`__Host-` prefixed in production). Only its SHA-256 hash is stored. Sessions last 8 hours, absolute. |
| Brute force | After 5 failed sign-ins for an email in 15 minutes, further attempts are refused until the window passes. |
| Bulk add | Paste a `.env` block into **Import .env**. A preview shows new keys and existing ones, and you choose whether to overwrite existing keys. |

## Local development

Requirements: Node 20.12+ and Docker (or any Postgres 14+).

```bash
npm install
docker compose up -d                 # Postgres on localhost:5433
cp .env.example .env.local           # then fill it in:
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/credentials_manager
#   ENCRYPTION_KEY=$(openssl rand -base64 32)
npm run db:migrate                   # create tables
npm run create-admin -- --email you@example.com --name "Your Name"
npm run dev                          # http://localhost:3000
```

## Deploying (Vercel + Neon)

1. **Database.** Create a Neon project (the free tier is enough). Copy the pooled connection string, whose host contains `-pooler`, and the direct one. If you add Neon through Vercel's integration, both are set for you as `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
2. **Encryption key.** Run `openssl rand -base64 32`. **Store this key in your password manager now.** If it's lost, every stored credential is unrecoverable. Keep it separate from database backups.
3. **Vercel.** Import the repo and set `DATABASE_URL` and `ENCRYPTION_KEY` (Production) in Project Settings → Environment Variables. Use separate values for Preview deployments, or don't set them there, so preview builds can't touch production data.
4. **Migrate and create the first superuser** from your machine, against the production database:

   ```bash
   DATABASE_URL_UNPOOLED='postgresql://…direct…' npm run db:migrate
   DATABASE_URL='postgresql://…pooled…' npm run create-admin -- --email you@example.com --name "Your Name"
   ```

   Migrations are run by hand on purpose, not during `next build`, so a preview deployment can never migrate production.
5. Open the deployed URL and sign in.

> **Cost note:** Vercel's free *Hobby* plan is for personal, non-commercial use only. For company use, Vercel's terms require *Pro*. Neon's free tier has no such restriction. The app has no Vercel-specific code, so it also runs on Netlify, or on any Node host with `npm run build && npm start`.

### Schema changes

Edit `src/db/schema.ts`, then run `npm run db:generate` to create a migration in `drizzle/`. Commit it and run `npm run db:migrate` against each database.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run lint` / `typecheck` / `test` | ESLint, `tsc --noEmit`, Vitest unit tests |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle Kit |
| `npm run create-admin -- --email … --name …` | Create a superuser. Prompts for the password, or reads the first line of stdin when piped. |

## Project layout

```
src/
  actions/        Server Actions: auth, environments, credentials, users, access
  app/(auth)/     /login, /change-password
  app/(app)/      / (environments), /environments/[id], /admin/users, /admin/audit
  db/             Drizzle schema and client
  lib/            crypto, .env parser, sessions and guards, audit log, queries
  proxy.ts        optimistic redirect to /login (not a security boundary)
scripts/create-admin.ts
drizzle/          SQL migrations
```

Security checks live next to the data. Every page calls a guard in `src/lib/auth/guards.ts`, and every Server Action calls `actionUser()` or `actionSuperuser()` in `src/lib/actions.ts` and validates its input with zod. Server Actions are public POST endpoints, so they never rely on the UI hiding a button.

## Operational notes

- **Rotating `ENCRYPTION_KEY`** isn't automated yet. Values carry a `v1:` version prefix so a rotation script can be added later.
- **Audit log growth:** each entry is a few hundred bytes, so Neon's free 0.5 GB holds on the order of a million entries.
- **Backups:** Neon keeps point-in-time history (24 h on the free plan). Store the encryption key separately from any database backup.
