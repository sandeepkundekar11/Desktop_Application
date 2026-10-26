import { executeFindJobsPipeline, PipelineReport } from '../pipeline/jobPipeline.js';

export const runFindJobsCli = async (): Promise<PipelineReport> => {
  console.log('\n======================================================');
  console.log(' APPLYPILOT — /find-jobs PIPELINE EXECUTION');
  console.log('======================================================\n');

  const report = await executeFindJobsPipeline();

  console.log(`Collection Date: ${report.collectionDate}`);
  console.log(`Executed At:     ${report.timestamp}\n`);

  console.log('--- 1. Sources Status ---');
  for (const src of report.sources) {
    const icon = src.status === 'executed' ? '✓' : src.status === 'stopped' ? '⊘' : src.status === 'failed' ? '✗' : '↷';
    console.log(`[${icon}] ${src.displayName} (${src.sourceId}): ${src.message}`);
  }

  console.log('\n--- 2. Pipeline Summary ---');
  console.log(`Total Discovered:   ${report.discoveredCount}`);
  console.log(`Total Normalized:   ${report.normalizedCount}`);
  console.log(`Total Qualified:    ${report.qualifiedCount}`);
  console.log(`Total Rejected:     ${report.rejectedCount}`);
  console.log(`Total Deduplicated: ${report.deduplicatedCount}`);
  console.log(`Total Saved:        ${report.savedCount}`);

  if (report.savedPath) {
    console.log(`Saved Destination:  ${report.savedPath}`);
  } else {
    console.log('Saved Destination:  None (No qualifying jobs to persist; empty directory avoided)');
  }

  if (report.qualifyingJobs.length > 0) {
    console.log('\n--- 3. Qualifying Jobs (Score > 75% & Published <= 6 Days) ---');
    for (let i = 0; i < report.qualifyingJobs.length; i++) {
      const job = report.qualifyingJobs[i]!;
      console.log(`\n#${i + 1} ${job.title} @ ${job.company}`);
      console.log(`   Location:     ${job.location?.rawLocation || 'Unknown'}`);
      console.log(`   Score:        ${job.match?.score}% (Threshold > 75%)`);
      console.log(`   Published:    ${job.postedAt || 'Unknown'}`);
      console.log(`   Canonical URL: ${job.jobUrl}`);
    }
  }

  if (report.rejectedListings.length > 0) {
    console.log('\n--- 4. Rejected Listings Breakdown ---');
    for (const rej of report.rejectedListings) {
      console.log(`- [${rej.company}] "${rej.title}" (${rej.source})`);
      console.log(`    Reason: ${rej.reason}`);
    }
  }

  console.log('\n======================================================\n');
  return report;
};

// If run directly via node/electron
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runFindJobsCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal pipeline error:', err);
      process.exit(1);
    });
}
