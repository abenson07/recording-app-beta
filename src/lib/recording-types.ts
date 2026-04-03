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

/** Grouping of recording items inside one project (optional). */
export type RecordingProjectFolderRow = {
  id: string;
  project_id: string;
  name: string;
  summary: string | null;
  created_at: string;
  updated_at?: string;
};

export type RecordingItemRow = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at?: string;
  project_id: string | null;
  /** Present when row includes the column; null/omit = not in a folder. */
  folder_id?: string | null;
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

/** Compact clock for list subtitles, e.g. `2:49` or `1:05:03`. */
export function formatDurationClock(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatRelativeTime(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const diffMs = Date.now() - t;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 10) return "Just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
