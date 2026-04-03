"use client";

import { createClient } from "@/lib/supabase/client";
import { persistRecordingBlob } from "@/lib/persist-recording";
import type {
  RecordingItemRow,
  RecordingProjectFolderRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import {
  formatDurationClock,
  formatRelativeTime,
  segmentCount,
  totalDurationSec,
} from "@/lib/recording-types";
import { AppSectionLabel } from "@/components/app-screen";
import { FloatingNav } from "@/components/floating-nav";
import { ActivityCard } from "@/components/activity-card";
import Link from "next/link";
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
      setLoading(false);
      return;
    }

    setNotFound(false);
    setProject(proj as RecordingProjectRow);
    setFolder(fol as RecordingProjectFolderRow);

    const { data: itemRows } = await supabase
      .from("recording_items")
      .select(
        "id, title, created_at, updated_at, project_id, folder_id, recording_files (id, sequence_index, transcript, storage_path, duration, created_at)",
      )
      .eq("project_id", projectId)
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false });

    setItems((itemRows as RecordingItemRow[]) ?? []);
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
        newItemTitle: `Upload · ${file.name}`,
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const descriptionText =
    folder?.summary?.trim() ||
    items
      .flatMap((i) => i.recording_files ?? [])
      .map((f) => f.transcript?.trim() ?? "")
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
    </div>
  );
}
