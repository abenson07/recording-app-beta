"use client";

import { createClient } from "@/lib/supabase/client";
import { useRecordingSession } from "@/lib/use-recording-session";
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
  AppContentSheet,
  AppScreenHeader,
  AppSectionLabel,
} from "@/components/app-screen";
import { FloatingNav } from "@/components/floating-nav";
import { ListRowCardStatic, WaveformGlyph } from "@/components/list-row-card";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function sortedFiles(files: RecordingFileRow[] | null | undefined): RecordingFileRow[] {
  return [...(files ?? [])].sort((a, b) => a.sequence_index - b.sequence_index);
}

export function RecordingDetailView({ recordingId }: { recordingId: string }) {
  const { ready: authReady, authError } = useRecordingSession();
  const [item, setItem] = useState<RecordingItemRow | null>(null);
  const [project, setProject] = useState<RecordingProjectRow | null>(null);
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [updatingProject, setUpdatingProject] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setItem(null);
      setProject(null);
      setProjects([]);
      setLoading(false);
      return;
    }

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

  useEffect(() => {
    if (!authReady) return;
    load();
  }, [authReady, load]);

  if (!authReady) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-24">
        <p className="text-sm text-white/60">Signing in…</p>
      </div>
    );
  }

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

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#1A1A1A]">
      {authError ? (
        <p className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {authError}
        </p>
      ) : null}

      <AppScreenHeader
        greeting={project?.name ?? "Inbox"}
        title={item?.title ?? "Recording"}
        meta={metaLine}
      />

      <AppContentSheet>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
          <Link href="/" className="font-medium text-[#C2410C] hover:underline">
            Home
          </Link>
          {project ? (
            <>
              <span className="text-neutral-300">·</span>
              <Link
                href={`/project/${project.id}`}
                className="font-medium text-[#C2410C] hover:underline"
              >
                {project.name}
              </Link>
            </>
          ) : null}
        </div>

        {!loading && item ? (
          <section className="flex flex-col gap-2">
            <AppSectionLabel>Project</AppSectionLabel>
            <div className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-black/[0.06]">
              <label htmlFor="recording-project" className="sr-only">
                Project
              </label>
              <select
                id="recording-project"
                value={item.project_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  void handleProjectChange(v === "" ? null : v);
                }}
                disabled={updatingProject}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-[#D35400]/35 disabled:opacity-50"
              >
                <option value="">Unassigned (inbox)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {projects.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-500">
                  No projects yet. Create one from the home screen.
                </p>
              ) : null}
              {projectError ? (
                <p className="mt-2 text-sm text-red-600">{projectError}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <AppSectionLabel>Segments</AppSectionLabel>
          <ul className="flex flex-col gap-3">
            {!authReady || loading ? (
              <li className="text-sm text-neutral-500">Loading…</li>
            ) : files.length === 0 ? (
              <li className="rounded-2xl bg-white/80 px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
                No segments yet. Add a recording to create segments.
              </li>
            ) : (
              files.map((f, idx) => {
                const segDate = f.created_at ?? item!.created_at;
                return (
                  <li key={f.id}>
                    <ListRowCardStatic
                      title={`Segment ${idx + 1}`}
                      subtitle={`${formatRelativeTime(segDate)} · ${formatDurationClock(f.duration ?? 0)}`}
                      icon={<WaveformGlyph />}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </AppContentSheet>

      <FloatingNav
        centerHref={`/record?append=${encodeURIComponent(recordingId)}`}
      />
    </div>
  );
}
