-- RLS for the existing private `recordings` bucket. Object keys must be
-- `{auth.uid()}/...` so each user only sees their own uploads.
-- Dashboard: https://supabase.com/dashboard/project/_/storage/files/buckets/recordings

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

drop policy if exists "recordings_select_own" on storage.objects;
drop policy if exists "recordings_insert_own" on storage.objects;
drop policy if exists "recordings_update_own" on storage.objects;
drop policy if exists "recordings_delete_own" on storage.objects;

create policy "recordings_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings'
    and name like (select auth.uid()::text) || '/%'
  );

create policy "recordings_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and name like (select auth.uid()::text) || '/%'
  );

create policy "recordings_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'recordings'
    and name like (select auth.uid()::text) || '/%'
  )
  with check (
    bucket_id = 'recordings'
    and name like (select auth.uid()::text) || '/%'
  );

create policy "recordings_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'recordings'
    and name like (select auth.uid()::text) || '/%'
  );
