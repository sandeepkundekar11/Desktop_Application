import { ipcMain } from 'electron';
import { executeFindJobsPipeline, PipelineReport } from '../pipeline/jobPipeline.js';

export const registerJobsIpcHandlers = (): void => {
  ipcMain.handle('jobs:find-jobs', async (): Promise<PipelineReport> => {
    return executeFindJobsPipeline();
  });
};
