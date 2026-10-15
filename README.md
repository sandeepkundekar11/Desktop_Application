# ApplyPilot

ApplyPilot is an intelligent, privacy-focused application automation system designed to streamline and accelerate the job application workflow.

## Monorepo Architecture

The repository is organized using npm workspaces:

- `apps/`: Application frontends and runnable targets (`apps/desktop`).
- `packages/`: Modular internal libraries and utilities shared across applications.
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

3. **Type-check TypeScript:**
   ```bash
   npm run typecheck:desktop
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
- **Next Stage**: Chunk 3 (Awaiting instructions)
