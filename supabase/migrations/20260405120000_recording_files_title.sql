-- Per-file display name; transcripts remain on recording_files.transcript.
alter table public.recording_files
  add column if not exists title text;

comment on column public.recording_files.title is
  'User-visible name for this segment; optional; falls back in UI when null.';
