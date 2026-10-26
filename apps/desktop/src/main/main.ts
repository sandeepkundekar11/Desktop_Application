import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerStorageIpcHandlers } from './ipc/storageIpc.js';
import { registerResumeIpcHandlers } from './ipc/resumeIpc.js';
import { registerProfileIpcHandlers } from './ipc/profileIpc.js';
import { registerConnectorsIpcHandlers } from './ipc/connectorsIpc.js';
import { initializeStorageHierarchy } from './storage/directoryInitializer.js';
import { resolveStorageRoot, logStorageDiagnostics } from './storage/storageRootResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 650,
    title: 'ApplyPilot',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Prevent opening untrusted windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  return mainWindow;
};

app.whenReady().then(() => {
  // 1. Resolve storage root and log diagnostics
  const resolution = resolveStorageRoot();
  logStorageDiagnostics(resolution);

  // 2. Initialize target portable directory hierarchy and manifest
  initializeStorageHierarchy();

  // 3. Register strictly validated JSON storage, resume, profile, and connector IPC handlers
  registerStorageIpcHandlers();
  registerResumeIpcHandlers();
  registerProfileIpcHandlers();
  registerConnectorsIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

