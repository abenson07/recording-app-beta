This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Product requirements and data model: see [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).

## Environment

1. Copy the example env file and add your Supabase project values:

   ```bash
   cp .env.example .env.local
   ```

2. In the [Supabase dashboard](https://supabase.com/dashboard), open **Project Settings → API** and set:

   - `NEXT_PUBLIC_SUPABASE_URL` — **Project URL**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **anon public** key

## Database migrations (hosted — no Docker)

`.env.local` only points the app at your Supabase API; it does **not** run SQL migrations. New tables from `supabase/migrations/` appear in the dashboard after you apply them:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Use the same **project ref** as in your project URL (`https://supabase.com/dashboard/project/<project-ref>`). Schema notes: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

After pushing migrations, apply the **storage** migration (`storage_recordings_policies`) so authenticated users can upload to the [`recordings` bucket](https://supabase.com/dashboard/project/_/storage/files/buckets/recordings) under `{user_id}/...`.

**Home page recordings:** enable **Anonymous** sign-ins under **Authentication → Providers** (or sign in with another provider). The app signs in anonymously on load so Row Level Security can scope rows and storage paths to `auth.uid()`.

## Supabase CLI (optional local stack)

The [Supabase CLI](https://supabase.com/docs/guides/cli) is also available as a dev dependency. Local `db:start` / `db:reset` require Docker; skip this if you only use hosted Supabase.

| Command | Purpose |
|--------|---------|
| `npm run db:start` | Start local Supabase (Docker required) |
| `npm run db:status` | Show local API URL and keys |
| `npm run db:stop` | Stop local Supabase |
| `npm run db:reset` | Reset local DB and apply migrations + seed |

After `db:start`, copy **API URL** and **anon key** from `npm run db:status` into `.env.local` if you are developing against local Supabase.

**Check connectivity:** with the dev server running (`npm run dev`), open or request `GET /api/health/supabase`. A JSON body with `"ok": true` means the app can reach Supabase with your env configuration.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
