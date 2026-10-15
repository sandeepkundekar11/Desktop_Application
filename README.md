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
  - Narrow, typed IPC storage bridge registered (`storage:get-status`, `storage:set-setting`, `storage:get-setting`, `storage:verify`) with input allowlisting.
  - Minimal storage verification screen implemented in the React renderer demonstrating save, read, and full persistence verification surviving application restarts.
- **Next Stage**: Chunk 5 (Awaiting instructions)
