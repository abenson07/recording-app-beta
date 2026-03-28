export type RecordingFileRow = {
  id: string;
  sequence_index: number;
  transcript: string | null;
  storage_path: string;
  duration: number | null;
  created_at?: string;
};

export type RecordingProjectRow = {
  id: string;
  name: string;
  summary: string | null;
  created_at: string;
};

export type RecordingItemRow = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at?: string;
  project_id: string | null;
  recording_files: RecordingFileRow[] | null;
};

export function segmentCount(item: RecordingItemRow): number {
  return item.recording_files?.length ?? 0;
}

export function totalDurationSec(item: RecordingItemRow): number {
  const files = item.recording_files ?? [];
  return files.reduce((acc, f) => acc + (f.duration ?? 0), 0);
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
