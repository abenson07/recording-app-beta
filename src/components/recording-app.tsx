"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  RecordingItemRow,
  RecordingProjectRow,
} from "@/lib/recording-types";
import { persistRecordingBlob as persistRecordingBlobCore } from "@/lib/persist-recording";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Mic Start/Stop is hidden in the UI when false; upload + DB pipeline unchanged. */
const SHOW_MIC_RECORDING = false;

function combinedTranscript(item: RecordingItemRow): string {
  const files = [...(item.recording_files ?? [])].sort(
    (a, b) => a.sequence_index - b.sequence_index,
  );
  const parts = files.map((f) => f.transcript?.trim()).filter(Boolean);
  return parts.join("\n\n");
}

function ItemCard({
  item,
  projects,
  authReady,
  recordPhase,
  appendToItemId,
  onAppend,
  onProjectChange,
  micRecordingEnabled,
}: {
  item: RecordingItemRow;
  projects: RecordingProjectRow[];
  authReady: boolean;
  recordPhase: "idle" | "recording" | "saving";
  appendToItemId: string | null;
  onAppend: () => void;
  onProjectChange: (projectId: string | null) => void;
  micRecordingEnabled: boolean;
}) {
  const transcript = combinedTranscript(item);
  const segments = item.recording_files?.length ?? 0;

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-zinc-100">
          {item.title ?? "Untitled"}
        </h3>
        <span className="text-xs text-zinc-500">
          {segments} segment{segments === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {new Date(item.created_at).toLocaleString()}
      </p>
      <label className="mt-3 flex max-w-md flex-col gap-1.5 text-xs text-zinc-500">
        <span className="font-medium uppercase tracking-wide">Project</span>
        <select
          value={item.project_id ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onProjectChange(v === "" ? null : v);
          }}
          disabled={!authReady}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-40"
        >
          <option value="">Unassigned</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
        <button
          type="button"
          disabled={!authReady || recordPhase !== "idle"}
          onClick={onAppend}
          className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 disabled:opacity-40"
        >
          Add segment
        </button>
        {appendToItemId === item.id ? (
          <span className="self-center text-xs text-amber-200/90">
            {micRecordingEnabled
              ? "Use Record above, then Start segment"
              : "Use Add recording above to upload another segment."}
          </span>
        ) : null}
      </div>
      <div className="mt-4 border-t border-zinc-800 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Transcript (combined)
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
          {transcript.length > 0 ? transcript : "No transcript yet."}
        </p>
      </div>
    </li>
  );
}

