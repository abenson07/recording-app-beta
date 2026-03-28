"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";

type RecordingFileRow = {
  id: string;
  sequence_index: number;
  transcript: string | null;
  storage_path: string;
  duration: number | null;
};

type RecordingProjectRow = {
  id: string;
  name: string;
  summary: string | null;
  created_at: string;
};

type RecordingItemRow = {
  id: string;
  title: string | null;
  created_at: string;
  project_id: string | null;
  recording_files: RecordingFileRow[] | null;
};

function combinedTranscript(item: RecordingItemRow): string {
  const files = [...(item.recording_files ?? [])].sort(
    (a, b) => a.sequence_index - b.sequence_index,
  );
  const parts = files.map((f) => f.transcript?.trim()).filter(Boolean);
  return parts.join("\n\n");
}

function nextSequenceIndex(files: RecordingFileRow[] | null | undefined): number {
  const list = files ?? [];
  if (list.length === 0) return 0;
  return Math.max(...list.map((f) => f.sequence_index)) + 1;
}

function ItemCard({
  item,
  projects,
  authReady,
  recordPhase,
  appendToItemId,
  onAppend,
  onProjectChange,
}: {
  item: RecordingItemRow;
  projects: RecordingProjectRow[];
  authReady: boolean;
  recordPhase: "idle" | "recording" | "saving";
  appendToItemId: string | null;
  onAppend: () => void;
  onProjectChange: (projectId: string | null) => void;
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
            Use Record above, then Start segment
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
        "id, title, created_at, project_id, recording_files (id, sequence_index, transcript, storage_path, duration)",
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

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setRecordError("Not signed in");
      setRecordPhase("idle");
      return;
    }

    const ext = mr.mimeType.includes("webm")
      ? "webm"
      : mr.mimeType.includes("mp4")
        ? "m4a"
        : "bin";
    const fileId = crypto.randomUUID();
    const storagePath = `${user.id}/${fileId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("recordings")
      .upload(storagePath, blob, {
        contentType: mr.mimeType,
        upsert: false,
      });

    if (upErr) {
      setRecordError(upErr.message);
      setRecordPhase("idle");
      return;
    }

    let targetItemId: string;
    let sequenceIndex: number;

    if (appendToItemId) {
      const target = items.find((i) => i.id === appendToItemId);
      if (!target) {
        setRecordError("Could not find that recording item. Try refreshing.");
        setRecordPhase("idle");
        return;
      }
      targetItemId = appendToItemId;
      sequenceIndex = nextSequenceIndex(target.recording_files);
    } else {
      const title = `Recording ${new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;

      const projectId =
        newItemProjectId && projects.some((p) => p.id === newItemProjectId)
          ? newItemProjectId
          : null;

      const { data: itemRow, error: itemErr } = await supabase
        .from("recording_items")
        .insert({
          user_id: user.id,
          title,
          ...(projectId ? { project_id: projectId } : {}),
        })
        .select("id")
        .single();

      if (itemErr || !itemRow) {
        setRecordError(itemErr?.message ?? "Failed to create recording item");
        setRecordPhase("idle");
        return;
      }

      targetItemId = itemRow.id;
      sequenceIndex = 0;
    }

    const { error: fileErr } = await supabase.from("recording_files").insert({
      recording_item_id: targetItemId,
      sequence_index: sequenceIndex,
      storage_path: storagePath,
      transcript: "",
      duration: durationSec,
      capture_type: "browser_media_recorder",
    });

    if (fileErr) {
      setRecordError(fileErr.message);
      setRecordPhase("idle");
      return;
    }

    setAppendToItemId(null);
    await loadData();
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-2 border-b border-zinc-800 pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Recordings
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
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-200">{p.name}</span>
                  <span className="text-zinc-500">
                    {count} item{count === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-sm font-medium text-zinc-300">Record</h2>
        {appendToItemId ? (
          <p className="text-sm text-amber-100/90">
            Next clip attaches to{" "}
            <span className="font-medium">
              {items.find((i) => i.id === appendToItemId)?.title ?? "item"}
            </span>
            .{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-amber-50"
              onClick={() => setAppendToItemId(null)}
            >
              Switch to new item
            </button>
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            Start a new recording item, or use <strong className="text-zinc-400">Add segment</strong>{" "}
            on an item below to append in chronological order.
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
            disabled={!authReady}
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
        <div className="flex flex-wrap gap-3">
          {recordPhase === "idle" ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={!authReady || recordPhase !== "idle"}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40"
            >
              {appendToItemId ? "Start segment" : "Start new item"}
            </button>
          ) : null}
          {recordPhase === "recording" ? (
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
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No recordings yet. Use Start to create one.
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
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {projects.map((project) => {
                    const projectItems = items.filter(
                      (i) => i.project_id === project.id,
                    );
                    if (projectItems.length === 0) return null;
                    return (
                      <div key={project.id} className="flex flex-col gap-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          {project.name}
                        </h3>
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
                            />
                          ))}
                        </ul>
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
