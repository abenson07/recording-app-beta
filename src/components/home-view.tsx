"use client";

import { createClient } from "@/lib/supabase/client";
import { useRecordingSession } from "@/lib/use-recording-session";
import type {
  RecordingItemRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import { segmentCount } from "@/lib/recording-types";
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
        <p className="text-sm text-neutral-500">Signing in…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-28">
      <header className="px-5 pt-8 pb-6">
        <p className="text-[15px] text-neutral-500">Hello {greetingName},</p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
          What are we discussing today?
        </h1>
      </header>

      <section className="pl-5">
        <div className="flex gap-3 overflow-x-auto pb-2 pr-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!authReady || loading ? (
            <p className="text-sm text-neutral-500">Loading projects…</p>
          ) : projects.length === 0 ? (
            <div className="min-w-[200px] rounded-2xl bg-[#FDE6C5]/80 px-4 py-3 text-sm text-neutral-600">
              No projects yet. Create one when you add a recording.
            </div>
          ) : (
            projects.map((p) => {
              const n = itemsByProjectCount(p.id);
              return (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className="min-w-[200px] shrink-0 rounded-2xl bg-[#FDE6C5] px-4 py-3.5 shadow-sm transition active:scale-[0.98]"
                >
                  <p className="font-semibold text-neutral-900">{p.name}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {n} recording{n === 1 ? "" : "s"}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-8 px-5">
        <h2 className="text-lg font-bold text-neutral-900">Recent recordings</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {!authReady || loading ? (
            <li className="text-sm text-neutral-500">Loading…</li>
          ) : items.length === 0 ? (
            <li className="rounded-2xl bg-[#E5E1DE] px-4 py-4 text-sm text-neutral-600">
              No recordings yet. Tap Add recording below to start.
            </li>
          ) : (
            items.map((item) => {
              const segs = segmentCount(item);
              const project = projects.find((p) => p.id === item.project_id);
              const touchIso = item.updated_at ?? item.created_at;
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
                      <span>Updated {formatListDate(touchIso)}</span>
                      <span>
                        {segs} recording{segs === 1 ? "" : "s"}
                        {project ? ` · ${project.name}` : ""}
                      </span>
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
          href="/record"
          className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#B9DAD9] text-[15px] font-semibold text-neutral-900 shadow-sm transition hover:bg-[#a8cfcf] active:scale-[0.99]"
        >
          Add recording
        </Link>
      </div>
    </div>
  );
}