export function RecordingApp() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<RecordingProjectRow[]>([]);
  const [items, setItems] = useState<RecordingItemRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  /** When set, Stop & save appends a file to this item instead of creating a new item. */
  const [appendToItemId, setAppendToItemId] = useState<string | null>(null);
  const [recordPhase, setRecordPhase] = useState<"idle" | "recording" | "saving">(
    "idle",
  );
  const [recordError, setRecordError] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  /** New recording items (not segments) get this project_id when set. */
  const [newItemProjectId, setNewItemProjectId] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const recordSectionRef = useRef<HTMLElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setProjects([]);
      return;
    }
    const { data, error } = await supabase
      .from("recording_projects")
      .select("id, name, summary, created_at")
      .order("name", { ascending: true });

    if (error) {
      setProjectError(error.message);
      setProjects([]);
      return;
    }
    setProjects((data as RecordingProjectRow[]) ?? []);
  }, []);

  const loadItems = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setItems([]);
      setLoadingList(false);
      return;
    }

    setLoadingList(true);
    const { data, error } = await supabase
      .from("recording_items")
      .select(
        "id, title, created_at, project_id, recording_files (id, sequence_index, transcript, storage_path, duration, created_at)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      setRecordError(error.message);
      setItems([]);
    } else {
      setItems((data as RecordingItemRow[]) ?? []);
    }
    setLoadingList(false);
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([loadProjects(), loadItems()]);
  }, [loadProjects, loadItems]);

  const persistRecordingBlob = useCallback(
    async (
      blob: Blob,
      options: {
        contentType: string;
        durationSec: number | null;
        captureType: string;
        newItemTitle?: string;
      },
    ): Promise<boolean> => {
      setRecordError(null);
      const supabase = createClient();
      const result = await persistRecordingBlobCore(supabase, blob, options, {
        appendToItemId,
        items,
        newItemProjectId,
        projects,
      });
      if (!result.ok) {
        setRecordError(result.error);
        return false;
      }
      setAppendToItemId(null);
      await loadData();
      return true;
    },
    [appendToItemId, items, loadData, newItemProjectId, projects],
  );

  /** Deep link: /record?project=id or /record?append=itemId */
  useEffect(() => {
    const append = searchParams.get("append");
    const project = searchParams.get("project");
    if (append) {
      setAppendToItemId(append);
      setNewItemProjectId("");
      return;
    }
    if (project) {
      setNewItemProjectId(project);
      setAppendToItemId(null);
    }
  }, [searchParams]);

  /** Source of truth for “can record” — avoids Strict Mode / async races leaving authReady stuck false. */
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(!!session);
      if (session) setAuthError(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (!cancelled) await loadData();
        return;
      }

      const { error } = await supabase.auth.signInAnonymously();
      if (cancelled) return;

      if (error) {
        setAuthError(
          error.message.includes("Anonymous sign-ins are disabled")
            ? "Turn on Anonymous sign-ins under Supabase → Authentication → Providers, then refresh."
            : error.message,
        );
        setLoadingList(false);
        return;
      }

      await loadData();
    })();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const startRecording = async () => {
    setRecordError(null);
    if (!authReady) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      let mimeType = "audio/webm";
      for (const t of preferredTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.start();
      startedAtRef.current = Date.now();
      setRecordPhase("recording");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Microphone permission denied";
      setRecordError(msg);
    }
  };

  const stopRecording = async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") {
      setRecordPhase("idle");
      return;
    }

    setRecordPhase("saving");
    const durationSec =
      (Date.now() - startedAtRef.current) / 1000;

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    });

    const blob = new Blob(chunksRef.current, { type: mr.mimeType });
    chunksRef.current = [];
    mediaRecorderRef.current = null;

    await persistRecordingBlob(blob, {
      contentType: mr.mimeType,
      durationSec,
      captureType: "browser_media_recorder",
    });
    setRecordPhase("idle");
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setRecordError(null);
    if (!authReady) return;

    setRecordPhase("saving");
    const ok = await persistRecordingBlob(file, {
      contentType: file.type || "application/octet-stream",
      durationSec: null,
      captureType: "file_upload",
      newItemTitle: `Upload · ${file.name}`,
    });
    if (!ok) {
      setRecordPhase("idle");
      return;
    }
    setRecordPhase("idle");
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProjectError(null);
    const name = projectNameDraft.trim();
    if (!name) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProjectError("Not signed in");
      return;
    }

    const { error } = await supabase.from("recording_projects").insert({
      user_id: user.id,
      name,
    });

    if (error) {
      setProjectError(error.message);
      return;
    }

    setProjectNameDraft("");
    await loadProjects();
  };

  const setItemProject = async (itemId: string, projectId: string | null) => {
    setRecordError(null);
    setProjectError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("recording_items")
      .update({ project_id: projectId })
      .eq("id", itemId);

    if (error) {
      setRecordError(error.message);
      return;
    }
    await loadItems();
  };

  /** Start a new recording item in this project (not a segment on an existing item). */
  const beginRecordingInProject = (projectId: string) => {
    setRecordError(null);
    setAppendToItemId(null);
    setNewItemProjectId(projectId);
    recordSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex w-full flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-2 border-b border-zinc-800 pb-6">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
        >
          ← Home
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Record
        </h1>
        <p className="text-sm text-zinc-400">
          Group items into <strong className="text-zinc-300">recording projects</strong> or leave
          them unassigned. Transcripts show once added (speech-to-text can plug in later).
        </p>
        {authError ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {authError}
          </p>
        ) : null}
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-sm font-medium text-zinc-300">Recording projects</h2>
        <p className="text-sm text-zinc-500">
          Projects group related recording items. Items can stay unassigned or be moved anytime.
        </p>
        <form onSubmit={createProject} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={projectNameDraft}
            onChange={(e) => setProjectNameDraft(e.target.value)}
            placeholder="New project name"
            className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={!authReady || !projectNameDraft.trim()}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 disabled:opacity-40"
          >
            Create project
          </button>
        </form>
        {projectError ? (
          <p className="text-sm text-red-400">{projectError}</p>
        ) : null}
        {projects.length === 0 ? (
          <p className="text-sm text-zinc-500">No projects yet — create one above.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((p) => {
              const count = items.filter((i) => i.project_id === p.id).length;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="font-medium text-zinc-200">{p.name}</span>
                    <span className="text-zinc-500">
                      {count} item{count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!authReady}
                    onClick={() => beginRecordingInProject(p.id)}
                    className="shrink-0 rounded-md border border-emerald-600/60 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-40"
                  >
                    Record in project
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        ref={recordSectionRef}
        className="flex scroll-mt-8 flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
      >
        <h2 className="text-sm font-medium text-zinc-300">Record</h2>
        {appendToItemId ? (
          <p className="text-sm text-amber-100/90">
            <strong className="text-amber-50">Segment mode:</strong> next clip attaches to{" "}
            <span className="font-medium">
              {items.find((i) => i.id === appendToItemId)?.title ?? "item"}
            </span>
            . This is separate from recording a new item inside a project.{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-amber-50"
              onClick={() => setAppendToItemId(null)}
            >
              Switch to new item
            </button>
          </p>
        ) : SHOW_MIC_RECORDING ? (
          <p className="text-sm text-zinc-500">
            Start a <strong className="text-zinc-400">new recording item</strong>, or use{" "}
            <strong className="text-zinc-400">Add segment</strong> on an item below to append audio
            to that item only. Use <strong className="text-zinc-400">Record in project</strong>{" "}
            above to target a project.
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            <strong className="text-zinc-400">Add recording</strong> uploads a file. Choose a
            project below, or use <strong className="text-zinc-400">Add segment</strong> on an item
            to append to that item. Microphone capture is disabled in the UI for now.
          </p>
        )}
        {!authReady && !authError ? (
          <p className="text-sm text-zinc-500">Signing in…</p>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm text-zinc-400">
          <span>New items go into</span>
          <select
            value={newItemProjectId}
            onChange={(e) => setNewItemProjectId(e.target.value)}
            disabled={!authReady || Boolean(appendToItemId)}
            className="max-w-md rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 disabled:opacity-40"
          >
            <option value="">Unassigned (inbox)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {!appendToItemId && newItemProjectId ? (
          <p className="text-sm text-emerald-200/90">
            New recording items will be saved under{" "}
            <strong className="text-emerald-50">
              {projects.find((p) => p.id === newItemProjectId)?.name ?? "project"}
            </strong>
            .
          </p>
        ) : null}
        {SHOW_MIC_RECORDING ? (
          <p className="text-sm text-zinc-500">
            <strong className="text-zinc-400">Upload</strong> uses the same rules: new item (and
            project) or add segment when an item is in segment mode.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <input
            ref={uploadInputRef}
            type="file"
            className="sr-only"
            accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
            onChange={handleUploadFile}
          />
          {recordPhase === "idle" ? (
            <>
              {SHOW_MIC_RECORDING ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!authReady || recordPhase !== "idle"}
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40"
                >
                  {appendToItemId ? "Start segment" : "Start new item"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={!authReady}
                onClick={() => uploadInputRef.current?.click()}
                className={
                  SHOW_MIC_RECORDING
                    ? "rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 disabled:opacity-40"
                    : "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40"
                }
              >
                {SHOW_MIC_RECORDING ? "Upload file" : "Add recording"}
              </button>
            </>
          ) : null}
          {SHOW_MIC_RECORDING && recordPhase === "recording" ? (
            <button
              type="button"
              onClick={stopRecording}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              Stop & save
            </button>
          ) : null}
          {recordPhase === "saving" ? (
            <span className="text-sm text-zinc-400">Saving…</span>
          ) : null}
        </div>
        {recordError ? (
          <p className="text-sm text-red-400">{recordError}</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-sm font-medium text-zinc-400">Recording items</h2>
        {loadingList ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : items.length === 0 && projects.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No recordings yet. Create a project above, or use Record with inbox unassigned.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {(() => {
              const unassigned = items.filter((i) => !i.project_id);
              return (
                <>
                  {unassigned.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Unassigned
                      </h3>
                      <ul className="flex flex-col gap-4">
                        {unassigned.map((item) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            projects={projects}
                            authReady={authReady}
                            recordPhase={recordPhase}
                            appendToItemId={appendToItemId}
                            onAppend={() => {
                              setRecordError(null);
                              setAppendToItemId(item.id);
                            }}
                            onProjectChange={(projectId) =>
                              setItemProject(item.id, projectId)
                            }
                            micRecordingEnabled={SHOW_MIC_RECORDING}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {items.length === 0 && projects.length > 0 ? (
                    <p className="text-sm text-zinc-500">
                      No recording items yet. Choose a project with{" "}
                      <strong className="text-zinc-400">Record in project</strong> or set{" "}
                      <strong className="text-zinc-400">New items go into</strong>, then add a
                      recording.
                    </p>
                  ) : null}
                  {projects.map((project) => {
                    const projectItems = items.filter(
                      (i) => i.project_id === project.id,
                    );
                    return (
                      <div key={project.id} className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            {project.name}
                          </h3>
                          <button
                            type="button"
                            disabled={!authReady}
                            onClick={() => beginRecordingInProject(project.id)}
                            className="rounded-md border border-emerald-600/60 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-40"
                          >
                            New recording in project
                          </button>
                        </div>
                        {projectItems.length === 0 ? (
                          <p className="text-sm text-zinc-600">
                            No items in this project yet — use{" "}
                            <strong className="text-zinc-500">New recording in project</strong> or
                            the Record panel above (project is selected).
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-4">
                            {projectItems.map((item) => (
                              <ItemCard
                                key={item.id}
                                item={item}
                                projects={projects}
                                authReady={authReady}
                                recordPhase={recordPhase}
                                appendToItemId={appendToItemId}
                                onAppend={() => {
                                  setRecordError(null);
                                  setAppendToItemId(item.id);
                                }}
                                onProjectChange={(projectId) =>
                                  setItemProject(item.id, projectId)
                                }
                                micRecordingEnabled={SHOW_MIC_RECORDING}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}
      </section>
    </div>
  );
}
