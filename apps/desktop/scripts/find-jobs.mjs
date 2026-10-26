import { importLocal } from './db-test-helpers.mjs';

const { runFindJobsCli } = await importLocal('dist-electron/main/cli/findJobs.js');

try {
  await runFindJobsCli();
  process.exit(0);
} catch (err) {
  console.error('Pipeline failed:', err);
  process.exit(1);
}
