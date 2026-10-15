import { ipcMain, BrowserWindow } from 'electron';
import {
  selectAndImportResume,
  listSavedResumes,
  getResumeTextById,
} from '../resume/resumeService.js';
import { ImportResumeResult, ResumeMetadata } from '../resume/types.js';

export const RESUME_IPC_CHANNELS = {
  SELECT_AND_IMPORT: 'resume:select-and-import',
  LIST: 'resume:list',
  GET_EXTRACTED_TEXT: 'resume:get-extracted-text',
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

  // 2. List all saved resumes
  ipcMain.handle(
    RESUME_IPC_CHANNELS.LIST,
    async (): Promise<readonly ResumeMetadata[]> => {
      return listSavedResumes();
    }
  );

  // 3. Get extracted text for a specific resume
  ipcMain.handle(
    RESUME_IPC_CHANNELS.GET_EXTRACTED_TEXT,
    async (_event, id: unknown): Promise<{ id: string; extractedText: string } | null> => {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid or missing resume ID');
      }
      const details = getResumeTextById(id);
      if (!details) {
        return null;
      }
      return {
        id: details.metadata.id,
        extractedText: details.extractedText,
      };
    }
  );
};
