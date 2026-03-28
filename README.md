# Recording App — Product Spec

## Overview

Build a recording app that groups recordings into recording items and projects. A **recording file** is the raw recorded media plus transcript and metadata. A **recording item** is the user-facing unit that contains one or more recording files ordered chronologically and presents a combined transcript. A **project** groups one or more recording items and provides a project-level summary and future artifact generation.

The app should preserve existing recording storage and avoid destructive changes to the current schema. New functionality should be introduced through an additive schema that references existing stored recordings.

---

## Core Entities

- **Recording file** — the raw recording asset, transcript, and metadata
- **Recording item** — an ordered collection of one or more recording files with a combined transcript view
- **Project** — a container for one or more recording items with summary and metadata

---

## Product Rules

- A recording file always belongs to a recording item
- A recording item may exist without belonging to a project
- A project may contain one or more recording items
- Recording files within a recording item are ordered chronologically
- The full transcript for a recording item is composed from individual recording file transcripts in order
- Deleting or re-recording one recording file should not require rebuilding the entire data model from scratch
- Existing recording storage must remain intact and usable

---

## Technical Direction

- **Framework:** Next.js with React, npm
- **Version control:** GitHub
- **Backend:** Supabase (database, auth, storage)
- **Local dev:** Supabase CLI configured early for repeatable schema management across environments

---

## MVP

The MVP proves the end-to-end model for recordings, recording items, and projects.

### MVP Capabilities

- Create a recording that appears as a new recording item
- Add an additional recording file to an existing recording item
- Place a recording item into a project
- Start a new recording from within a project and create a new recording item for it automatically
- Support multiple projects
- Move a recording item from one project to another
- Generate and display a project-level summary from the transcripts of its recording items

### MVP Screens

- **Home** — shows floating recording items and projects
- **Project view** — shows project summary and its recording items
- **Recording item view** — shows the combined transcript, playback, and the ability to add another recording file

---

## Subsequent Iterations

### Iteration 2
Introduce artifact generation so projects, recording items, or recording files can be associated with artifact types and generate outputs on demand.

### Iteration 3
Introduce differentiated capture behavior based on interaction with the record control:

- **Press-and-hold** — full recording
- **Tap** — quick remember / lightweight capture

This should reuse the same underlying recording model while exposing different views and workflows for quick captures versus full recordings.

---

## Data Model

### `recording_files`
Represents each raw recording asset.

| Field | Notes |
|---|---|
| `id` | |
| `storage_path` | Storage reference / path |
| `transcript` | |
| `metadata` | |
| `created_at` | |
| `duration` | |
| `capture_type` | Source / capture type |
| `recording_item_id` | Foreign key |
| `sequence_index` | For ordering within a recording item |

### `recording_items`
Represents the user-visible grouped unit.

| Field | Notes |
|---|---|
| `id` | |
| `title` | Or derived label |
| `transcript_strategy` | Combined transcript strategy |
| `metadata` | |
| `project_id` | Nullable |
| `created_at` | |
| `updated_at` | |

### `projects`
Represents a collection of recording items.

| Field | Notes |
|---|---|
| `id` | |
| `name` | |
| `summary` | |
| `metadata` | |
| `created_at` | |
| `updated_at` | |

---

## Delivery Plan

### Phase 1 — Foundation
- Set up Next.js app with npm and React
- Create GitHub repository and establish environment setup
- Connect Supabase and install/configure Supabase CLI
- Define initial schema and local development workflow

### Phase 2 — Core Recording Workflow
- Create recording files
- Create recording items automatically from first recordings
- Append additional recording files to existing recording items
- Build combined transcript behavior

### Phase 3 — Project Workflow
- Create projects
- Associate recording items with projects
- Record from project context and auto-create recording items
- Move recording items between projects

### Phase 4 — Summary and Output
- Generate project summaries from recording item transcripts
- Prepare artifact generation model for future expansion

---

## Success Criteria

- A recording can be created and viewed as a recording item
- A second recording can be appended to the same recording item in order
- Recording items can exist independently or inside projects
- Recording inside a project creates a new recording item in that project
- Recording items can be moved between projects without data loss
- A project summary can be generated from its recording items
- Existing recording storage remains preserved

---

## Notes

Implementation should favor additive schema changes and preserve compatibility with the existing recording system wherever possible.
