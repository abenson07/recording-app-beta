"use client";

import { createClient } from "@/lib/supabase/client";
import { persistRecordingBlob } from "@/lib/persist-recording";
import type {
  RecordingItemRow,
  RecordingProjectFolderRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import { combineRecordingFileTranscripts } from "@/lib/recording-combine";
import {
  displayNameFromFileName,
  formatDurationClock,
  formatRelativeTime,
  segmentCount,
  totalDurationSec,
} from "@/lib/recording-types";
import { AppSectionLabel } from "@/components/app-screen";
import { FloatingNav } from "@/components/floating-nav";
import { ActivityCard } from "@/components/activity-card";
import { RecordingItemActionsSheet } from "@/components/recording-item-actions-sheet";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export function ProjectFolderView({
  projectId,
  folderId,
}: {
  projectId: string;
  folderId: string;
}) {
  const [project, setProject] = useState<RecordingProjectRow | null>(null);
  const [folder, setFolder] = useState<RecordingProjectFolderRow | null>(null);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const [siblingFolders, setSiblingFolders] = useState<
    RecordingProjectFolderRow[]
  >([]);
  const [deletePhase, setDeletePhase] = useState<"idle" | "choose" | "confirm">(
    "idle",
  );
  /** Where to file recordings before removing this folder: null = project root. */
  const [moveToFolderId, setMoveToFolderId] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [deleteFolderError, setDeleteFolderError] = useState<string | null>(
    null,
  );
  const [recordingSheetItem, setRecordingSheetItem] =
    useState<RecordingItemRow | null>(null);
  const [allProjects, setAllProjects] = useState<RecordingProjectRow[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const { data: proj, error: projErr } = await supabase
      .from("recording_projects")
      .select("id, name, summary, created_at")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !proj) {
      setNotFound(true);
      setProject(null);
      setFolder(null);
      setItems([]);
      setAllProjects([]);
      setLoading(false);
      return;
    }

    const { data: fol, error: folErr } = await supabase
      .from("recording_project_folders")
      .select("id, project_id, name, summary, created_at, updated_at")
      .eq("id", folderId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (folErr || !fol) {
      setNotFound(true);
      setProject(proj as RecordingProjectRow);
      setFolder(null);
      setItems([]);
      setAllProjects([]);
      setLoading(false);
      return;
    }

    setNotFound(false);
    setProject(proj as RecordingProjectRow);
    setFolder(fol as RecordingProjectFolderRow);

    const { data: siblingRows } = await supabase
      .from("recording_project_folders")
      .select("id, project_id, name, summary, created_at, updated_at")
      .eq("project_id", projectId)
      .neq("id", folderId)
      .order("created_at", { ascending: true });

    setSiblingFolders((siblingRows as RecordingProjectFolderRow[]) ?? []);

    const [{ data: itemRows }, { data: allProjRows }] = await Promise.all([
      supabase
        .from("recording_items")
        .select(
          "id, title, created_at, updated_at, project_id, folder_id, recording_files (id, sequence_index, title, transcript, storage_path, duration, created_at)",
        )
        .eq("project_id", projectId)
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false }),
      supabase
        .from("recording_projects")
        .select("id, name, summary, created_at")
        .order("name", { ascending: true }),
    ]);

    setItems((itemRows as RecordingItemRow[]) ?? []);
    setAllProjects((allProjRows as RecordingProjectRow[]) ?? []);
    setLoading(false);
  }, [projectId, folderId]);

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!project || !folder) {
      setUploadError("Folder is still loading. Try again in a moment.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    const supabase = createClient();
    const result = await persistRecordingBlob(
      supabase,
      file,
      {
        contentType: file.type || "application/octet-stream",
        durationSec: null,
        captureType: "file_upload",
        recordingFileTitle: displayNameFromFileName(file.name),
      },
      {
        appendToItemId: null,
        items,
        newItemProjectId: projectId,
        projects: [project],
        newItemFolderId: folderId,
        folders: [folder],
      },
    );
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    await load();
  };

  const closeDeleteFlow = () => {
    setDeletePhase("idle");
    setDeleteFolderError(null);
    setMoveToFolderId(null);
  };

  const startDeleteFolder = () => {
    setDeleteFolderError(null);
    if (items.length === 0) {
      setDeletePhase("confirm");
      return;
    }
    setMoveToFolderId(
      siblingFolders.length > 0 ? siblingFolders[0].id : null,
    );
    setDeletePhase("choose");
  };

  const goToConfirmAfterChoose = () => {
    setDeleteFolderError(null);
    setDeletePhase("confirm");
  };

  const destinationLabel =
    moveToFolderId === null
      ? "Project (no folder)"
      : siblingFolders.find((f) => f.id === moveToFolderId)?.name ??
        "Another folder";

  const runDeleteFolder = async () => {
    if (!folder) return;
    setDeletingFolder(true);
    setDeleteFolderError(null);
    const supabase = createClient();

    if (items.length > 0) {
      const { error: moveErr } = await supabase
        .from("recording_items")
        .update({ folder_id: moveToFolderId })
        .eq("project_id", projectId)
        .eq("folder_id", folderId);

      if (moveErr) {
        setDeleteFolderError(moveErr.message);
        setDeletingFolder(false);
        return;
      }
    }

    const { error: delErr } = await supabase
      .from("recording_project_folders")
      .delete()
      .eq("id", folderId)
      .eq("project_id", projectId);

    setDeletingFolder(false);
    if (delErr) {
      setDeleteFolderError(delErr.message);
      return;
    }
    closeDeleteFlow();
    router.push(`/project/${projectId}`);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const descriptionText =
    folder?.summary?.trim() ||
    items
      .map((i) => combineRecordingFileTranscripts(i.recording_files).trim())
      .find(Boolean) ||
    "Add a short note for this folder to keep context focused when you return.";

  useLayoutEffect(() => {
    if (descriptionExpanded) {
      return;
    }
    const el = descriptionRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      setDescriptionOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [descriptionText, descriptionExpanded, loading]);

  if (notFound && !loading) {
    return (
      <div className="flex flex-1 flex-col bg-[#1A1A1A] px-5 py-10">
        <p className="text-white/80">Folder or project not found.</p>
        <Link
          href={`/project/${projectId}`}
          className="mt-4 text-sm font-medium text-[#D35400] underline"
        >
          Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#d7d5c8] px-4 pb-28 pt-24 text-[#1e1e1e]">
      <section>
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/60"
          style={{
            fontFamily: "var(--font-instrument-sans), sans-serif",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          <Link href="/" className="font-medium text-black/70 hover:underline">
            Home
          </Link>
          <span>·</span>
          <Link
            href={`/project/${projectId}`}
            className="font-medium text-black/70 hover:underline"
          >
            {project?.name ?? "Project"}
          </Link>
        </div>
        <p
          className="mt-3 text-[24px] leading-[31px] text-[#1E1E1E]"
          style={{ fontFamily: "var(--font-instrument-serif), serif" }}
        >
          {folder?.name ?? "Folder"}
        </p>
        <div
          className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/75"
          style={{
            fontFamily: "var(--font-instrument-sans), sans-serif",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          {folder && !loading ? (
            <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
              <span className="shrink-0">
                {items.length} recording{items.length === 1 ? "" : "s"}
              </span>
              <span className="min-w-0">
                {formatRelativeTime(folder.created_at)}
              </span>
            </span>
          ) : null}
        </div>
      </section>

      <section className="mt-6">
        <p
          ref={descriptionRef}
          className={
            descriptionExpanded
              ? "text-[15px] leading-relaxed text-black/75"
              : "line-clamp-4 overflow-hidden text-[15px] leading-relaxed text-black/75"
          }
        >
          <span className="font-medium">Context: </span>
          {descriptionText}
        </p>
        {descriptionExpanded || descriptionOverflows ? (
          <button
            type="button"
            aria-expanded={descriptionExpanded}
            onClick={() => setDescriptionExpanded((v) => !v)}
            className="mt-1 inline-block text-left text-[12px] font-medium underline"
          >
            {descriptionExpanded ? "Show less" : "Read more"}
          </button>
        ) : null}
        <div className="mt-5">
          <button
            type="button"
            onClick={startDeleteFolder}
            disabled={loading || !folder}
            className="text-[13px] font-medium text-red-700/90 underline decoration-red-700/30 underline-offset-2 transition-colors hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete folder
          </button>
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <AppSectionLabel>Recordings in this folder</AppSectionLabel>
        {uploadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {uploadError}
          </p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : items.length === 0 ? (
            <li className="rounded-[10px] bg-[#EAE9E5] px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
              No recordings here yet. Upload one or move a recording from the
              project into this folder.
            </li>
          ) : (
            items.map((item) => {
              const touchIso = item.updated_at ?? item.created_at;
              const segs = segmentCount(item);
              const dur = formatDurationClock(totalDurationSec(item));
              return (
                <li key={item.id}>
                  <ActivityCard
                    variant="recording"
                    state="default"
                    href={`/recording/${item.id}`}
                    title={item.title ?? "Untitled"}
                    subtitle={`${formatRelativeTime(touchIso)} - ${dur}`}
                    onLongPress={() => setRecordingSheetItem(item)}
                  />
                  <p className="sr-only">
                    {segs} segment{segs === 1 ? "" : "s"}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <input
        ref={folderUploadRef}
        type="file"
        className="sr-only"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        onChange={handleFolderUpload}
      />
      <FloatingNav
        onUploadClick={() => {
          if (!uploading && project && folder) folderUploadRef.current?.click();
        }}
      />

      <RecordingItemActionsSheet
        open={recordingSheetItem !== null}
        onClose={() => setRecordingSheetItem(null)}
        item={recordingSheetItem}
        projects={allProjects}
        onUpdated={() => void load()}
      />

      {deletePhase !== "idle" ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="presentation"
          onClick={() => !deletingFolder && closeDeleteFlow()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-folder-dialog-title"
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-black/[0.08] bg-[#f2f1ed] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {deletePhase === "choose" ? (
              <>
                <h2
                  id="delete-folder-dialog-title"
                  className="text-lg font-medium text-[#1e1e1e]"
                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                >
                  Move recordings first
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-black/70">
                  Choose where to file{" "}
                  {items.length === 1
                    ? "this recording"
                    : `these ${items.length} recordings`}{" "}
                  before the folder is removed.
                </p>
                <label
                  htmlFor="delete-folder-move-to"
                  className="mt-4 block text-sm font-medium text-black/80"
                >
                  Move to
                </label>
                <select
                  id="delete-folder-move-to"
                  value={moveToFolderId ?? ""}
                  onChange={(e) =>
                    setMoveToFolderId(
                      e.target.value === "" ? null : e.target.value,
                    )
                  }
                  disabled={deletingFolder}
                  className="mt-1.5 w-full rounded-[10px] border border-[#D9D7CA] bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
                >
                  <option value="">Project (no folder)</option>
                  {siblingFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {deleteFolderError ? (
                  <p className="mt-3 text-sm text-red-600">{deleteFolderError}</p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px]">
                  <button
                    type="button"
                    onClick={goToConfirmAfterChoose}
                    disabled={deletingFolder}
                    className="font-medium text-black/85 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={closeDeleteFlow}
                    disabled={deletingFolder}
                    className="text-black/50 underline underline-offset-2 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="delete-folder-dialog-title"
                  className="text-lg font-medium text-[#1e1e1e]"
                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                >
                  Delete this folder?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-black/70">
                  {items.length === 0
                    ? `Delete “${folder?.name ?? "this folder"}”? This cannot be undone.`
                    : `Delete “${folder?.name ?? "this folder"}” and move ${items.length} recording${items.length === 1 ? "" : "s"} to ${destinationLabel}? This cannot be undone.`}
                </p>
                {deleteFolderError ? (
                  <p className="mt-3 text-sm text-red-600">{deleteFolderError}</p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px]">
                  <button
                    type="button"
                    onClick={() => void runDeleteFolder()}
                    disabled={deletingFolder}
                    className="font-medium text-red-800 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deletingFolder ? "Deleting…" : "Delete folder"}
                  </button>
                  {items.length > 0 && deletePhase === "confirm" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteFolderError(null);
                        setDeletePhase("choose");
                      }}
                      disabled={deletingFolder}
                      className="text-black/50 underline underline-offset-2 disabled:opacity-40"
                    >
                      Back
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closeDeleteFlow}
                    disabled={deletingFolder}
                    className="text-black/50 underline underline-offset-2 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
