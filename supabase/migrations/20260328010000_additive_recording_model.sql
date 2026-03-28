-- Additive schema for recording projects, recording items, and recording files.
-- Does not alter or replace Supabase Storage: recording_files.storage_path references
-- existing bucket object keys; legacy objects remain valid at their paths.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- recording_projects
-- ---------------------------------------------------------------------------
create table public.recording_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recording_projects is
  'Container for one or more recording items; avoids generic name collision with project.';

create index recording_projects_user_id_idx on public.recording_projects (user_id);

-- ---------------------------------------------------------------------------
-- recording_items (may exist without a recording project)
-- ---------------------------------------------------------------------------
create table public.recording_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.recording_projects (id) on delete set null,
  title text,
  transcript_strategy text not null default 'concat_in_sequence_order',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recording_items is
  'User-visible unit of one or more recording files; project_id is optional.';

comment on column public.recording_items.transcript_strategy is
  'How to derive a combined transcript from recording_files (e.g. concat_in_sequence_order); app-defined.';

create index recording_items_user_id_idx on public.recording_items (user_id);
create index recording_items_project_id_idx on public.recording_items (project_id);

-- ---------------------------------------------------------------------------
-- recording_files (ordered within a recording item; storage path is additive)
-- ---------------------------------------------------------------------------
create table public.recording_files (
  id uuid primary key default gen_random_uuid(),
  recording_item_id uuid not null references public.recording_items (id) on delete cascade,
  sequence_index integer not null,
  storage_path text not null,
  transcript text,
  metadata jsonb not null default '{}'::jsonb,
  duration double precision,
  capture_type text,
  created_at timestamptz not null default now(),
  constraint recording_files_item_sequence_unique unique (recording_item_id, sequence_index),
  constraint recording_files_sequence_non_negative check (sequence_index >= 0)
);

comment on table public.recording_files is
  'One raw recording asset; storage_path is the Supabase Storage object key (additive reference).';

comment on column public.recording_files.storage_path is
  'Key/path within the recordings bucket; preserves existing stored objects without DB migration.';

comment on column public.recording_files.sequence_index is
  'Chronological order within the parent recording_item (0-based or dense integers).';

comment on column public.recording_files.duration is
  'Length of the media segment in seconds (nullable if unknown).';

create index recording_files_recording_item_id_idx on public.recording_files (recording_item_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.recording_app_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recording_projects_set_updated_at
  before update on public.recording_projects
  for each row
  execute procedure public.recording_app_set_updated_at();

create trigger recording_items_set_updated_at
  before update on public.recording_items
  for each row
  execute procedure public.recording_app_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (owner = auth.uid() on recording_projects and recording_items)
-- ---------------------------------------------------------------------------
alter table public.recording_projects enable row level security;
alter table public.recording_items enable row level security;
alter table public.recording_files enable row level security;

create policy "recording_projects_select_own"
  on public.recording_projects for select to authenticated
  using (user_id = (select auth.uid()));

create policy "recording_projects_insert_own"
  on public.recording_projects for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "recording_projects_update_own"
  on public.recording_projects for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "recording_projects_delete_own"
  on public.recording_projects for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "recording_items_select_own"
  on public.recording_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "recording_items_insert_own"
  on public.recording_items for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "recording_items_update_own"
  on public.recording_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "recording_items_delete_own"
  on public.recording_items for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "recording_files_select_via_item"
  on public.recording_files for select to authenticated
  using (
    exists (
      select 1
      from public.recording_items ri
      where ri.id = recording_item_id
        and ri.user_id = (select auth.uid())
    )
  );

create policy "recording_files_insert_via_item"
  on public.recording_files for insert to authenticated
  with check (
    exists (
      select 1
      from public.recording_items ri
      where ri.id = recording_item_id
        and ri.user_id = (select auth.uid())
    )
  );

create policy "recording_files_update_via_item"
  on public.recording_files for update to authenticated
  using (
    exists (
      select 1
      from public.recording_items ri
      where ri.id = recording_item_id
        and ri.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.recording_items ri
      where ri.id = recording_item_id
        and ri.user_id = (select auth.uid())
    )
  );

create policy "recording_files_delete_via_item"
  on public.recording_files for delete to authenticated
  using (
    exists (
      select 1
      from public.recording_items ri
      where ri.id = recording_item_id
        and ri.user_id = (select auth.uid())
    )
  );
