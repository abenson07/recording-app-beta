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
import {
  FolderGlyph,
  ListRowCardLink,
  WaveformGlyph,
} from "@/components/list-row-card";
import { useCallback, useEffect, useState } from "react";

export function HomeView() {
  const { ready: authReady, authError } = useRecordingSession();
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [greetingName, setGreetingName] = useState("there");
  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setProjects([]);
      setItems([]);
      setLoading(false);
      return;
    }

    const email = sessionData.session.user.email;
    if (email) {
      const local = email.split("@")[0];
      setGreetingName(local.charAt(0).toUpperCase() + local.slice(1));
    }

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

  useEffect(() => {
    if (!authReady) return;
    load();
  }, [authReady, load]);

  const itemsByProjectCount = (projectId: string) =>
    items.filter((i) => i.project_id === projectId).length;

  const recentRecordings = items.slice(0, 8);
  const recentProjects = projects.slice(0, 6);

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
        <p className="text-sm text-white/60">Signing in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#1A1A1A]">
      <AppScreenHeader
        greeting={`Hello ${greetingName},`}
        title="What are we discussing today?"
      />

      <AppContentSheet>
        <section className="flex flex-col gap-3">
          <AppSectionLabel>Recent musings</AppSectionLabel>
          <ul className="flex flex-col gap-3">
            {!authReady || loading ? (
              <li className="text-sm text-neutral-500">Loading…</li>
            ) : recentRecordings.length === 0 ? (
              <li className="rounded-2xl bg-white/80 px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
                No recordings yet. Open <strong className="font-medium text-neutral-800">Record</strong>{" "}
                below to add one.
              </li>
            ) : (
              recentRecordings.map((item) => {
                const touchIso = item.updated_at ?? item.created_at;
                const segs = segmentCount(item);
                const dur = formatDurationClock(totalDurationSec(item));
                return (
                  <li key={item.id}>
                    <ListRowCardLink
                      href={`/recording/view?id=${encodeURIComponent(item.id)}`}
                      title={item.title ?? "Untitled"}
                      subtitle={`${formatRelativeTime(touchIso)} · ${dur} · ${segs} segment${segs === 1 ? "" : "s"}`}
                      icon={<WaveformGlyph />}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <AppSectionLabel>Active projects</AppSectionLabel>
          <ul className="flex flex-col gap-3">
            {!authReady || loading ? (
              <li className="text-sm text-neutral-500">Loading…</li>
            ) : recentProjects.length === 0 ? (
              <li className="rounded-2xl bg-white/80 px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
                No projects yet. Create one from the Record screen, or they appear when you organize recordings.
              </li>
            ) : (
              recentProjects.map((p) => {
                const n = itemsByProjectCount(p.id);
                return (
                  <li key={p.id}>
                    <ListRowCardLink
                      href={`/project/view?id=${encodeURIComponent(p.id)}`}
                      title={p.name}
                      subtitle={`${formatRelativeTime(p.created_at)} · ${n} recording${n === 1 ? "" : "s"}`}
                      icon={<FolderGlyph />}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </AppContentSheet>

      <FloatingNav centerHref="/record" />
    </div>
  );
}
