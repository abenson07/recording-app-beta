# Database schema (additive model)

This document records implementation decisions for the additive Postgres schema introduced for [MWO-220](https://linear.app/midwestern/issue/MWO-220/define-additive-schema-for-recordings-items-and-projects). Product-level behavior remains in [PRODUCT_SPEC.md](./PRODUCT_SPEC.md).

## Preserving existing recording storage

- **No destructive changes** to Supabase Storage buckets or objects.
- Each row in `recording_files` **references** an object via `storage_path` (bucket key). Older recordings stay at their current paths; new rows simply point to those keys.
- Nothing in this migration moves or deletes storage objects.

## Tables and relationships

| Table | Role |
|--------|------|
| `recording_projects` | Optional container; one recording project has many `recording_items` via `recording_items.project_id`. |
| `recording_items` | User-facing unit; **nullable** `project_id` so items can float outside any project. |
| `recording_files` | One media asset + per-file transcript/metadata; **many per** `recording_item`. |

Cardinality:

- One or more `recording_files` per `recording_item` (enforced by app workflow; minimum one file is expected for a usable item).
- Zero or one `project` per `recording_item` (`project_id` nullable).
- One or more `recording_items` per `recording_project` (via non-null `project_id`).

## Ordering recording files

- Column pair `(recording_item_id, sequence_index)` is **unique**.
- `sequence_index` is a non-negative integer; assign in chronological order when appending segments. Gaps are allowed; the app should query `order by sequence_index`.

## Transcript and metadata

| Location | Purpose |
|----------|---------|
| `recording_files.transcript` | Transcript for **this** file only (nullable until available). |
| `recording_items.transcript_strategy` | How to build a **combined** view from child files (default `concat_in_sequence_order`; app-defined values allowed). |
| `*.metadata` (`jsonb`) | Extensible JSON for UI, source system ids, ASR vendor payloads, etc. |
| `recording_projects.summary` | Recording-project summary text (nullable; generation is application logic). |

Combined transcript for an item is **not** stored as a single denormalized column in v1; derive it by reading files in `sequence_index` order and applying `transcript_strategy`.

Column names match [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) where applicable; per-file `duration` is stored in **seconds** as a float (`double precision`).

## Ownership and RLS

- `recording_projects.user_id` and `recording_items.user_id` tie rows to `auth.users`.
- `recording_files` has no `user_id`; access is enforced through the parent `recording_items` row (policies use `exists (...)`).
- Clients must use an **authenticated** Supabase session (`auth.uid()`). Server-side jobs can use the service role where appropriate.

## Applying migrations

**Important:** Files under `supabase/migrations/` are *not* applied automatically when you commit or configure `.env.local`. The database you see in the [Supabase dashboard](https://supabase.com/dashboard) only changes after you run a migration against **that** project (CLI push or SQL Editor).

### Hosted project (typical — no Docker)

From the repo root, using the [Supabase CLI](https://supabase.com/docs/guides/cli) (already a dev dependency):

1. Find your **project ref** in the dashboard URL: `https://supabase.com/dashboard/project/<project-ref>` (or in **Project Settings → General**).
2. Log in and link once per machine:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

3. Push pending migrations to the linked remote database:

   ```bash
   npx supabase db push
   ```

After a successful push, open **Table Editor** in the dashboard — you should see `recording_projects`, `recording_items`, and `recording_files`.

**Alternative:** In the dashboard, open **SQL Editor**, and run the migration files in order (`supabase/migrations/*.sql`), or use `npx supabase db push` once the CLI is linked.

If you created tables from an older revision that used `public.projects`, migration `20260328130000_rename_projects_to_recording_projects.sql` renames that table to `recording_projects` when you push.

### Local Supabase (optional, Docker only)

If you run the stack locally:

```bash
npm run db:start    # first time; requires Docker
npm run db:reset    # applies supabase/migrations/*.sql then seed.sql
```
