"use client";

import { createClient } from "@/lib/supabase/client";
import { useRecordingSession } from "@/lib/use-recording-session";
import type { RecordingItemRow, RecordingProjectRow } from "@/lib/recording-types";
import { formatRelativeTime } from "@/lib/recording-types";
import { ActivityCard } from "@/components/activity-card";
import { FloatingNav } from "@/components/floating-nav";
import { persistRecordingBlob } from "@/lib/persist-recording";
import { useCallback, useEffect, useRef, useState } from "react";

export function AllProjectsView() {
  useRecordingSession();
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [projRes, itemsRes] = await Promise.all([
      supabase
        .from("recording_projects")
        .select("id, name, summary, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("recording_items")
        .select(
          "id, title, created_at, updated_at, project_id, recording_files (id, sequence_index, transcript, storage_path, duration, created_at)",
        )
        .order("created_at", { ascending: false }),
    ]);

    setProjects((projRes.data as RecordingProjectRow[]) ?? []);
    setItems((itemsRes.data as RecordingItemRow[]) ?? []);
    setLoading(false);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

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
        newItemProjectId: "",
        projects,
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

  const projectRecordingCounts = items.reduce(
    (acc, item) => {
      if (!item.project_id) return acc;
      acc[item.project_id] = (acc[item.project_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const rootActivity = [
    ...projects.map((project) => ({
      id: project.id,
      type: "project" as const,
      href: `/project/${project.id}`,
      title: project.name || "Project",
      subtitle: `${formatRelativeTime(project.created_at)} - ${projectRecordingCounts[project.id] ?? 0} recording${(projectRecordingCounts[project.id] ?? 0) === 1 ? "" : "s"}`,
      at: Date.parse(project.created_at),
    })),
    ...items
      .filter((item) => !item.project_id)
      .map((item) => ({
        id: item.id,
        type: "recording" as const,
        href: `/recording/${item.id}`,
        title: item.title ?? "Recording",
        subtitle: `${formatRelativeTime(item.updated_at ?? item.created_at)} - Unassigned`,
        at: Date.parse(item.updated_at ?? item.created_at),
      })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-[#d7d5c8] px-4 pb-28 pt-24 text-[#1e1e1e]">
      <section>
        <p
          className="text-[24px] leading-[1.2]"
          style={{ fontFamily: "var(--font-instrument-serif), serif" }}
        >
          All your top-level projects and unassigned recordings, in newest-first order.
        </p>
      </section>

      <section className="mt-[44px]">
        <h2
          className="mb-3 text-[14px] text-black/70"
          style={{
            fontFamily: "var(--font-instrument-sans), sans-serif",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          All projects
        </h2>

        {uploadError ? (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {uploadError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-black/55">Loading…</p>
        ) : rootActivity.length === 0 ? (
          <p className="rounded-[10px] bg-[#eae9e5] px-4 py-4 text-sm text-black/60">
            No projects or unassigned recordings yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {rootActivity.map((entry) => (
              <li key={`${entry.type}-${entry.id}`}>
                <ActivityCard
                  variant={entry.type}
                  state="default"
                  href={entry.href}
                  title={entry.title}
                  subtitle={entry.subtitle}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <input
        ref={uploadRef}
        type="file"
        className="sr-only"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        onChange={handleUpload}
      />
      <FloatingNav
        onUploadClick={() => {
          if (!uploading) uploadRef.current?.click();
        }}
      />
    </div>
  );
}
