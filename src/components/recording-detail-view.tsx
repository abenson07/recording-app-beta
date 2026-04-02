"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  RecordingFileRow,
  RecordingItemRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import {
  formatDurationClock,
  formatRelativeTime,
} from "@/lib/recording-types";
import {
  AppSectionLabel,
} from "@/components/app-screen";
import { FloatingNav } from "@/components/floating-nav";
import { ListRowCardStatic, WaveformGlyph } from "@/components/list-row-card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function sortedFiles(files: RecordingFileRow[] | null | undefined): RecordingFileRow[] {
  return [...(files ?? [])].sort((a, b) => a.sequence_index - b.sequence_index);
}

export function RecordingDetailView({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [item, setItem] = useState<RecordingItemRow | null>(null);
  const [project, setProject] = useState<RecordingProjectRow | null>(null);
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [updatingProject, setUpdatingProject] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setProjectError(null);

    const [itemRes, projectsRes] = await Promise.all([
      supabase
        .from("recording_items")
        .select(
          "id, title, created_at, updated_at, project_id, recording_files (id, sequence_index, transcript, storage_path, duration, created_at)",
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
      const { data: proj } = await supabase
        .from("recording_projects")
        .select("id, name, summary, created_at")
        .eq("id", rec.project_id)
        .maybeSingle();
      setProject((proj as RecordingProjectRow) ?? null);
    } else {
      setProject(null);
    }

    setLoading(false);
  }, [recordingId]);

  const handleProjectChange = async (nextProjectId: string | null) => {
    if (!item) return;
    setProjectError(null);
    setUpdatingProject(true);

    const prevItem = item;
    const prevProject = project;
    const nextProj =
      nextProjectId === null
        ? null
        : (projects.find((p) => p.id === nextProjectId) ?? null);

    setItem({ ...item, project_id: nextProjectId });
    setProject(nextProj);

    const supabase = createClient();
    const { error } = await supabase
      .from("recording_items")
      .update({ project_id: nextProjectId })
      .eq("id", item.id);

    if (error) {
      setProjectError(error.message);
      setItem(prevItem);
      setProject(prevProject);
    }

    setUpdatingProject(false);
  };

  const handleRename = async () => {
    if (!item) return;
    const next = draftTitle.trim();
    if (!next) {
      setTitleError("Name cannot be empty.");
      return;
    }
    if (next === (item.title ?? "").trim()) {
      setRenaming(false);
      setTitleError(null);
      return;
    }

    setTitleError(null);
    setRenaming(true);
    const prev = item.title ?? "";
    setItem({ ...item, title: next });

    const supabase = createClient();
    const { error } = await supabase
      .from("recording_items")
      .update({ title: next })
      .eq("id", item.id);

    if (error) {
      setTitleError(error.message);
      setItem({ ...item, title: prev });
      setRenaming(false);
      return;
    }

    setRenaming(false);
  };

  const handleCreateProjectFromRecording = async () => {
    if (!item) return;

    setProjectError(null);
    setCreatingProject(true);

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
      setProjectError(createErr?.message ?? "Failed to create project.");
      setCreatingProject(false);
      return;
    }

    const { error: moveErr } = await supabase
      .from("recording_items")
      .update({ project_id: createdProject.id })
      .eq("id", item.id);

    if (moveErr) {
      setProjectError(moveErr.message);
      setCreatingProject(false);
      return;
    }

    const newProject = createdProject as RecordingProjectRow;
    setProjects((prev) => [newProject, ...prev]);
    setProject(newProject);
    setItem((prev) => (prev ? { ...prev, project_id: newProject.id } : prev));
    setShowMoveOptions(false);
    setCreatingProject(false);
    router.push(`/project/${newProject.id}`);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
  const outputPreview = files
    .map((f) => f.transcript?.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 220);

  const activeProjectName = project?.name ?? "Unassigned (inbox)";

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-[#d7d5c8] px-4 pb-28 pt-24 text-[#1e1e1e]">
      <section>
        <p
          className="text-[30px] leading-[1.08]"
          style={{ fontFamily: "var(--font-instrument-serif), serif" }}
        >
          {item?.title ?? "Recording outputs"}
        </p>
        <div
          className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/65"
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
          <AppSectionLabel>Output summary</AppSectionLabel>
          <p className="text-sm leading-relaxed text-black/70">
            {loading
              ? "Loading outputs..."
              : outputPreview.length > 0
                ? `${outputPreview}${outputPreview.length >= 220 ? "…" : ""}`
                : "No transcript output yet. Add another recording segment to generate outputs."}
          </p>
        </section>

        {!loading && item ? (
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setShowMoveOptions((v) => !v)}
                className="text-black/75 underline underline-offset-2"
              >
                Move recording
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftTitle(item.title ?? "");
                  setTitleError(null);
                  setRenaming((v) => !v);
                }}
                className="text-black/75 underline underline-offset-2"
              >
                Rename recording
              </button>
            </div>

            {showMoveOptions ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-black/65">
                  Current project: {activeProjectName}
                </p>
                <button
                  type="button"
                  onClick={() => void handleCreateProjectFromRecording()}
                  disabled={creatingProject || updatingProject}
                  className="w-fit text-sm text-black/75 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingProject ? "Creating project..." : "Move to new project"}
                </button>
                <label htmlFor="recording-project" className="sr-only">
                  Move recording to project
                </label>
                <select
                  id="recording-project"
                  value={item.project_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    void handleProjectChange(v === "" ? null : v);
                  }}
                  disabled={updatingProject}
                  className="w-full rounded-[10px] border border-[#D9D7CA] bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
                >
                  <option value="">Unassigned (inbox)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {renaming ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="recording-title" className="sr-only">
                  Recording name
                </label>
                <input
                  id="recording-title"
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Recording name"
                  className="w-full rounded-[10px] border border-[#D9D7CA] bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                />
                <div className="flex items-center gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => void handleRename()}
                    className="text-black/75 underline underline-offset-2"
                  >
                    Save name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(false);
                      setTitleError(null);
                    }}
                    className="text-black/50 underline underline-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {projects.length === 0 && showMoveOptions ? (
              <p className="text-xs text-neutral-500">
                No projects yet. Create one from the home screen.
              </p>
            ) : null}
            {projectError ? (
              <p className="text-sm text-red-600">{projectError}</p>
            ) : null}
            {titleError ? (
              <p className="text-sm text-red-600">{titleError}</p>
            ) : null}
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <AppSectionLabel>Outputs</AppSectionLabel>
          <ul className="flex flex-col gap-3">
            {loading ? (
              <li className="text-sm text-black/55">Loading…</li>
            ) : files.length === 0 ? (
              <li className="rounded-[10px] bg-[#EAE9E5] px-4 py-4 text-sm text-black/60">
                No outputs yet. Add a recording to create segments.
              </li>
            ) : (
              files.map((f, idx) => {
                const segDate = f.created_at ?? item!.created_at;
                return (
                  <li key={f.id}>
                    <ListRowCardStatic
                      title={`Output ${idx + 1}`}
                      subtitle={`${formatRelativeTime(segDate)} · ${formatDurationClock(f.duration ?? 0)}`}
                      icon={<WaveformGlyph />}
                      className="bg-white shadow-none ring-0"
                    />
                    {f.transcript?.trim() ? (
                      <p className="mt-2 rounded-[10px] border border-[#D9D7CA] bg-[#FBFBF9] px-3 py-2.5 text-sm leading-relaxed text-black/70">
                        {f.transcript.trim()}
                      </p>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </section>

      <FloatingNav centerHref={`/record?append=${encodeURIComponent(recordingId)}`} />
    </div>
  );
}
