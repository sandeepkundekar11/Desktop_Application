import { createServer } from 'vite';
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, '..');

// 1. Compile main & preload scripts
console.log('[dev] Compiling Electron main and preload processes...');
execSync('npx tsc -p tsconfig.node.json', { cwd: desktopRoot, stdio: 'inherit' });

// 2. Start Vite Dev Server
console.log('[dev] Starting Vite development server...');
const viteServer = await createServer({
  configFile: path.resolve(desktopRoot, 'vite.config.ts'),
  root: desktopRoot,
  mode: 'development',
});

await viteServer.listen();
const devUrl = viteServer.resolvedUrls.local[0] || 'http://localhost:5173';
console.log(`[dev] Vite server listening at ${devUrl}`);

// 3. Launch Electron
console.log('[dev] Launching Electron window...');
const electronModule = await import('electron');
const electronBin = typeof electronModule.default === 'string' ? electronModule.default : electronModule;

const electronProcess = spawn(electronBin, ['.'], {
  cwd: desktopRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl,
    NODE_ENV: 'development',
  },
});

const cleanup = async () => {
  try {
    await viteServer.close();
  } catch {
    // Ignore error on shutdown
  }
  process.exit(0);
};

electronProcess.on('close', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
