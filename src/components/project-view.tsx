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
import { ListRowCardLink, WaveformGlyph } from "@/components/list-row-card";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function ProjectView({ projectId }: { projectId: string }) {
  const { ready: authReady, authError } = useRecordingSession();
  const [project, setProject] = useState<RecordingProjectRow | null>(null);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [greetingName, setGreetingName] = useState("there");
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setProject(null);
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
      ? `${formatRelativeTime(project.created_at)} · ${items.length} recording${items.length === 1 ? "" : "s"}`
      : undefined;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#1A1A1A]">
      {authError ? (
        <p className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {authError}
        </p>
      ) : null}

      <AppScreenHeader
        greeting={`Hello ${greetingName},`}
        title={project?.name ?? "…"}
        meta={metaLine}
      />

      <AppContentSheet>
        <p className="text-xs text-neutral-500">
          <Link href="/" className="font-medium text-[#C2410C] hover:underline">
            Home
          </Link>
        </p>

        <section className="flex flex-col gap-3">
          <AppSectionLabel>All recordings</AppSectionLabel>
          <ul className="flex flex-col gap-3">
            {!authReady || loading ? (
              <li className="text-sm text-neutral-500">Loading…</li>
            ) : items.length === 0 ? (
              <li className="rounded-2xl bg-white/80 px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
                No recordings in this project yet.
              </li>
            ) : (
              items.map((item) => {
                const touchIso = item.updated_at ?? item.created_at;
                const segs = segmentCount(item);
                const dur = formatDurationClock(totalDurationSec(item));
                return (
                  <li key={item.id}>
                    <ListRowCardLink
                      href={`/recording/${item.id}`}
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
      </AppContentSheet>

      <FloatingNav
        centerHref={`/record?project=${encodeURIComponent(projectId)}`}
      />
    </div>
  );
}
