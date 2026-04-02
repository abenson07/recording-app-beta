"use client";

import { createClient } from "@/lib/supabase/client";
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
import { AppSectionLabel } from "@/components/app-screen";
import { FloatingNav } from "@/components/floating-nav";
import { ActivityCard } from "@/components/activity-card";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function ProjectView({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<RecordingProjectRow | null>(null);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const greetingName = "there";
  const [notFound, setNotFound] = useState(false);
  const [openRecordingId, setOpenRecordingId] = useState<string | null>(null);

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
      setItems([]);
      setLoading(false);
      return;
    }

    setNotFound(false);
    setProject(proj as RecordingProjectRow);

    const { data: itemRows } = await supabase
      .from("recording_items")
      .select(
        "id, title, created_at, updated_at, project_id, recording_files (id, sequence_index, transcript, storage_path, duration, created_at)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    setItems((itemRows as RecordingItemRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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

  const metaLine =
    project && !loading
      ? `${items.length} recording${items.length === 1 ? "" : "s"}  ${formatRelativeTime(project.created_at)}`
      : undefined;

  const descriptionText =
    project?.summary?.trim() ||
    items
      .flatMap((i) => i.recording_files ?? [])
      .map((f) => f.transcript?.trim() ?? "")
      .find(Boolean) ||
    "Add a project description to capture the context for this recording set.";

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
          <span>{metaLine}</span>
          <span>·</span>
          <span>Hello {greetingName}</span>
        </div>
      </section>

      <section className="mt-6">
        <p className="text-[15px] leading-relaxed text-black/75">
          <span className="font-medium">Description: </span>
          {descriptionText}
        </p>
        <Link href="/projects" className="mt-1 inline-block text-[15px] font-medium underline">
          Read more
        </Link>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <AppSectionLabel>Recent activity</AppSectionLabel>
        <ul className="flex flex-col gap-3">
          {loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : items.length === 0 ? (
            <li className="rounded-[10px] bg-[#EAE9E5] px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
              No recordings in this project yet.
            </li>
          ) : (
            items.map((item) => {
              const touchIso = item.updated_at ?? item.created_at;
              const segs = segmentCount(item);
              const dur = formatDurationClock(totalDurationSec(item));
              const summary = item.recording_files
                ?.map((f) => f.transcript?.trim())
                .filter(Boolean)
                .join(" ")
                .slice(0, 180);
              return (
                <li key={item.id}>
                  {openRecordingId === item.id ? (
                    <ActivityCard
                      variant="recording"
                      state="open"
                      onClick={() => setOpenRecordingId(null)}
                      title={item.title ?? "Untitled"}
                      subtitle={`${formatRelativeTime(touchIso)} - ${dur}`}
                      summary={summary || undefined}
                      addToRecordingHref={`/record?append=${encodeURIComponent(item.id)}`}
                      seeOutputHref={`/recording/${item.id}`}
                      seeOutputLabel="See outputs"
                    />
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setOpenRecordingId(item.id)}
                    >
                      <ActivityCard
                        variant="recording"
                        state="default"
                        title={item.title ?? "Untitled"}
                        subtitle={`${formatRelativeTime(touchIso)} - ${dur}`}
                      />
                    </button>
                  )}
                  <p className="sr-only">
                    {segs} segment{segs === 1 ? "" : "s"}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <FloatingNav
        centerHref={`/record?project=${encodeURIComponent(projectId)}`}
      />
    </div>
  );
}
