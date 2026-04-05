-- No-auth / anon: allow recording_project_folders via PostgREST and relax folder trigger
-- (validation uses project match only; no auth.uid() on folder row).

alter table public.recording_project_folders disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.recording_project_folders to anon, authenticated;

alter table public.recording_project_folders
  drop constraint if exists recording_project_folders_user_id_fkey;

alter table public.recording_project_folders
  alter column user_id drop not null;

create or replace function public.recording_items_validate_folder_project()
returns trigger
language plpgsql
as $$
begin
  if new.folder_id is not null then
    if new.project_id is null then
      raise exception 'recording_items.folder_id requires project_id';
    end if;
    if not exists (
      select 1
      from public.recording_project_folders f
      where f.id = new.folder_id
        and f.project_id = new.project_id
    ) then
      raise exception 'folder must belong to the same project as the recording item';
    end if;
  end if;
  return new;
end;
$$;
