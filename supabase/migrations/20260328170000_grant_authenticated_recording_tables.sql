-- Ensure the PostgREST `authenticated` role can touch these tables; RLS still applies.
grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.recording_projects to authenticated;
grant select, insert, update, delete on table public.recording_items to authenticated;
grant select, insert, update, delete on table public.recording_files to authenticated;
