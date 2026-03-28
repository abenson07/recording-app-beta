"use client";

import { createClient } from "@/lib/supabase/client";
import { useRecordingSession } from "@/lib/use-recording-session";
import type {
  RecordingFileRow,
  RecordingItemRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import { formatDuration } from "@/lib/recording-types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatListDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function sortedFiles(files: RecordingFileRow[] | null | undefined): RecordingFileRow[] {
  return [...(files ?? [])].sort((a, b) => a.sequence_index - b.sequence_index);
}

export function RecordingDetailView({ recordingId }: { recordingId: string }) {
  const { ready: authReady, authError } = useRecordingSession();
  const [item, setItem] = useState<RecordingItemRow | null>(null);
  const [project, setProject] = useState<RecordingProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setItem(null);
      setProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: row, error } = await supabase
      .from("recording_items")
      .select(
        "id, title, created_at, project_id, recording_files (id, sequence_index, transcript, storage_path, duration, created_at)",
      )
      .eq("id", recordingId)
      .maybeSingle();

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

  useEffect(() => {
    if (!authReady) return;
    load();
  }, [authReady, load]);

  if (!authReady) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-24">
        <p className="text-sm text-neutral-500">Signing in…</p>
      </div>
    );
  }

  if (notFound && !loading) {
    return (
      <div className="flex flex-1 flex-col px-5 py-10">
        <p className="text-neutral-600">Recording not found.</p>
        <Link href="/" className="mt-4 text-sm font-medium text-neutral-900 underline">
          Back home
        </Link>
      </div>
    );
  }

  const files = sortedFiles(item?.recording_files);

  return (
    <div className="flex flex-1 flex-col pb-28">
      {authError ? (
        <p className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {authError}
        </p>
      ) : null}
      <header className="px-5 pt-6 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href="/" className="font-medium text-neutral-500 hover:text-neutral-800">
            Home
          </Link>
          {project ? (
            <>
              <span className="text-neutral-300">/</span>
              <Link
                href={`/project/${project.id}`}
                className="font-medium text-neutral-500 hover:text-neutral-800"
              >
                {project.name}
              </Link>
            </>
          ) : null}
        </div>
        {project ? (
          <p className="mt-4 text-[15px] text-neutral-500">{project.name}</p>
        ) : (
          <p className="mt-4 text-[15px] text-neutral-500">Inbox</p>
        )}
        <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
          {item?.title ?? "…"}
        </h1>
      </header>

      <section className="px-5">
        <h2 className="text-lg font-bold text-neutral-900">Segments</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {!authReady || loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : files.length === 0 ? (
            <li className="rounded-2xl bg-[#E5E1DE] px-4 py-4 text-sm text-neutral-600">
              No segments yet. Add a recording to create segments.
            </li>
          ) : (
            files.map((f, idx) => {
              const segDate = f.created_at ?? item!.created_at;
              return (
                <li
                  key={f.id}
                  className="rounded-2xl bg-[#E5E1DE] px-4 py-3.5"
                >
                  <p className="font-semibold text-neutral-900">
                    Segment {idx + 1}
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-2 text-xs text-neutral-500">
                    <span>Created {formatListDate(segDate)}</span>
                    <span>{formatDuration(f.duration ?? 0)}</span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <div className="fixed bottom-0 left-1/2 z-10 w-full max-w-[430px] -translate-x-1/2 bg-gradient-to-t from-white from-80% to-transparent px-5 pb-6 pt-10">
        <Link
          href={`/record?append=${encodeURIComponent(recordingId)}`}
          className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#B9DAD9] text-[15px] font-semibold text-neutral-900 shadow-sm transition hover:bg-[#a8cfcf] active:scale-[0.99]"
        >
          Add recording
        </Link>
      </div>
    </div>
  );
}
