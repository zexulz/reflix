# Deploying Reflix to Vercel + Supabase

This guide walks you through running Reflix on Vercel (hosting) with Supabase
(database + image storage). No prior Supabase experience needed — every step
is spelled out.

---

## Why two services?

- **Vercel** hosts the Next.js app (the website itself). It's serverless, so it
  has no permanent filesystem and no built-in database.
- **Supabase** provides the database (Postgres) and a place to store image
  files uploaded via the admin dashboard (Storage). Both have generous free
  tiers that cover Reflix easily.

The 500+ TMDB movie images are committed to the repo in `/public/images/`, so
Vercel serves those directly as static files — no Supabase needed for them.

---

## Step 1 — Create a Supabase project

1. Go to **supabase.com** → Sign up (free, GitHub or email).
2. Click **New project**.
3. Pick a name (e.g. `reflix`), generate a strong database password, choose a
   region close to your users, and click **Create new project**. Wait ~2 min
   for it to provision.

## Step 2 — Get your database connection string

1. In your Supabase dashboard, go to **Project Settings** (gear icon, bottom-left) → **Database**.
2. Scroll to **Connection string** and copy the **URI** one (it looks like):
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   This is your `DATABASE_URL`. Keep it — you'll paste it into Vercel and your
   local `.env`.

## Step 3 — Get your API keys + storage URL

1. Still in **Project Settings** → **API**.
2. Copy the **Project URL** (e.g. `https://abcdxyz.supabase.co`) — this is
   `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the **`service_role` secret** — this is `SUPABASE_SERVICE_ROLE_KEY`.
   ⚠️ This key can write to your database, so **never** put it in client-side
   code or commit it to git. It only lives in `.env` / Vercel env vars.

## Step 4 — Create a Storage bucket for image uploads

1. In the Supabase dashboard, click **Storage** (left sidebar) → **New bucket**.
2. Name it `reflix`, set it to **Public** (so movie posters can be loaded by
   browsers), and click **Create bucket**.
3. That's it — the bucket name `reflix` is your `SUPABASE_STORAGE_BUCKET`.

## Step 5 — Push the repo to GitHub

1. Create a new repo on GitHub (empty, no README).
2. From the project folder:
   ```bash
   git init
   git add .
   git commit -m "Reflix — IMDb Top 250 streaming app"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/reflix.git
   git push -u origin main
   ```

`.env`, the local SQLite database, and `/public/uploads/` are all in
`.gitignore`, so they won't be pushed. The 500+ TMDB images in
`/public/images/` **will** be pushed — that's intentional, so Vercel serves
them as static files.

## Step 6 — Import to Vercel

1. Go to **vercel.com** → Sign up / log in with GitHub.
2. **Add New… → Project** → find your `reflix` repo → **Import**.
3. Vercel auto-detects Next.js. Don't change the build settings — the
   `postinstall: prisma generate` script in `package.json` handles the Prisma
   Client generation automatically.
4. **Before clicking Deploy**, expand **Environment Variables** and add these
   five:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Supabase connection string (Step 2) |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL (Step 3) |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role secret (Step 3) |
   | `SUPABASE_STORAGE_BUCKET` | `reflix` |
   | `AUTH_SECRET` | a random 32-char string — run `openssl rand -base64 32` to make one |
   | `TMDB_API_KEY` | your TMDB key |

5. Click **Deploy**. Vercel builds the app (2-4 min). You'll get a live URL
   like `reflix.vercel.app`.

## Step 7 — Push the database schema to Supabase + seed the catalog

Once deployed, the database is empty. Run these **once** from your local
machine, pointing at Supabase (the `.env` on your machine should have the
same `DATABASE_URL` as Vercel):

```bash
# 1. create all the tables in Supabase Postgres
bun run db:push

# 2. seed the 250 movies + admin/viewer users
bun run prisma/seed.ts

# 3. (optional) fetch real artwork from TMDB — already done locally,
#    and the images are committed to the repo, so skip this unless you
#    want to refresh them
bun run fetch-artwork
```

That's it — your live site on Vercel now has the full catalog with artwork,
an admin account, and working uploads.

---

## Local development

For local dev you can use the same Supabase database (point `DATABASE_URL` at
it in your local `.env`), or run a local Postgres if you prefer. The app
behaves identically either way.

---

## Demo credentials (after seeding)

- **Admin:** `admin@reflix.com` / `reflix-admin`
- **Member:** `viewer@reflix.com` / `reflix-viewer`

⚠️ Change these or create your own admin account before going public. The
seeded passwords are in `prisma/seed.ts` — anyone reading the repo knows them.

---

## Troubleshooting

**"Supabase not configured" error on upload** — you're missing
`NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` in your env vars.

**Build fails with "Prisma Client not found"** — the `postinstall` script
should handle this, but if it doesn't, change the Vercel build command to
`prisma generate && next build`.

**Movies don't show up on the live site** — you ran `db:push` and
`prisma/seed.ts` but the page is empty. Make sure your local `.env`
`DATABASE_URL` points at the **same** Supabase project Vercel is using.

**Image uploads 404** — the Supabase storage bucket must be set to **Public**.
Re-check Step 4.

**Rate-limited by TMDB** — the fetch script backs off automatically. Re-run
`bun run fetch-artwork` and it resumes from where it stopped.
