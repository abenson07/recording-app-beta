/**
 * Reorganize recording_items (and optional recording_project_folders) to match a
 * markdown outline. Parentheses hold the first 8 hex chars of each recording *item* UUID.
 *
 * Usage:
 *   node --env-file=.env.local scripts/reorganize-recording-from-md.mjs /path/to/recording_projects.md
 *
 * Prerequisite (if folder operations fail): run scripts/apply-recording-reorg-support.sql
 * in the Supabase SQL Editor once.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and a Supabase key (anon/publishable is enough if RLS/grants allow).",
  );
  process.exit(1);
}

const mdPath = process.argv[2];
if (!mdPath) {
  console.error("Usage: node scripts/reorganize-recording-from-md.mjs <file.md>");
  process.exit(1);
}

const supabase = createClient(url, key);

function parseMd(content) {
  const projects = [];
  let currentProject = null;
  let currentFolder = null;
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("# ") && !line.startsWith("##")) {
      currentProject = { name: line.slice(2).trim(), folders: [] };
      projects.push(currentProject);
      currentFolder = null;
    } else if (line.startsWith("## ")) {
      if (!currentProject) continue;
      currentFolder = { name: line.slice(3).trim(), items: [] };
      currentProject.folders.push(currentFolder);
    } else if (line.startsWith("### ")) {
      const m = line.match(/^###\s+(.+?)\s+\(`([a-f0-9]+)`\)\s*$/);
      if (!m) {
        throw new Error(`Could not parse line: ${line}`);
      }
      if (!currentFolder || !currentProject) {
        throw new Error(`### before any ## folder: ${line}`);
      }
      currentFolder.items.push({ title: m[1].trim(), shortId: m[2].toLowerCase() });
    }
  }
  return projects;
}

/** First UUID group — matches the id shown in parentheses in the markdown. */
function shortFromItemId(itemId) {
  return String(itemId).split("-")[0].toLowerCase();
}

async function main() {
  const content = readFileSync(mdPath, "utf8");
  const structure = parseMd(content);

  const { data: items, error: itemsErr } = await supabase
    .from("recording_items")
    .select("id");

  if (itemsErr) throw itemsErr;
  if (!items?.length) {
    console.error("No recording_items returned (RLS or empty DB).");
    process.exit(1);
  }

  const byShort = new Map();
  for (const row of items) {
    const s = shortFromItemId(row.id);
    if (byShort.has(s)) {
      throw new Error(
        `Ambiguous short id ${s}: multiple recording_items share the same first UUID segment`,
      );
    }
    byShort.set(s, row.id);
  }

  const expectedShort = new Set();
  for (const p of structure) {
    for (const fo of p.folders) {
      for (const it of fo.items) {
        expectedShort.add(it.shortId);
      }
    }
  }

  for (const s of expectedShort) {
    if (!byShort.has(s)) {
      throw new Error(
        `No recording_item found for short id (${s}). Check ids in the markdown.`,
      );
    }
  }

  /** @type {Map<string, string>} project name -> id */
  const projectByName = new Map();
  const { data: existingProjects } = await supabase
    .from("recording_projects")
    .select("id, name");

  if (existingProjects) {
    for (const pr of existingProjects) {
      projectByName.set(pr.name, pr.id);
    }
  }

  for (const p of structure) {
    let pid = projectByName.get(p.name);
    if (!pid) {
      const { data: inserted, error } = await supabase
        .from("recording_projects")
        .insert({ name: p.name, user_id: null })
        .select("id")
        .single();
      if (error) throw error;
      pid = inserted.id;
      projectByName.set(p.name, pid);
    }
  }

  /** `${projectId}\0${folderName}` -> folder id */
  const folderByKey = new Map();
  const { data: existingFolders, error: folderReadErr } = await supabase
    .from("recording_project_folders")
    .select("id, project_id, name");

  if (folderReadErr) {
    console.warn(
      "Could not read recording_project_folders:",
      folderReadErr.message,
      "\n→ Run scripts/apply-recording-reorg-support.sql, then re-run. Continuing without folders (folder_id will stay null).",
    );
  } else if (existingFolders) {
    for (const f of existingFolders) {
      folderByKey.set(`${f.project_id}\0${f.name}`, f.id);
    }
  }

  const canUseFolders = !folderReadErr;

  for (const p of structure) {
    const pid = projectByName.get(p.name);
    for (const fo of p.folders) {
      let folderId = null;
      if (canUseFolders) {
        const fk = `${pid}\0${fo.name}`;
        folderId = folderByKey.get(fk);
        if (!folderId) {
          const { data: ins, error } = await supabase
            .from("recording_project_folders")
            .insert({ project_id: pid, user_id: null, name: fo.name })
            .select("id")
            .single();
          if (error) {
            console.warn(
              `Could not create folder "${fo.name}":`,
              error.message,
            );
          } else {
            folderId = ins.id;
            folderByKey.set(fk, folderId);
          }
        }
      }

      for (const it of fo.items) {
        const itemId = byShort.get(it.shortId);
        const patch = {
          title: it.title,
          project_id: pid,
        };
        if (canUseFolders && folderId) {
          patch.folder_id = folderId;
        }
        const { error: upErr } = await supabase
          .from("recording_items")
          .update(patch)
          .eq("id", itemId);
        if (upErr) throw upErr;
      }
    }
  }

  const { data: allItems } = await supabase.from("recording_items").select("id");
  const { data: allFiles } = await supabase
    .from("recording_files")
    .select("recording_item_id");

  const withFiles = new Set(
    (allFiles ?? []).map((f) => f.recording_item_id),
  );
  const emptyItemIds = (allItems ?? [])
    .map((r) => r.id)
    .filter((id) => !withFiles.has(id));

  if (emptyItemIds.length) {
    const { error: delItemsErr } = await supabase
      .from("recording_items")
      .delete()
      .in("id", emptyItemIds);
    if (delItemsErr) throw delItemsErr;
    console.log(`Deleted ${emptyItemIds.length} empty recording_items (no files).`);
  }

  const { data: projectsAfter } = await supabase
    .from("recording_projects")
    .select("id, name");

  let deletedProjects = 0;
  for (const pr of projectsAfter ?? []) {
    const { data: itemsInProj } = await supabase
      .from("recording_items")
      .select("id")
      .eq("project_id", pr.id);

    let fileCount = 0;
    for (const row of itemsInProj ?? []) {
      const { count } = await supabase
        .from("recording_files")
        .select("*", { count: "exact", head: true })
        .eq("recording_item_id", row.id);
      fileCount += count ?? 0;
    }

    if (fileCount === 0) {
      const { error: dpErr } = await supabase
        .from("recording_projects")
        .delete()
        .eq("id", pr.id);
      if (dpErr) throw dpErr;
      deletedProjects++;
      console.log(`Removed abandoned project (no recording files): ${pr.name}`);
    }
  }

  console.log(
    `Done. Removed ${deletedProjects} abandoned project(s). Recording files were not deleted.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
