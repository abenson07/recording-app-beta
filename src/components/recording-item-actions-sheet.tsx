"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  RecordingItemRow,
  RecordingProjectFolderRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import { BottomSheet } from "@/components/bottom-sheet";
import { useCallback, useEffect, useState } from "react";

type Phase = "menu" | "rename" | "move" | "deleteConfirm";

type Props = {
  open: boolean;
  onClose: () => void;
  item: RecordingItemRow | null;
  projects: RecordingProjectRow[];
  /** When true (recording detail), menu includes Delete. */
  showDelete?: boolean;
  onUpdated: () => void;
  onDeleted?: () => void;
  onMoveToNewProject?: () => Promise<void>;
};

export function RecordingItemActionsSheet({
  open,
  onClose,
  item,
  projects,
  showDelete = false,
  onUpdated,
  onDeleted,
  onMoveToNewProject,
}: Props) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [moveProjectId, setMoveProjectId] = useState<string | null>(null);
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<RecordingProjectFolderRow[]>([]);

  const reset = useCallback(() => {
    setPhase("menu");
    setDraftTitle("");
    setError(null);
    setSaving(false);
    setMoveProjectId(null);
    setMoveFolderId(null);
    setFolders([]);
  }, []);

  useEffect(() => {
    if (open && item) {
      reset();
      setDraftTitle(item.title ?? "");
      setMoveProjectId(item.project_id);
      setMoveFolderId(item.folder_id ?? null);
    }
  }, [open, item?.id, item?.project_id, item?.folder_id, item?.title, reset]);

  useEffect(() => {
    if (!open || !moveProjectId) {
      setFolders([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("recording_project_folders")
      .select("id, project_id, name, summary, created_at, updated_at")
      .eq("project_id", moveProjectId)
      .order("name", { ascending: true })
      .then(({ data }) => {
        setFolders((data as RecordingProjectFolderRow[]) ?? []);
      });
  }, [open, moveProjectId]);

  const close = () => {
    reset();
    onClose();
  };

  const saveRename = async () => {
    if (!item) return;
    const next = draftTitle.trim();
    if (!next) {
      setError("Name cannot be empty.");
      return;
    }
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("recording_items")
      .update({ title: next })
      .eq("id", item.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onUpdated();
    close();
  };

  const applyMove = async () => {
    if (!item) return;
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const payload: { project_id: string | null; folder_id: string | null } = {
      project_id: moveProjectId,
      folder_id: moveProjectId ? moveFolderId : null,
    };
    const { error: err } = await supabase
      .from("recording_items")
      .update(payload)
      .eq("id", item.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onUpdated();
    close();
  };

  const runDelete = async () => {
    if (!item) return;
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("recording_items")
      .delete()
      .eq("id", item.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onUpdated();
    onDeleted?.();
    close();
  };

  if (!item) return null;

  const titleText =
    phase === "menu"
      ? item.title ?? "Recording"
      : phase === "rename"
        ? "Rename recording"
        : phase === "move"
          ? "Move recording"
          : "Delete recording?";

  return (
    <BottomSheet
      open={open}
      onClose={() => !saving && close()}
      title={titleText}
    >
      {phase === "menu" ? (
        <div className="mt-4 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPhase("rename");
              setDraftTitle(item.title ?? "");
            }}
            className="rounded-xl px-3 py-3 text-left text-[15px] font-medium text-[#1e1e1e] transition-colors hover:bg-black/[0.04]"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMoveProjectId(item.project_id);
              setMoveFolderId(item.folder_id ?? null);
              setPhase("move");
            }}
            className="rounded-xl px-3 py-3 text-left text-[15px] font-medium text-[#1e1e1e] transition-colors hover:bg-black/[0.04]"
          >
            Move
          </button>
          {showDelete ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase("deleteConfirm");
              }}
              className="rounded-xl px-3 py-3 text-left text-[15px] font-medium text-red-800 transition-colors hover:bg-red-50"
            >
              Delete
            </button>
          ) : null}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={close}
            className="mt-2 rounded-xl px-3 py-3 text-center text-[14px] text-black/50"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {phase === "rename" ? (
        <div className="mt-4 flex flex-col gap-3">
          <label htmlFor="sheet-rec-title" className="sr-only">
            Name
          </label>
          <input
            id="sheet-rec-title"
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="w-full rounded-[10px] border border-[#D9D7CA] bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-black/20"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3 text-[13px]">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveRename()}
              className="font-medium text-black/85 underline underline-offset-2 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setError(null);
                setPhase("menu");
              }}
              className="text-black/50 underline underline-offset-2"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {phase === "move" ? (
        <div className="mt-4 flex flex-col gap-3">
          <label htmlFor="sheet-rec-project" className="text-sm text-black/75">
            Project
          </label>
          <select
            id="sheet-rec-project"
            value={moveProjectId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setMoveProjectId(v === "" ? null : v);
              setMoveFolderId(null);
            }}
            disabled={saving}
            className="w-full rounded-[10px] border border-[#D9D7CA] bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
          >
            <option value="">Unassigned (inbox)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {moveProjectId ? (
            <>
              <label htmlFor="sheet-rec-folder" className="text-sm text-black/75">
                Folder (optional)
              </label>
              <select
                id="sheet-rec-folder"
                value={moveFolderId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setMoveFolderId(v === "" ? null : v);
                }}
                disabled={saving}
                className="w-full rounded-[10px] border border-[#D9D7CA] bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
              >
                <option value="">No folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {onMoveToNewProject ? (
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void (async () => {
                  setError(null);
                  setSaving(true);
                  try {
                    await onMoveToNewProject();
                    close();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Something went wrong");
                  } finally {
                    setSaving(false);
                  }
                })()
              }
              className="w-full rounded-xl border border-dashed border-black/20 px-3 py-2.5 text-left text-[13px] font-medium text-black/80 transition-colors hover:bg-black/[0.03]"
            >
              Create new project & move here
            </button>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3 text-[13px]">
            <button
              type="button"
              disabled={saving}
              onClick={() => void applyMove()}
              className="font-medium text-black/85 underline underline-offset-2 disabled:opacity-50"
            >
              {saving ? "Moving…" : "Apply"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setError(null);
                setPhase("menu");
              }}
              className="text-black/50 underline underline-offset-2"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {phase === "deleteConfirm" ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-neutral-800">
            Delete this recording and all its segments? This cannot be undone.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3 text-[13px]">
            <button
              type="button"
              disabled={saving}
              onClick={() => void runDelete()}
              className="font-medium text-red-800 underline underline-offset-2 disabled:opacity-50"
            >
              {saving ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setError(null);
                setPhase("menu");
              }}
              className="text-black/50 underline underline-offset-2"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
