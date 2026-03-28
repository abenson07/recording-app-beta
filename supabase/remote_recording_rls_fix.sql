-- Run this in Supabase Dashboard → SQL Editor if you see:
--   "permission denied for table recording_items"
-- Your remote DB must have the same RLS policies + grants as local migrations.
--
-- Safe to run more than once (drops/recreates policies by name).

-- ---------------------------------------------------------------------------
-- Privileges for PostgREST (JWT role = authenticated)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.recording_projects to authenticated;
grant select, insert, update, delete on table public.recording_items to authenticated;
grant select, insert, update, delete on table public.recording_files to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.recording_projects enable row level security;
alter table public.recording_items enable row level security;
alter table public.recording_files enable row level security;

drop policy if exists "recording_projects_select_own" on public.recording_projects;
drop policy if exists "recording_projects_insert_own" on public.recording_projects;
drop policy if exists "recording_projects_update_own" on public.recording_projects;
drop policy if exists "recording_projects_delete_own" on public.recording_projects;

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

drop policy if exists "recording_items_select_own" on public.recording_items;
drop policy if exists "recording_items_insert_own" on public.recording_items;
drop policy if exists "recording_items_update_own" on public.recording_items;
drop policy if exists "recording_items_delete_own" on public.recording_items;

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

drop policy if exists "recording_files_select_via_item" on public.recording_files;
drop policy if exists "recording_files_insert_via_item" on public.recording_files;
drop policy if exists "recording_files_update_via_item" on public.recording_files;
drop policy if exists "recording_files_delete_via_item" on public.recording_files;

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
