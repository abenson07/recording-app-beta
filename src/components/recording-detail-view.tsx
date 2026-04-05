"use client";

import { createClient } from "@/lib/supabase/client";
import { persistRecordingBlob } from "@/lib/persist-recording";
import type {
  RecordingFileRow,
  RecordingItemRow,
  RecordingProjectFolderRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import { combineRecordingFileTranscripts } from "@/lib/recording-combine";
import {
  fileDisplayTitle,
  formatDurationClock,
  formatRelativeTime,
  displayNameFromFileName,
} from "@/lib/recording-types";
import {
  AppSectionLabel,
} from "@/components/app-screen";
import { TranscriptMarkdownSummary } from "@/components/transcript-markdown-summary";
import { FloatingNav } from "@/components/floating-nav";
import { ActivityCard } from "@/components/activity-card";
import { RecordingFileActionsSheet } from "@/components/recording-file-actions-sheet";
import { RecordingItemActionsSheet } from "@/components/recording-item-actions-sheet";
import { useLongPress } from "@/hooks/use-long-press";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function sortedFiles(files: RecordingFileRow[] | null | undefined): RecordingFileRow[] {
  return [...(files ?? [])].sort((a, b) => a.sequence_index - b.sequence_index);
}

export function RecordingDetailView({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [item, setItem] = useState<RecordingItemRow | null>(null);
  const [project, setProject] = useState<RecordingProjectRow | null>(null);
  const [folder, setFolder] = useState<RecordingProjectFolderRow | null>(null);
  const [projectFolders, setProjectFolders] = useState<RecordingProjectFolderRow[]>(
    [],
  );
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [fileSheetFile, setFileSheetFile] = useState<RecordingFileRow | null>(
    null,
  );
  const detailUploadRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const [itemRes, projectsRes] = await Promise.all([
      supabase
        .from("recording_items")
        .select(
          "id, title, created_at, updated_at, project_id, folder_id, recording_files (id, sequence_index, title, transcript, storage_path, duration, created_at)",
        )
        .eq("id", recordingId)
        .maybeSingle(),
      supabase
        .from("recording_projects")
        .select("id, name, summary, created_at")
        .order("name", { ascending: true }),
    ]);

    const row = itemRes.data;
    const error = itemRes.error;

    setProjects((projectsRes.data as RecordingProjectRow[]) ?? []);

    if (error || !row) {
      setNotFound(true);
      setItem(null);
      setProject(null);
      setLoading(false);
      return;
    }

    setNotFound(false);
    const rec = row as RecordingItemRow;
    setItem(rec);

    if (rec.project_id) {
      const [{ data: proj }, { data: folderRows }] = await Promise.all([
        supabase
          .from("recording_projects")
          .select("id, name, summary, created_at")
          .eq("id", rec.project_id)
          .maybeSingle(),
        supabase
          .from("recording_project_folders")
          .select("id, project_id, name, summary, created_at, updated_at")
          .eq("project_id", rec.project_id)
          .order("name", { ascending: true }),
      ]);
      setProject((proj as RecordingProjectRow) ?? null);
      const flist = (folderRows as RecordingProjectFolderRow[]) ?? [];
      setProjectFolders(flist);
      if (rec.folder_id) {
        const f = flist.find((x) => x.id === rec.folder_id) ?? null;
        setFolder(f);
      } else {
        setFolder(null);
      }
    } else {
      setProject(null);
      setFolder(null);
      setProjectFolders([]);
    }

    setLoading(false);
  }, [recordingId]);

  const handleAppendUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!item) {
      setUploadError("Recording is still loading. Try again in a moment.");
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
        appendToItemId: recordingId,
        items: [item],
        newItemProjectId: "",
        projects: [],
      },
    );
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    await load();
  };

  const handleCreateProjectFromRecording = async () => {
    if (!item) throw new Error("Recording not loaded");

    const supabase = createClient();
    const baseTitle = (item.title ?? "").trim() || "Recording";
    const nextProjectName = `${baseTitle} project`;

    const { data: createdProject, error: createErr } = await supabase
      .from("recording_projects")
      .insert({
        name: nextProjectName,
      })
      .select("id, name, summary, created_at")
      .single();

    if (createErr || !createdProject) {
      throw new Error(createErr?.message ?? "Failed to create project.");
    }

    const { error: moveErr } = await supabase
      .from("recording_items")
      .update({ project_id: createdProject.id, folder_id: null })
      .eq("id", item.id);

    if (moveErr) {
      throw new Error(moveErr.message);
    }

    const newProject = createdProject as RecordingProjectRow;
    setProjects((prev) => [newProject, ...prev]);
    setProject(newProject);
    setFolder(null);
    setProjectFolders([]);
    setItem((prev) =>
      prev ? { ...prev, project_id: newProject.id, folder_id: null } : prev,
    );
    router.push(`/project/${newProject.id}`);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const titleLongPress = useLongPress({
    onLongPress: () => setItemSheetOpen(true),
  });

  if (notFound && !loading) {
    return (
      <div className="flex flex-1 flex-col bg-[#1A1A1A] px-5 py-10">
        <p className="text-white/80">Recording not found.</p>
        <Link
          href="/"
          className="mt-4 text-sm font-medium text-[#D35400] underline"
        >
          Back home
        </Link>
      </div>
    );
  }

  const files = sortedFiles(item?.recording_files);
  const touchIso = item?.updated_at ?? item?.created_at ?? "";
  const metaLine =
    item && !loading
      ? `${formatRelativeTime(touchIso)} · ${files.length} segment${files.length === 1 ? "" : "s"}`
      : undefined;
  const outputTranscriptMarkdown = combineRecordingFileTranscripts(files);

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-[#d7d5c8] px-4 pb-28 pt-24 text-[#1e1e1e]">
      <section>
        <p className="sr-only">Long-press the title for rename, move, or delete</p>
        <div
          className="select-none"
          onPointerDown={titleLongPress.onPointerDown}
          onPointerUp={titleLongPress.onPointerUp}
          onPointerCancel={titleLongPress.onPointerCancel}
          onPointerLeave={titleLongPress.onPointerLeave}
          onClick={() => titleLongPress.consumeClick()}
        >
          <p
            className="text-[30px] leading-[1.08]"
            style={{ fontFamily: "var(--font-instrument-serif), serif" }}
          >
            {item?.title ?? "Recording outputs"}
          </p>
        </div>
        <div
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-black/65"
          style={{
            fontFamily: "var(--font-instrument-sans), sans-serif",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          <Link href="/" className="font-medium text-black/75 hover:underline">
            Home
          </Link>
          {project ? (
            <>
              <span>·</span>
              <Link href={`/project/${project.id}`} className="font-medium text-black/75 hover:underline">
                {project.name}
              </Link>
              {folder ? (
                <>
                  <span>·</span>
                  <Link
                    href={`/project/${project.id}/folder/${folder.id}`}
                    className="font-medium text-black/75 hover:underline"
                  >
                    {folder.name}
                  </Link>
                </>
              ) : null}
            </>
          ) : (
            <>
              <span>·</span>
              <span>Inbox</span>
            </>
          )}
          {metaLine ? (
            <>
              <span>·</span>
              <span>{metaLine}</span>
            </>
          ) : null}
        </div>
      </section>

      <section className="mt-7 flex flex-col gap-4">

        <section className="flex flex-col gap-2">
          <AppSectionLabel>Transcript</AppSectionLabel>
          <TranscriptMarkdownSummary
            markdown={outputTranscriptMarkdown}
            loading={loading}
            emptyMessage="No transcript output yet. Add another recording segment to generate outputs."
          />
        </section>

        <section className="flex flex-col gap-3">
          <AppSectionLabel>Recording files</AppSectionLabel>
          <ul className="flex flex-col gap-3">
            {loading ? (
              <li className="text-sm text-black/55">Loading…</li>
            ) : files.length === 0 ? (
              <li className="rounded-[10px] bg-[#EAE9E5] px-4 py-4 text-sm text-black/60">
                No recording files yet. Append audio or video to add more files.
              </li>
            ) : (
              files.map((f) => {
                const segDate = f.created_at ?? item!.created_at;
                const displayTitle = fileDisplayTitle(f);
                return (
                  <li key={f.id}>
                    <ActivityCard
                      variant="recording"
                      state="default"
                      title={displayTitle}
                      subtitle={`${formatRelativeTime(segDate)} · ${formatDurationClock(f.duration ?? 0)}`}
                      onLongPress={() => setFileSheetFile(f)}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </section>

      {uploadError ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {uploadError}
        </p>
      ) : null}

      <input
        ref={detailUploadRef}
        type="file"
        className="sr-only"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        onChange={handleAppendUpload}
      />
      <FloatingNav
        onUploadClick={() => {
          if (!uploading && item) detailUploadRef.current?.click();
        }}
      />

      <RecordingItemActionsSheet
        open={itemSheetOpen}
        onClose={() => setItemSheetOpen(false)}
        item={item}
        projects={projects}
        showDelete
        onUpdated={() => void load()}
        onDeleted={() => {
          if (!item) return;
          const dest =
            item.project_id && item.folder_id
              ? `/project/${item.project_id}/folder/${item.folder_id}`
              : item.project_id
                ? `/project/${item.project_id}`
                : "/";
          router.push(dest);
        }}
        onMoveToNewProject={handleCreateProjectFromRecording}
      />
      <RecordingFileActionsSheet
        open={fileSheetFile !== null}
        onClose={() => setFileSheetFile(null)}
        file={fileSheetFile}
        onUpdated={() => void load()}
      />
    </div>
  );
}
