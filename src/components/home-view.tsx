"use client";

import { createClient } from "@/lib/supabase/client";
import { persistRecordingBlob } from "@/lib/persist-recording";
import { useRecordingSession } from "@/lib/use-recording-session";
import type {
  RecordingItemRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import { formatRelativeTime } from "@/lib/recording-types";
import { ActivityCard } from "@/components/activity-card";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const ICON_EQUALIZER = "https://www.figma.com/api/mcp/asset/d87ebf13-3af2-4601-90bd-7d87610d0018";
const ICON_TIMER = "https://www.figma.com/api/mcp/asset/814a95be-8f70-46ec-8c64-1ff9a7ec562a";
const ICON_AIRPLAY = "https://www.figma.com/api/mcp/asset/ccc9bca5-16f5-4d5f-81ef-ce9910ec72a3";
const ICON_UPLOAD = "https://www.figma.com/api/mcp/asset/c96ac8c5-5a91-491d-8556-96c9339536dc";
const ICON_ACTIVITY = "https://www.figma.com/api/mcp/asset/c0076f22-1950-4542-9653-f9178f775e57";

export function HomeView() {
  const { ready: authReady, authError } = useRecordingSession();
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const homeUploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setProjects([]);
      setItems([]);
      setLoading(false);
      return;
    }

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

  const handleHomeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !authReady) return;

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
    if (!authReady) return;
    load();
  }, [authReady, load]);

  const itemsByProjectCount = useCallback(
    (projectId: string) => items.filter((i) => i.project_id === projectId).length,
    [items],
  );

  const recentActivity = [
    ...items.map((item) => ({
      id: item.id,
      type: "recording" as const,
      href: `/recording/${item.id}`,
      title: item.title ?? "Recording",
      subtitle: `${formatRelativeTime(item.created_at)} - 2:49`,
      at: Date.parse(item.created_at),
    })),
    ...projects.map((project) => {
      const count = itemsByProjectCount(project.id);
      return {
        id: project.id,
        type: "project" as const,
        href: `/project/${project.id}`,
        title: project.name || "Project Name",
        subtitle: `${formatRelativeTime(project.created_at)} - ${count} recording${count === 1 ? "" : "s"}`,
        at: Date.parse(project.created_at),
      };
    }),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  if (authError) {
    return (
      <div className="flex flex-1 flex-col px-5 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {authError}
        </p>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-24">
        <p className="text-sm text-black/60">Signing in...</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-[#d7d5c8] px-4 pb-28 pt-24 text-[#1e1e1e]">
      <section>
        <p
          className="text-[24px] leading-[1.2]"
          style={{ fontFamily: "var(--font-instrument-serif), serif" }}
        >
          Good afternoon, Benson. Last time we talked about your roadtrip back to
          Seattle, the best way to structure agentic coding, and a new idea for
          your book.
        </p>
        <div
          className="mt-4 flex items-center gap-4 text-[14px] text-black/70"
          style={{
            fontFamily: "var(--font-instrument-sans), sans-serif",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          <div className="flex items-center gap-2">
            <img src={ICON_EQUALIZER} alt="" className="h-[18px] w-[18px]" />
            <span>38 projects</span>
          </div>
          <div className="flex items-center gap-2">
            <img src={ICON_TIMER} alt="" className="h-[18px] w-[18px]" />
            <span>3 hours this month</span>
          </div>
        </div>
      </section>

      <section className="mt-[44px]">
        <h2
          className="mb-3 text-[14px] text-black/70"
          style={{
            fontFamily: "var(--font-instrument-sans), sans-serif",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          Recent activity
        </h2>

        {uploadError ? (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {uploadError}
          </p>
        ) : null}

        {!authReady || loading ? (
          <p className="text-sm text-black/55">Loading…</p>
        ) : recentActivity.length === 0 ? (
          <p className="rounded-[10px] bg-[#eae9e5] px-4 py-4 text-sm text-black/60">
            No recordings or projects yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {recentActivity.map((entry) => (
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
        ref={homeUploadRef}
        type="file"
        className="sr-only"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        onChange={handleHomeUpload}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[70px] bg-gradient-to-b from-[rgba(215,213,200,0)] to-[#d7d5c8]" />

      <nav className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-[64px] bg-black px-[10px] py-[4.8px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3">
          <Link
            href="/record"
            className="flex h-10 w-10 items-center justify-center rounded-[48px] bg-[rgba(247,247,247,0.2)] p-1"
            aria-label="Record"
          >
            <img src={ICON_AIRPLAY} alt="" className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!uploading) homeUploadRef.current?.click();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-[48px] p-1"
            aria-label="Upload"
          >
            <img src={ICON_UPLOAD} alt="" className="h-[18px] w-[18px]" />
          </button>
          <Link
            href="/recordings"
            className="flex h-10 w-10 items-center justify-center rounded-[48px] p-1"
            aria-label="Recordings"
          >
            <img src={ICON_ACTIVITY} alt="" className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </nav>
    </div>
  );
}
