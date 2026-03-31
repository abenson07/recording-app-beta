"use client";

import { createClient } from "@/lib/supabase/client";
import { useRecordingSession } from "@/lib/use-recording-session";
import type { RecordingProjectRow } from "@/lib/recording-types";
import { formatRelativeTime } from "@/lib/recording-types";
import {
  AppContentSheet,
  AppScreenHeader,
  AppSectionLabel,
} from "@/components/app-screen";
import { FloatingNav } from "@/components/floating-nav";
import { FolderGlyph, ListRowCardLink } from "@/components/list-row-card";
import { useCallback, useEffect, useState } from "react";

export function AllProjectsView() {
  const { ready: authReady, authError } = useRecordingSession();
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [itemProjectIds, setItemProjectIds] = useState<
    { project_id: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [greetingName, setGreetingName] = useState("there");
  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setProjects([]);
      setItemProjectIds([]);
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
      supabase.from("recording_items").select("project_id").limit(2000),
    ]);

    setProjects((projRes.data as RecordingProjectRow[]) ?? []);
    setItemProjectIds((itemsRes.data as { project_id: string | null }[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    load();
  }, [authReady, load]);

  const countFor = (projectId: string) =>
    itemProjectIds.filter((i) => i.project_id === projectId).length;

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
        title="All Projects"
      />

      <AppContentSheet>
        <AppSectionLabel>All projects</AppSectionLabel>

        <ul className="flex flex-col gap-3">
          {loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : projects.length === 0 ? (
            <li className="rounded-2xl bg-white/80 px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
              No projects yet. Use <strong className="font-medium text-neutral-800">Record</strong>{" "}
              below to create recordings and projects.
            </li>
          ) : (
            projects.map((p) => {
              const n = countFor(p.id);
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
      </AppContentSheet>

      <FloatingNav centerHref="/record" />
    </div>
  );
}
