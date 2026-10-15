# ApplyPilot

ApplyPilot is an intelligent, privacy-focused application automation system designed to streamline and accelerate the job application workflow.

## Monorepo Architecture

The repository is organized using npm workspaces:

- `apps/`: Application frontends and runnable targets (e.g., desktop application, browser extensions).
- `packages/`: Modular internal libraries and utilities shared across applications.
- `docs/`: Technical specifications, architectural decision records (ADRs), and documentation.

## Prerequisites

Ensure your development environment meets the following requirements:

- **Node.js**: `>= 20.0.0` (Detected: `v26.8.1`)
- **npm**: `>= 10.0.0` (Detected: `11.19.0`)
- **Git**: `>= 2.30.0` (Detected: `2.56.0`)
- **TypeScript**: Shared base configuration targeting `ES2022` / `NodeNext` (`typescript ^5.8.2`)

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Desktop_Application
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Verify TypeScript configuration:**
   ```bash
   node -e "const ts = require('typescript'); const cfg = ts.readConfigFile('tsconfig.base.json', ts.sys.readFile); if (cfg.error) throw cfg.error; console.log('tsconfig.base.json is valid');"
   ```

## Development Status

- **Current Stage**: Chunk 1 — Project Initialization Completed
  - Monorepo workspace configuration (`apps/*`, `packages/*`) established.
  - Shared TypeScript baseline configuration defined (`tsconfig.base.json`).
  - Standard `.gitignore` and security exclusions in place.
  - Workspace directories (`apps/`, `packages/`, `docs/`) initialized.
- **Next Stage**: Chunk 2 (Awaiting instructions)
