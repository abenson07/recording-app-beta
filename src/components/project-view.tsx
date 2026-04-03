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
  useMemo,
  useRef,
  useState,
} from "react";

export function ProjectView({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<RecordingProjectRow | null>(null);
  const [folders, setFolders] = useState<RecordingProjectFolderRow[]>([]);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const greetingName = "there";
  const [notFound, setNotFound] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const projectUploadRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [savingFolder, setSavingFolder] = useState(false);

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
      setFolders([]);
      setItems([]);
      setLoading(false);
      return;
    }

    setNotFound(false);
    setProject(proj as RecordingProjectRow);

    const [{ data: folderRows }, { data: itemRows }] = await Promise.all([
      supabase
        .from("recording_project_folders")
        .select("id, project_id, name, summary, created_at, updated_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("recording_items")
        .select(
          "id, title, created_at, updated_at, project_id, folder_id, recording_files (id, sequence_index, transcript, storage_path, duration, created_at)",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    setFolders((folderRows as RecordingProjectFolderRow[]) ?? []);
    setItems((itemRows as RecordingItemRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  const countsByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of folders) {
      map.set(f.id, 0);
    }
    for (const i of items) {
      if (i.folder_id) {
        map.set(i.folder_id, (map.get(i.folder_id) ?? 0) + 1);
      }
    }
    return map;
  }, [folders, items]);

  /** Folders and recordings without a folder, newest first. */
  const listRows = useMemo(() => {
    type Row =
      | { kind: "folder"; id: string; at: string; folder: RecordingProjectFolderRow }
      | { kind: "recording"; id: string; at: string; item: RecordingItemRow };
    const rows: Row[] = [];
    for (const f of folders) {
      rows.push({
        kind: "folder",
        id: `f-${f.id}`,
        at: f.updated_at ?? f.created_at,
        folder: f,
      });
    }
    for (const i of items) {
      if (i.folder_id) continue;
      rows.push({
        kind: "recording",
        id: `r-${i.id}`,
        at: i.updated_at ?? i.created_at,
        item: i,
      });
    }
    rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return rows;
  }, [folders, items]);

  const [addingFolder, setAddingFolder] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name || savingFolder) return;

    setFolderError(null);
    setSavingFolder(true);
    const supabase = createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setFolderError(userErr?.message ?? "You need to be signed in to create a folder.");
      setSavingFolder(false);
      return;
    }

    const { error: insErr } = await supabase.from("recording_project_folders").insert({
      project_id: projectId,
      user_id: userData.user.id,
      name,
    });

    setSavingFolder(false);
    if (insErr) {
      setFolderError(insErr.message);
      return;
    }
    setNewFolderName("");
    setAddingFolder(false);
    await load();
  };

  const cancelAddFolder = () => {
    setAddingFolder(false);
    setNewFolderName("");
    setFolderError(null);
  };

  const handleProjectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!project) {
      setUploadError("Project is still loading. Try again in a moment.");
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
    project?.summary?.trim() ||
    items
      .flatMap((i) => i.recording_files ?? [])
      .map((f) => f.transcript?.trim() ?? "")
      .find(Boolean) ||
    "Add a project description to capture the context for this recording set.";

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
        <p className="text-white/80">Project not found.</p>
        <Link
          href="/"
          className="mt-4 text-sm font-medium text-[#D35400] underline"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#d7d5c8] px-4 pb-28 pt-24 text-[#1e1e1e]">
      <section>
        <p
          className="text-[24px] leading-[31px] text-[#1E1E1E]"
          style={{ fontFamily: "var(--font-instrument-serif), serif" }}
        >
          {project?.name ?? "Project name"}
        </p>
        <div
          className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/75"
          style={{
            fontFamily: "var(--font-instrument-sans), sans-serif",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          {project && !loading ? (
            <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
              <span className="shrink-0">
                {items.length} recording{items.length === 1 ? "" : "s"}
                {folders.length > 0
                  ? ` · ${folders.length} folder${folders.length === 1 ? "" : "s"}`
                  : ""}
              </span>
              <span className="min-w-0">
                {formatRelativeTime(project.created_at)}
              </span>
            </span>
          ) : null}
          <span>·</span>
          <span>Hello {greetingName}</span>
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
          <span className="font-medium">Description: </span>
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
        <div className="flex items-baseline justify-between gap-3">
          <AppSectionLabel>Recordings</AppSectionLabel>
          <button
            type="button"
            onClick={() => {
              if (addingFolder) {
                cancelAddFolder();
              } else {
                setFolderError(null);
                setAddingFolder(true);
                window.setTimeout(() => newFolderInputRef.current?.focus(), 0);
              }
            }}
            disabled={loading}
            className="shrink-0 text-[13px] font-medium text-black/55 underline decoration-black/25 underline-offset-2 transition-colors hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add folder
          </button>
        </div>

        {addingFolder ? (
          <form
            onSubmit={handleCreateFolder}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
          >
            <label htmlFor="new-folder-name" className="sr-only">
              Folder name
            </label>
            <input
              ref={newFolderInputRef}
              id="new-folder-name"
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              disabled={savingFolder}
              className="min-h-[40px] flex-1 rounded-[10px] border border-[#D9D7CA] bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
            />
            <div className="flex items-center gap-3 text-[13px]">
              <button
                type="submit"
                disabled={savingFolder || !newFolderName.trim()}
                className="font-medium text-black/80 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingFolder ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={cancelAddFolder}
                disabled={savingFolder}
                className="text-black/50 underline underline-offset-2 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        {folderError ? (
          <p className="text-sm text-red-600">{folderError}</p>
        ) : null}

        {uploadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {uploadError}
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : listRows.length === 0 ? (
            <li className="rounded-[10px] bg-[#EAE9E5] px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
              No folders or recordings here yet.
            </li>
          ) : (
            listRows.map((row) => {
              if (row.kind === "folder") {
                const f = row.folder;
                const n = countsByFolder.get(f.id) ?? 0;
                return (
                  <li key={row.id}>
                    <ActivityCard
                      variant="project"
                      href={`/project/${projectId}/folder/${f.id}`}
                      title={f.name}
                      subtitle={`${n} recording${n === 1 ? "" : "s"} · ${formatRelativeTime(f.created_at)}`}
                    />
                  </li>
                );
              }
              const item = row.item;
              const touchIso = item.updated_at ?? item.created_at;
              const segs = segmentCount(item);
              const dur = formatDurationClock(totalDurationSec(item));
              return (
                <li key={row.id}>
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
        ref={projectUploadRef}
        type="file"
        className="sr-only"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        onChange={handleProjectUpload}
      />
      <FloatingNav
        onUploadClick={() => {
          if (!uploading && project) projectUploadRef.current?.click();
        }}
      />
    </div>
  );
}
