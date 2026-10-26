const resp = await fetch('https://api.lever.co/v0/postings/drivetrain?mode=json');
const list = await resp.json();
console.log('Total postings in Lever API:', list.length);

const now = new Date('2026-10-22T17:30:00Z').getTime();
const records = list.map((i) => {
  const createdDate = new Date(i.createdAt);
  const daysOld = ((now - i.createdAt) / (24 * 3600 * 1000)).toFixed(1);
  return {
    id: i.id,
    title: i.text,
    createdAt: i.createdAt,
    isoDate: createdDate.toISOString(),
    daysOld: parseFloat(daysOld),
  };
});

records.sort((a, b) => a.daysOld - b.daysOld);

console.log('\n--- 10 Most Recent Postings on Drivetrain (relative to 2026-10-22) ---');
for (const r of records.slice(0, 10)) {
  console.log(`${r.daysOld} days old (${r.isoDate.slice(0, 10)}) - "${r.title}" (ID: ${r.id})`);
}

const within6Days = records.filter((r) => r.daysOld <= 6);
console.log(`\nPostings published within 6 days: ${within6Days.length}`);

const feJobs = records.filter((r) => r.title.toLowerCase().includes('frontend'));
console.log('\n--- Frontend Roles Detail ---');
for (const fe of feJobs) {
  console.log(`Title: ${fe.title}`);
  console.log(`  Published: ${fe.isoDate} (${fe.daysOld} days old)`);
  console.log(`  Raw createdAt timestamp: ${fe.createdAt}`);
}

process.exit(0);
