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
import { persistRecordingBlob } from "@/lib/persist-recording";
import { useCallback, useEffect, useRef, useState } from "react";

export function AllProjectsView() {
  const { ready: authReady, authError } = useRecordingSession();
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [itemProjectIds, setItemProjectIds] = useState<
    { project_id: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [greetingName, setGreetingName] = useState("there");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        items: [],
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

        {uploadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {uploadError}
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : projects.length === 0 ? (
            <li className="rounded-2xl bg-white/80 px-4 py-4 text-sm text-neutral-600 ring-1 ring-black/[0.06]">
              No projects yet. Upload a recording from home or use Record to create one.
            </li>
          ) : (
            projects.map((p) => {
              const n = countFor(p.id);
              return (
                <li key={p.id}>
                  <ListRowCardLink
                    href={`/project/${p.id}`}
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
