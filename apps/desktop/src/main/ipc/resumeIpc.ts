import { ipcMain, BrowserWindow } from 'electron';
import {
  selectAndImportResume,
  getMasterResumeStatus,
  ImportResumeResult,
  MasterResumeStatus,
} from '../resume/resumeService.js';

export const RESUME_IPC_CHANNELS = {
  SELECT_AND_IMPORT: 'resume:select-and-import',
  GET_MASTER_STATUS: 'resume:get-master-status',
} as const;

export const registerResumeIpcHandlers = (): void => {
  // 1. Select & Import via native dialog
  ipcMain.handle(
    RESUME_IPC_CHANNELS.SELECT_AND_IMPORT,
    async (event): Promise<ImportResumeResult> => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender);
        return await selectAndImportResume(window ?? undefined);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // 2. Get master resume status
  ipcMain.handle(
    RESUME_IPC_CHANNELS.GET_MASTER_STATUS,
    async (): Promise<MasterResumeStatus> => {
      return getMasterResumeStatus();
    }
  );
};
