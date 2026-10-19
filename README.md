# PageFlow

> **Fluid, local-first notes with private on-device AI. Your workspace is a folder you own.**

[![Tests](https://img.shields.io/badge/tests-83%20passed-success.svg)](#testing)
[![Electron](https://img.shields.io/badge/Electron-33.4-informational.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-blue.svg)](https://sqlite.org/)
[![CRDT](https://img.shields.io/badge/CRDT-Yjs%20%2B%20WebRTC-orange.svg)](https://yjs.dev/)
[![Local AI](https://img.shields.io/badge/AI-Ollama%20(Local%20%26%20Private)-green.svg)](https://ollama.ai/)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Architecture & Philosophy](#architecture--philosophy)
- [Feature Highlights](#feature-highlights)
  - [Rich Block Editor](#1-rich-block-editor)
  - [Notion-Style Database Views](#2-notion-style-database-views)
  - [Integrated Local AI (Ollama)](#3-integrated-local-ai-ollama)
  - [Local-First Storage & CRDT Sync](#4-local-first-storage--crdt-sync)
  - [Multi-Tab Workspace](#5-multi-tab-workspace)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development Workflow](#development-workflow)
  - [Production Packaging](#production-packaging)
- [Setting Up Local AI (Ollama)](#setting-up-local-ai-ollama)
- [Data Storage & Workspace Continuity](#data-storage--workspace-continuity)
- [Testing & Quality Verification](#testing--quality-verification)
- [License](#license)

---

## Overview

**PageFlow** is a modern desktop document platform designed as an offline-first, local-first alternative to cloud-tethered workspace tools, inspired by Notion. Built on high-performance SQLite write-ahead logging (WAL) and Yjs conflict-free replicated data types (CRDTs), PageFlow provides frictionless document authoring, flexible database views, peer-to-peer real-time synchronization, and native on-device AI capabilities without exposing your private notes to third-party cloud servers.

---

## Architecture & Philosophy

1. **You Own Your Data**: All notes, databases, and assets reside on your local disk in standard SQLite format (`workspace.db`). No accounts, no telemetry, no subscription paywalls, and no vendor lock-in.
2. **Instant Latency & Zero Spinners**: State changes write synchronously to an ACID-compliant local SQLite engine with WAL mode enabled. Reads and page traversals happen in sub-millisecond timeframes.
3. **Local-First AI Assistance**: Native integration with local LLM runtimes (Ollama). All prompt tokens, page contexts, and generated completions stream entirely on your CPU/GPU.
4. **Peer-to-Peer Collaboration**: Synchronize workspaces and collaborative edits over local networks or WebRTC meshes using Yjs CRDT algorithms without requiring a centralized SaaS cloud.

```
┌─────────────────────────────────────────────────────────────┐
│                        PageFlow Desktop                     │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │     React 18 UI       │       │    TipTap / Prose     │  │
│  │   Multi-Tab Router    │       │     Block Editor      │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
│              │                               │              │
│  ┌───────────▼───────────────────────────────▼───────────┐  │
│  │                  Preload Bridge (IPC)                 │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Electron Main Process                    │
│                                                             │
│   ┌────────────────────┐            ┌───────────────────┐   │
│   │   WorkspaceDb      │            │  Ollama AI Engine │   │
│   │ (better-sqlite3)   │            │ (HTTP Stream/SSE) │   │
│   │  WAL Mode + Schema │            │ Model Selector    │   │
│   └─────────┬──────────┘            └─────────┬─────────┘   │
└─────────────┼─────────────────────────────────┼─────────────┘
              │                                 │
     ┌────────▼────────┐               ┌────────▼────────┐
     │  Local Disk     │               │  Local Ollama   │
     │  workspace.db   │               │ 127.0.0.1:11434 │
     └─────────────────┘               └─────────────────┘
```

---

## Feature Highlights

### 1. Rich Block Editor
- **Full ProseMirror & TipTap Foundation**: True block-based document model supporting headings, paragraphs, lists, quotes, callouts, and code blocks.
- **Slash Commands (`/`)**: Type `/` anywhere on a blank line to insert tables, bulleted lists, numbered lists, task checklists, callout boxes, or toggle blocks.
- **Interactive Checklist Blocks**: Native task lists with toggleable check states.
- **Embedded Tables**: Resizable spreadsheet-like tables with add/remove column and row controls.
- **Markdown Quick Inputs**:
  - `# ` through `### ` for Level 1–3 Headings
  - `- ` or `* ` for Bulleted Lists
  - `[] ` for Task Lists
  - `> ` for Blockquotes and Callouts
  - ` ``` ` for Syntax-highlighted Code Blocks

### 2. Notion-Style Database Views
- **Four Layout Engines**:
  - **Table View**: Columnar data grid with cell editing, column resizing, and property aggregations.
  - **Board / Kanban View**: Drag-and-drop cards between customizable status columns.
  - **Gallery View**: Visual card grid ideal for asset catalogs, team directories, and research cards.
  - **Calendar View**: Chronological layout organizing cards by date property.
- **Rich Property Types**: Text, Number, Select, Multi-Select, Status, Date, Checkbox, Formula, and Cross-Database Relations.
- **Real-Time Formula Engine**: Evaluate dynamic calculations and text operations across record properties.
- **Saved Views & Filters**: Create custom filtered, sorted, and grouped perspectives for any dataset.

### 3. Integrated Local AI (Ollama)
- **Zero Cloud Leakage**: Connects directly to local models running via Ollama at `http://127.0.0.1:11434`.
- **Model Selector & Discovery**: Automatically detects all locally installed models (`qwen2.5`, `llama3.2`, `deepseek-r1`, `mistral`, etc.) and lets you select your preferred runtime.
- **Real-Time Token Streaming**: Streams generated tokens instantaneously into the UI with smooth animations.
- **Reasoning Process Inspection (`<think>`)**: Collapsible thinking accordions reveal the model's intermediate reasoning trace without cluttering final outputs.
- **Inline Assistant (`Ctrl + J`)**: Select any text and trigger contextual actions:
  - Fix spelling & grammar
  - Summarize or condense
  - Translate or change tone
  - Extract action items and checklists
- **Persistent AI Chat Drawer (`Ctrl + Shift + J`)**: Full-page contextual workspace assistant capable of answering questions about your current document or generating new sections.
- **Direct Block Insertion**: Insert generated markdown, tables, or task lists directly into your current document with a single click.

### 4. Local-First Storage & CRDT Sync
- **SQLite Engine**: High-performance storage managed via `better-sqlite3` with Write-Ahead Logging (`WAL`) enabled.
- **Yjs CRDT Integration**: Document states are tracked as conflict-free replicated structures, enabling concurrent edits without collision or overwrite.
- **Peer-to-Peer WebRTC Mesh**: Connect to other PageFlow instances across local networks without central relays.
- **Offline Sync Bundles**: Export snapshot bundles (`.sync`) to transfer workspaces across machines air-gapped via USB or local storage.

### 5. Multi-Tab Workspace
- **Browser-Grade Tab Bar**: Work across multiple pages and databases simultaneously.
- `Ctrl + T` to spawn new tabs, `Ctrl + W` to close tabs, and quick tab switching.

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `Ctrl + T` | Global | Open a new workspace tab |
| `Ctrl + W` | Global | Close the active workspace tab |
| `Ctrl + J` | Editor | Open inline AI writing palette on selection |
| `Ctrl + Shift + J` | Global | Toggle contextual AI assistant side drawer |
| `/` | Empty Line | Open slash command palette for block insertion |
| `Ctrl + Z` | Editor | Undo last edit |
| `Ctrl + Shift + Z` | Editor | Redo edit |
| `Ctrl + B` | Text Selection | Toggle Bold formatting |
| `Ctrl + I` | Text Selection | Toggle Italic formatting |
| `Ctrl + U` | Text Selection | Toggle Underline formatting |
| `Ctrl + K` | Text Selection | Add or edit hyperlink |
| `Tab` | List Item / Table | Indent list item or advance to next table cell |
| `Shift + Tab` | List Item / Table | Outdent list item or move to previous table cell |

---

## Tech Stack

- **Runtime & Desktop Shell**: [Electron](https://www.electronjs.org/) 33
- **Frontend Framework**: [React](https://react.dev/) 18, [TypeScript](https://www.typescriptlang.org/) 5.7
- **Styling**: Tailored Modern CSS Design System (Dark & Light mode support)
- **Editor Engine**: [TipTap](https://tiptap.dev/) 2, [ProseMirror](https://prosemirror.net/)
- **Local Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (SQLite WAL Mode)
- **CRDT & Sync**: [Yjs](https://yjs.dev/), `y-prosemirror`, `y-webrtc`
- **AI Runtime**: [Ollama](https://ollama.ai/) (Local REST API streaming over `node:http`)
- **Build & Packaging**: [electron-vite](https://electron-vite.org/), [electron-builder](https://www.electron.build/)
- **Testing**: [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/)

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **pnpm**: `v9.x` or later (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Ollama** *(Optional, for AI features)*: Installed and running from [ollama.ai](https://ollama.ai/)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/pageflow.git
cd pageflow

# Install project dependencies and native SQLite bindings
pnpm install
```

### Development Workflow

```bash
# Start the local Electron development window with hot module reloading (HMR)
pnpm dev

# (Optional) Seed the local workspace with sample pages, databases, and manuals
pnpm seed
```

### Production Packaging & Installers

```bash
# Run type checking across main, preload, and renderer packages
pnpm typecheck

# Run unit and integration tests
pnpm test

# Build both NSIS Installer and Portable .exe
pnpm dist

# (Alternatively) Build fast unpacked directory for testing
pnpm dist:dir
```

The resulting release artifacts are output to `dist-win/`:
- **`PageFlow-Setup-<version>.exe`**: Standard Windows installer with Start Menu shortcuts, Desktop icon, and uninstaller.
- **`PageFlow-<version>-portable.exe`**: Zero-install standalone executable for USB drives or quick testing.
- **`SHA256SUMS.txt`**: Cryptographic integrity checksums for verification.

### Automated GitHub Releases (CI/CD)
When a git version tag is pushed (e.g. `git tag v0.1.0 && git push origin v0.1.0`), the GitHub Actions workflow [`.github/workflows/release.yml`](file:///.github/workflows/release.yml) automatically:
1. Runs full test suites and type validation on `windows-latest`.
2. Packages both installer and portable binaries.
3. Computes SHA-256 checksums.
4. Generates a published GitHub Release with attached binaries and changelog notes.

---

## Setting Up Local AI (Ollama)

To enable on-device AI features in PageFlow:

1. Download and install [Ollama](https://ollama.ai/).
2. Pull a recommended model:
   ```bash
   # Balanced writing and general productivity (Recommended)
   ollama pull qwen2.5:7b

   # Lightweight model for ultra-fast responses
   ollama pull llama3.2:3b

   # Advanced reasoning and deep analysis
   ollama pull deepseek-r1:8b
   ```
3. Start the Ollama server:
   ```bash
   ollama serve
   ```
4. Open **PageFlow**. The model dropdown in the AI Assistant will automatically detect all downloaded models.

---

## Data Storage & Workspace Continuity

PageFlow automatically locates or creates your workspace directory at:

- **Windows**: `%USERPROFILE%\Documents\PageFlow` *(or `%USERPROFILE%\OneDrive\Documents\PageFlow`)*
- **macOS / Linux**: `~/Documents/PageFlow`

### Backwards Compatibility
If you previously used an existing workspace folder (e.g. `Documents/NotionFlow` or `Documents/Pagegrove`), PageFlow automatically detects and reads your existing `workspace.db` without requiring manual migration.

### OneDrive & Cloud Sync WAL Protection
PageFlow's SQLite engine uses WAL (Write-Ahead Logging) configured with `busy_timeout = 5000ms`, `synchronous = NORMAL`, and memory-backed temporary tables. If your `Documents` directory is managed by Microsoft OneDrive, PageFlow automatically prevents lock timeouts and file contention during background syncs.

### Diagnostic Logs & Troubleshooting
If you encounter any unexpected issues, PageFlow maintains a rotating local log file:
- **Location**: `%APPDATA%\PageFlow\logs\app.log`
- **Quick Access**: Open Quick Find (`Ctrl + P` or `Ctrl + K`) and run **"Open Diagnostic Logs (app.log)"** to immediately open the log directory in File Explorer.

---

## Testing & Quality Verification

PageFlow is backed by a comprehensive suite of unit, integration, and end-to-end tests:

```bash
# Run unit tests (Formula engine, CRDT sync, AI system prompts, Markdown transformations)
pnpm test

# Run End-to-End tests via Playwright
pnpm test:e2e

# Run linter
pnpm lint
```

---

## License

This project is licensed under the [MIT License](LICENSE).
