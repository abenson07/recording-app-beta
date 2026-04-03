-- Folders within a recording project for organizing recording items.

-- ---------------------------------------------------------------------------
-- recording_project_folders
-- ---------------------------------------------------------------------------
create table public.recording_project_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.recording_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recording_project_folders is
  'Optional grouping of recording_items inside one recording_project.';

create index recording_project_folders_project_id_idx
  on public.recording_project_folders (project_id);

create index recording_project_folders_user_id_idx
  on public.recording_project_folders (user_id);

-- ---------------------------------------------------------------------------
-- recording_items.folder_id
-- ---------------------------------------------------------------------------
alter table public.recording_items
  add column folder_id uuid references public.recording_project_folders (id) on delete set null;

create index recording_items_folder_id_idx on public.recording_items (folder_id);

comment on column public.recording_items.folder_id is
  'When set, item is filed under this folder; must match project_id on the folder.';

-- ---------------------------------------------------------------------------
-- Validate folder belongs to same project (and owner)
-- ---------------------------------------------------------------------------
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
        and f.user_id = (select auth.uid())
    ) then
      raise exception 'folder must belong to the same project as the recording item';
    end if;
  end if;
  return new;
end;
$$;

create trigger recording_items_validate_folder_project
  before insert or update of folder_id, project_id on public.recording_items
  for each row
  execute procedure public.recording_items_validate_folder_project();

-- ---------------------------------------------------------------------------
-- updated_at on folders
-- ---------------------------------------------------------------------------
create trigger recording_project_folders_set_updated_at
  before update on public.recording_project_folders
  for each row
  execute procedure public.recording_app_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.recording_project_folders enable row level security;

create policy "recording_project_folders_select_own"
  on public.recording_project_folders for select to authenticated
  using (user_id = (select auth.uid()));

create policy "recording_project_folders_insert_own"
  on public.recording_project_folders for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "recording_project_folders_update_own"
  on public.recording_project_folders for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "recording_project_folders_delete_own"
  on public.recording_project_folders for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.recording_project_folders to authenticated;
