"use client";

import { createClient } from "@/lib/supabase/client";
import { useRecordingSession } from "@/lib/use-recording-session";
import type {
  RecordingItemRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import { formatDuration, totalDurationSec } from "@/lib/recording-types";
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
        "id, title, created_at, project_id, recording_files (id, sequence_index, transcript, storage_path, duration, created_at)",
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
        <p className="text-sm text-neutral-500">Signing in…</p>
      </div>
    );
  }

  if (notFound && !loading) {
    return (
      <div className="flex flex-1 flex-col px-5 py-10">
        <p className="text-neutral-600">Project not found.</p>
        <Link href="/" className="mt-4 text-sm font-medium text-neutral-900 underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-28">
      {authError ? (
        <p className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {authError}
        </p>
      ) : null}
      <header className="px-5 pt-6 pb-6">
        <Link
          href="/"
          className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
        >
          ← Home
        </Link>
        <p className="mt-4 text-[15px] text-neutral-500">Hello {greetingName},</p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
          {project?.name ?? "…"}
        </h1>
      </header>

      <section className="px-5">
        <h2 className="text-lg font-bold text-neutral-900">Recent recordings</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {!authReady || loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : items.length === 0 ? (
            <li className="rounded-2xl bg-[#E5E1DE] px-4 py-4 text-sm text-neutral-600">
              No recordings in this project yet.
            </li>
          ) : (
            items.map((item) => {
              const total = totalDurationSec(item);
              return (
                <li key={item.id}>
                  <Link
                    href={`/recording/${item.id}`}
                    className="block rounded-2xl bg-[#E5E1DE] px-4 py-3.5 transition active:scale-[0.99]"
                  >
                    <p className="font-semibold text-neutral-900">
                      {item.title ?? "Untitled"}
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-2 text-xs text-neutral-500">
                      <span>Created {formatListDate(item.created_at)}</span>
                      <span>{formatDuration(total)}</span>
                    </div>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <div className="fixed bottom-0 left-1/2 z-10 w-full max-w-[430px] -translate-x-1/2 bg-gradient-to-t from-white from-80% to-transparent px-5 pb-6 pt-10">
        <Link
          href={`/record?project=${encodeURIComponent(projectId)}`}
          className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#B9DAD9] text-[15px] font-semibold text-neutral-900 shadow-sm transition hover:bg-[#a8cfcf] active:scale-[0.99]"
        >
          Add recording
        </Link>
      </div>
    </div>
  );
}
