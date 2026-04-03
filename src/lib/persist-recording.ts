import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RecordingFileRow,
  RecordingItemRow,
  RecordingProjectFolderRow,
  RecordingProjectRow,
} from "./recording-types";

function nextSequenceIndex(
  files: RecordingFileRow[] | null | undefined,
): number {
  const list = files ?? [];
  if (list.length === 0) return 0;
  return Math.max(...list.map((f) => f.sequence_index)) + 1;
}

export type PersistRecordingOptions = {
  contentType: string;
  durationSec: number | null;
  captureType: string;
  newItemTitle?: string;
};

export type PersistRecordingContext = {
  appendToItemId: string | null;
  items: RecordingItemRow[];
  newItemProjectId: string;
  projects: RecordingProjectRow[];
  /** When creating a new item in a project, file it under this folder (must belong to that project). */
  newItemFolderId?: string | null;
  folders?: RecordingProjectFolderRow[];
};

/**
 * Upload blob to storage and insert recording_files (+ recording_items when not appending).
 * Caller should refresh lists and clear segment mode on success.
 */
export async function persistRecordingBlob(
  supabase: SupabaseClient,
  blob: Blob,
  options: PersistRecordingOptions,
  ctx: PersistRecordingContext,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mime = options.contentType || blob.type || "application/octet-stream";
  const ext = mime.includes("webm")
    ? "webm"
    : mime.includes("mp4") || mime.includes("m4a")
      ? "m4a"
      : mime.includes("mpeg") || mime.includes("mp3")
        ? "mp3"
        : mime.includes("wav")
          ? "wav"
          : mime.includes("ogg")
            ? "ogg"
            : mime.includes("flac")
              ? "flac"
              : "bin";

  const fileId = crypto.randomUUID();
  const storagePath = `${fileId}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("recordings")
    .upload(storagePath, blob, {
      contentType: mime,
      upsert: false,
    });

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  let targetItemId: string;
  let sequenceIndex: number;

  if (ctx.appendToItemId) {
    const target = ctx.items.find((i) => i.id === ctx.appendToItemId);
    if (!target) {
      return {
        ok: false,
        error: "Could not find that recording item. Try refreshing.",
      };
    }
    targetItemId = ctx.appendToItemId;
    sequenceIndex = nextSequenceIndex(target.recording_files);
  } else {
    const title =
      options.newItemTitle ??
      `Recording ${new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}`;

    const projectId =
      ctx.newItemProjectId &&
      ctx.projects.some((p) => p.id === ctx.newItemProjectId)
        ? ctx.newItemProjectId
        : null;

    const rawFolderId = ctx.newItemFolderId?.trim() ?? "";
    const folderId =
      projectId &&
      rawFolderId &&
      (ctx.folders ?? []).some(
        (f) => f.id === rawFolderId && f.project_id === projectId,
      )
        ? rawFolderId
        : null;

    const { data: itemRow, error: itemErr } = await supabase
      .from("recording_items")
      .insert({
        title,
        ...(projectId ? { project_id: projectId } : {}),
        ...(folderId ? { folder_id: folderId } : {}),
      })
      .select("id")
      .single();

    if (itemErr || !itemRow) {
      return {
        ok: false,
        error: itemErr?.message ?? "Failed to create recording item",
      };
    }

    targetItemId = itemRow.id;
    sequenceIndex = 0;
  }

  const { error: fileErr } = await supabase.from("recording_files").insert({
    recording_item_id: targetItemId,
    sequence_index: sequenceIndex,
    storage_path: storagePath,
    transcript: "",
    duration: options.durationSec,
    capture_type: options.captureType,
  });

  if (fileErr) {
    return { ok: false, error: fileErr.message };
  }

  return { ok: true };
}
