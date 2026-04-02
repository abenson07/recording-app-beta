"use client";

import { createClient } from "@/lib/supabase/client";
import { useRecordingSession } from "@/lib/use-recording-session";
import type {
  RecordingItemRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import {
  formatDurationClock,
  formatRelativeTime,
  segmentCount,
  totalDurationSec,
} from "@/lib/recording-types";
import {
  AppContentSheet,
  AppScreenHeader,
  AppSectionLabel,
} from "@/components/app-screen";
import { FloatingNav } from "@/components/floating-nav";
import { ActivityCard } from "@/components/activity-card";
import { persistRecordingBlob } from "@/lib/persist-recording";
import { useCallback, useEffect, useRef, useState } from "react";

export function AllRecordingsView() {
  useRecordingSession();
  const greetingName = "there";
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
        .order("name", { ascending: true }),
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

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#1A1A1A]">
      <AppScreenHeader
        greeting={`Hello ${greetingName},`}
        title="All Recordings"
      />

      <AppContentSheet>
        <AppSectionLabel>All recordings</AppSectionLabel>

        {uploadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {uploadError}
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : items.length === 0 ? (
            <li className="rounded-2xl bg-white/80 px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
              No recordings yet. Tap the upload button below to add one.
            </li>
          ) : (
            items.map((item) => {
              const touchIso = item.updated_at ?? item.created_at;
              const segs = segmentCount(item);
              const dur = formatDurationClock(totalDurationSec(item));
              const project = projects.find((p) => p.id === item.project_id);
              const subtitle = `${formatRelativeTime(touchIso)} · ${dur} · ${segs} segment${segs === 1 ? "" : "s"}${project ? ` · ${project.name}` : ""}`;
              return (
                <li key={item.id}>
                  <ActivityCard
                    variant="recording"
                    state="default"
                    href={`/recording/${item.id}`}
                    title={item.title ?? "Untitled"}
                    subtitle={subtitle}
                  />
                </li>
              );
            })
          )}
        </ul>
      </AppContentSheet>

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
