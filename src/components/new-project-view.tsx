"use client";

import { createClient } from "@/lib/supabase/client";
import { useRecordingSession } from "@/lib/use-recording-session";
import {
  type RecordingItemRow,
  type RecordingProjectRow,
  displayNameFromFileName,
} from "@/lib/recording-types";
import { FloatingNav } from "@/components/floating-nav";
import { persistRecordingBlob } from "@/lib/persist-recording";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function NewProjectView() {
  useRecordingSession();
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const loadLists = useCallback(async () => {
    const supabase = createClient();
    const [projRes, itemsRes] = await Promise.all([
      supabase
        .from("recording_projects")
        .select("id, name, summary, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("recording_items")
        .select(
          "id, title, created_at, updated_at, project_id, recording_files (id, sequence_index, title, transcript, storage_path, duration, created_at)",
        )
        .order("created_at", { ascending: false }),
    ]);
    setProjects((projRes.data as RecordingProjectRow[]) ?? []);
    setItems((itemsRes.data as RecordingItemRow[]) ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLists();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLists]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = titleRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => window.clearTimeout(t);
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
        recordingFileTitle: displayNameFromFileName(file.name),
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
    await loadLists();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name || saving) return;

    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { data: created, error: createErr } = await supabase
      .from("recording_projects")
      .insert({ name })
      .select("id, name, summary, created_at")
      .single();

    setSaving(false);
    if (createErr || !created) {
      setError(createErr?.message ?? "Could not create project.");
      return;
    }

    router.push(`/project/${created.id}`);
  };

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-[#d7d5c8] px-4 pb-28 pt-24 text-[#1e1e1e]">
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <section>
          <label htmlFor="new-project-title" className="sr-only">
            Project name
          </label>
          <input
            ref={titleRef}
            id="new-project-title"
            name="title"
            type="text"
            autoComplete="off"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            placeholder="Project name"
            className="w-full border-0 border-b border-black/15 bg-transparent pb-1.5 text-[24px] leading-[31px] text-[#1E1E1E] outline-none ring-0 placeholder:text-black/35 focus:border-black/35 disabled:opacity-60"
            style={{ fontFamily: "var(--font-instrument-serif), serif" }}
          />
          <div
            className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/75"
            style={{
              fontFamily: "var(--font-instrument-sans), sans-serif",
              fontVariationSettings: "'wdth' 100",
            }}
          >
            <span>New project</span>
          </div>
        </section>

        <p
          className="mt-6 text-[15px] leading-relaxed text-black/75"
          style={{
            fontFamily: "var(--font-instrument-sans), sans-serif",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          Name your project, then press create or return. You can add recordings afterward.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {uploadError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {uploadError}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-full bg-black px-5 py-2.5 text-[15px] font-medium text-[#f7f7f7] disabled:opacity-40"
            style={{
              fontFamily: "var(--font-instrument-sans), sans-serif",
              fontVariationSettings: "'wdth' 100",
            }}
          >
            {saving ? "Creating…" : "Create project"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => router.push("/projects")}
            className="rounded-full border-0 bg-transparent px-5 py-2.5 text-[15px] font-medium text-black/70 hover:text-black disabled:opacity-40"
            style={{
              fontFamily: "var(--font-instrument-sans), sans-serif",
              fontVariationSettings: "'wdth' 100",
            }}
          >
            Cancel
          </button>
        </div>
      </form>

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
