-- One-time data migration: public.recordings -> recording_items + recording_files
-- Run in Supabase SQL Editor after clearing recording_files / recording_items (Step 2).
-- Skips storage placeholder rows (.emptyFolderPlaceholder).

begin;

insert into public.recording_items (
  id,
  user_id,
  project_id,
  title,
  transcript_strategy,
  metadata,
  created_at,
  updated_at
)
select
  r.id,
  null::uuid,
  null::uuid,
  r.title,
  'concat_in_sequence_order',
  jsonb_strip_nulls(
    jsonb_build_object(
      'migrated_from', 'recordings',
      'legacy_status', r.status::text,
      'legacy_domain', r.domain::text,
      'legacy_topic', r.topic,
      'legacy_link', r.link
    )
  ),
  coalesce(r.created_at, now()),
  coalesce(r.updated_at, now())
from public.recordings r
where r.link not like '%.emptyFolderPlaceholder%';

insert into public.recording_files (
  recording_item_id,
  sequence_index,
  storage_path,
  transcript,
  metadata,
  duration,
  capture_type,
  created_at
)
select
  r.id,
  0,
  case
    when r.link ~ '^https?://' then
      regexp_replace(split_part(r.link, '?', 1), '^.*/recordings/', '')
    else
      trim(both '/' from r.link)
  end,
  case
    when r.transcript is not null and btrim(r.transcript) <> '' then btrim(r.transcript)
    when r.raw_transcript is not null and btrim(r.raw_transcript) <> '' then btrim(r.raw_transcript)
    else null
  end,
  jsonb_strip_nulls(
    jsonb_build_object(
      'legacy_raw_transcript',
      case
        when r.raw_transcript is not null and btrim(r.raw_transcript) <> ''
          and (r.transcript is null or btrim(r.transcript) = '')
        then btrim(r.raw_transcript)
        else null
      end,
      'legacy_transcript_duplicate',
      case
        when r.transcript is not null and btrim(r.transcript) <> ''
          and r.raw_transcript is not null and btrim(r.raw_transcript) <> ''
          and btrim(r.transcript) is distinct from btrim(r.raw_transcript)
        then btrim(r.raw_transcript)
        else null
      end
    )
  ),
  null::double precision,
  nullif(btrim(r.domain::text), ''),
  coalesce(r.created_at, now())
from public.recordings r
where r.link not like '%.emptyFolderPlaceholder%';

commit;

-- Verify (run after commit):
-- select count(*) from public.recording_items;
-- select count(*) from public.recording_files;
-- select count(*) filter (where transcript is not null and btrim(transcript) <> '') from public.recording_files;
