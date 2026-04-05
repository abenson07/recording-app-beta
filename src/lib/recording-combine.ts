import type { RecordingFileRow } from "./recording-types";

/** One flowing transcript: segments in sequence, joined with blank lines only. */
export function combineRecordingFileTranscripts(
  files: RecordingFileRow[] | null | undefined,
): string {
  const sorted = [...(files ?? [])].sort(
    (a, b) => a.sequence_index - b.sequence_index,
  );
  const parts = sorted.map((f) => f.transcript?.trim()).filter(Boolean);
  return parts.join("\n\n");
}
