"use client";

import { createClient } from "@/lib/supabase/client";
import type { RecordingItemRow, RecordingProjectRow } from "@/lib/recording-types";
import { BottomSheet } from "@/components/bottom-sheet";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Phase = "menu" | "rename" | "deletePickTarget" | "deleteConfirm";

type Props = {
  open: boolean;
  onClose: () => void;
  project: RecordingProjectRow | null;
  /** All projects (including current — used to count items). */
  projects: RecordingProjectRow[];
  items: RecordingItemRow[];
  onUpdated: () => void;
};

export function ProjectItemActionsSheet({
  open,
  onClose,
  project,
  projects,
  items,
  onUpdated,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("menu");
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Where to move recordings before deleting this project (null = inbox). */
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);

  const recordingCount =
    project == null
      ? 0
      : items.filter((i) => i.project_id === project.id).length;

  const otherProjects = projects.filter((p) => project && p.id !== project.id);

  const reset = useCallback(() => {
    setPhase("menu");
    setDraftName("");
    setError(null);
    setSaving(false);
    setMoveTargetId(otherProjects[0]?.id ?? null);
  }, [otherProjects]);

  useEffect(() => {
    if (open && project) {
      reset();
      setDraftName(project.name);
      setMoveTargetId(otherProjects[0]?.id ?? null);
    }
  }, [open, project?.id, project?.name, otherProjects, reset]);

  const close = () => {
    reset();
    onClose();
  };

  const saveRename = async () => {
    if (!project) return;
    const next = draftName.trim();
    if (!next) {
      setError("Name cannot be empty.");
      return;
    }
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("recording_projects")
      .update({ name: next })
      .eq("id", project.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onUpdated();
    close();
  };

  const startDelete = () => {
    setError(null);
    if (recordingCount === 0) {
      setPhase("deleteConfirm");
      return;
    }
    setMoveTargetId(otherProjects[0]?.id ?? null);
    setPhase("deletePickTarget");
  };

  const goDeleteConfirm = () => {
    setError(null);
    setPhase("deleteConfirm");
  };

  const runDeleteProject = async () => {
    if (!project) return;
    setError(null);
    setSaving(true);
    const supabase = createClient();

    if (recordingCount > 0) {
      const target = moveTargetId;
      const { error: moveErr } = await supabase
        .from("recording_items")
        .update({ project_id: target, folder_id: null })
        .eq("project_id", project.id);

      if (moveErr) {
        setError(moveErr.message);
        setSaving(false);
        return;
      }
    }

    const { error: delErr } = await supabase
      .from("recording_projects")
      .delete()
      .eq("id", project.id);

    setSaving(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }

    onUpdated();
    close();
    router.push("/projects");
  };

  if (!project) return null;

  const titleText =
    phase === "menu"
      ? project.name
      : phase === "rename"
        ? "Rename project"
        : phase === "deletePickTarget"
          ? "Move recordings"
          : "Delete project?";

  const destinationSummary =
    moveTargetId === null
      ? "Inbox (unassigned)"
      : projects.find((p) => p.id === moveTargetId)?.name ?? "another project";

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
              setDraftName(project.name);
            }}
            className="rounded-xl px-3 py-3 text-left text-[15px] font-medium text-[#1e1e1e] transition-colors hover:bg-black/[0.04]"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={startDelete}
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
          <label htmlFor="sheet-proj-name" className="sr-only">
            Project name
          </label>
          <input
            id="sheet-proj-name"
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
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

      {phase === "deletePickTarget" ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-black/75">
            Move {recordingCount} recording{recordingCount === 1 ? "" : "s"} to
            another project or the inbox before deleting this project.
          </p>
          <label htmlFor="sheet-proj-move" className="text-sm font-medium text-black/80">
            Move recordings to
          </label>
          <select
            id="sheet-proj-move"
            value={moveTargetId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setMoveTargetId(v === "" ? null : v);
            }}
            disabled={saving}
            className="w-full rounded-[10px] border border-[#D9D7CA] bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
          >
            <option value="">Inbox (unassigned)</option>
            {otherProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3 text-[13px]">
            <button
              type="button"
              disabled={saving}
              onClick={goDeleteConfirm}
              className="font-medium text-black/85 underline underline-offset-2"
            >
              Continue
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
          <p className="text-sm leading-relaxed text-neutral-800">
            {recordingCount === 0
              ? `Delete “${project.name}”? This cannot be undone.`
              : `Delete “${project.name}” and move ${recordingCount} recording${recordingCount === 1 ? "" : "s"} to ${destinationSummary}? This cannot be undone.`}
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3 text-[13px]">
            <button
              type="button"
              disabled={saving}
              onClick={() => void runDeleteProject()}
              className="font-medium text-red-800 underline underline-offset-2 disabled:opacity-50"
            >
              {saving ? "Deleting…" : "Delete project"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setError(null);
                setPhase(recordingCount > 0 ? "deletePickTarget" : "menu");
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
