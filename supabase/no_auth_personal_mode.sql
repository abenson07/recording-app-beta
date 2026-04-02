-- Personal no-auth mode for local development with persistent Supabase storage.
-- Run once in Supabase SQL Editor for the target project.

-- 1) Make owner columns optional and remove auth.users foreign keys.
do $$
declare
  c record;
begin
  for c in
    select tc.table_name, tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
     and tc.table_name = kcu.table_name
    where tc.table_schema = 'public'
      and tc.table_name in ('recording_projects', 'recording_items')
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      c.table_name,
      c.constraint_name
    );
  end loop;
end $$;

alter table public.recording_projects alter column user_id drop not null;
alter table public.recording_items alter column user_id drop not null;

-- 2) Disable RLS on app tables and allow anon role to read/write.
alter table public.recording_projects disable row level security;
alter table public.recording_items disable row level security;
alter table public.recording_files disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.recording_projects to anon, authenticated;
grant select, insert, update, delete on table public.recording_items to anon, authenticated;
grant select, insert, update, delete on table public.recording_files to anon, authenticated;

-- 3) Storage bucket access: allow uploads/downloads without auth.uid path rules.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', true)
on conflict (id) do update set public = true;

drop policy if exists "recordings_select_own" on storage.objects;
drop policy if exists "recordings_insert_own" on storage.objects;
drop policy if exists "recordings_update_own" on storage.objects;
drop policy if exists "recordings_delete_own" on storage.objects;
drop policy if exists "recordings_select_public" on storage.objects;
drop policy if exists "recordings_insert_public" on storage.objects;
drop policy if exists "recordings_update_public" on storage.objects;
drop policy if exists "recordings_delete_public" on storage.objects;

create policy "recordings_select_public"
  on storage.objects for select to public
  using (bucket_id = 'recordings');

create policy "recordings_insert_public"
  on storage.objects for insert to public
  with check (bucket_id = 'recordings');

create policy "recordings_update_public"
  on storage.objects for update to public
  using (bucket_id = 'recordings')
  with check (bucket_id = 'recordings');

create policy "recordings_delete_public"
  on storage.objects for delete to public
  using (bucket_id = 'recordings');
