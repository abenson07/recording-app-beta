-- Earlier migration revisions used public.projects. Rename to recording_projects
-- if that old table exists and the new name is not already present (idempotent).

do $$
begin
  if to_regclass('public.projects') is not null
     and to_regclass('public.recording_projects') is null then
    alter table public.projects rename to recording_projects;
  end if;
end $$;
