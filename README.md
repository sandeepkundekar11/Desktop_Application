# ApplyPilot

ApplyPilot is an intelligent, privacy-focused application automation system designed to streamline and accelerate the job application workflow.

## Monorepo Architecture

The repository is organized using npm workspaces:

- `apps/`: Application frontends and runnable targets (`apps/desktop`).
- `packages/`: Modular internal libraries and shared design systems (`packages/ui`).
- `docs/`: Technical specifications, architectural decision records (ADRs), and documentation.

## Prerequisites

Ensure your development environment meets the following requirements:

- **Node.js**: `>= 20.0.0` (Detected: `v26.8.1`)
- **npm**: `>= 10.0.0` (Detected: `11.19.0`)
- **Git**: `>= 2.30.0` (Detected: `2.56.0`)
- **TypeScript**: Shared base configuration targeting `ES2022` / `NodeNext` (`typescript ^5.8.2`)

## Getting Started

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <repository-url>
   cd Desktop_Application
   npm install
   ```

2. **Run Desktop in Development Mode:**
   ```bash
   npm run dev:desktop
   ```

3. **Type-check TypeScript Across Workspaces:**
   ```bash
   npm run typecheck
   ```

4. **Build Desktop for Production:**
   ```bash
   npm run build:desktop
   ```

## Development Status

- **Chunk 1 — Project Initialization**: Completed.
  - Monorepo workspace configuration (`apps/*`, `packages/*`) established.
  - Shared TypeScript baseline configuration defined (`tsconfig.base.json`).
  - Standard `.gitignore` and security exclusions configured.
- **Chunk 2 — Desktop Foundation**: Completed.
  - Electron + React + TypeScript + Vite desktop package created (`apps/desktop`).
  - Security defaults applied (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, restricted preload bridge).
  - Minimal verification screen with development status indicator implemented.
  - Workspace scripts for dev, build, and typecheck integrated at root.
- **Chunk 3 — Shared Design System Foundation**: Completed.
  - Shared UI package created (`packages/ui`) adhering to clean Modern SaaS aesthetic.
  - Design tokens established for color palette, typography scale, spacing scale, border radii, shadows, and control heights.
  - Light and Dark themes implemented via semantic CSS variables and accessible `data-theme` attribute cascading.
  - Reusable, accessible functional components implemented: `Button`, `Input`, `Card`, and `ThemeToggle`.
  - Desktop initialization screen updated to demonstrate the shared design system.
- **Chunk 4 — Local Storage Foundation**: Completed.
  - Local filesystem directory hierarchy established using `app.getPath('userData')` (`database/`, `resumes/original/`, `resumes/optimized/`, `resumes/tailored/`, `exports/`, `logs/`).
  - Native SQLite 3.49 persistence integrated via Node 22 built-in `node:sqlite` (`DatabaseSync`), with WAL mode, foreign keys, schema migrations, and parameterized queries.
  - Secure local file storage service implemented with strict path traversal guards and area allowlists.
  - Narrow, typed IPC storage bridge registered with input allowlisting.
- **Chunk 5 — Resume Upload and Text Extraction**: Completed.
  - Native file selection dialog configured in main process for PDF and DOCX files with cancellation handling.
  - Strict format validation module inspecting magic byte signatures (`%PDF-`, `PK\x03\x04`), file extensions, and a 10MB size cap.
  - Pure local text extractors implemented for PDF (`pdf-parse`) and DOCX (`mammoth`), coupled with a text normalizer preserving structure, paragraphs, and headings.
  - Original resume binaries saved under `%APPDATA%\Electron\resumes\original\` via unique UUID references, without storing binaries in SQLite.
  - SQLite `resumes` table with SHA-256 duplicate detection and metadata indexing.
  - Preload bridge extended (`resume:select-and-import`, `resume:list`, `resume:get-extracted-text`) preserving `contextIsolation: true` and `sandbox: true`.
  - Minimal, accessible resume management screen with upload trigger, resume list, metadata cards, and extracted plain text reviewer.
- **Next Stage**: Chunk 6 (Awaiting instructions)
