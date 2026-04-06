"use client";

import { createClient } from "@/lib/supabase/client";
import type { RecordingFileRow } from "@/lib/recording-types";
import { fileDisplayTitle } from "@/lib/recording-types";
import { BottomSheet } from "@/components/bottom-sheet";
import { useCallback, useEffect, useState } from "react";

type Phase = "menu" | "rename" | "deleteConfirm";

type Props = {
  open: boolean;
  onClose: () => void;
  file: RecordingFileRow | null;
  onUpdated: () => void;
};

export function RecordingFileActionsSheet({
  open,
  onClose,
  file,
  onUpdated,
}: Props) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setPhase("menu");
    setDraftTitle("");
    setError(null);
    setSaving(false);
  }, []);

  useEffect(() => {
    if (open && file) {
      reset();
      setDraftTitle(fileDisplayTitle(file));
    }
  }, [open, file?.id, reset]);

  const close = () => {
    reset();
    onClose();
  };

  const saveRename = async () => {
    if (!file) return;
    const next = draftTitle.trim();
    if (!next) {
      setError("Name cannot be empty.");
      return;
    }

    const prevStored = file.title?.trim() ?? "";
    if (next === prevStored) {
      close();
      return;
    }

    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("recording_files")
      .update({ title: next })
      .eq("id", file.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onUpdated();
    close();
  };

  const runDelete = async () => {
    if (!file) return;
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("recording_files")
      .delete()
      .eq("id", file.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onUpdated();
    close();
  };

  if (!file) return null;

  const titleText =
    phase === "menu"
      ? fileDisplayTitle(file)
      : phase === "rename"
        ? "Rename recording file"
        : "Delete recording file?";

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
              setDraftTitle(fileDisplayTitle(file));
            }}
            className="rounded-xl px-3 py-3 text-left text-[15px] font-medium text-[#1e1e1e] transition-colors hover:bg-black/[0.04]"
          >
            Rename
          </button>
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
          <label htmlFor="sheet-file-title" className="sr-only">
            File name
          </label>
          <input
            id="sheet-file-title"
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

      {phase === "deleteConfirm" ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-neutral-800">
            Delete this recording file? This cannot be undone.
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
