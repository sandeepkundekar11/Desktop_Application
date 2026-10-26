import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const dataDir = path.join(projectRoot, 'data');

const log = (msg) => console.log(`[TEST-CONNECTORS] ${msg}`);
const assert = (condition, msg) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
};

async function runConnectorTests() {
  log('Starting Connector Management & JSON Persistence Verification (7 Sources)...');

  const { initializeStorageHierarchy } = await import(
    '../dist-electron/main/storage/directoryInitializer.js'
  );
  const { getTargetStorageLocations } = await import(
    '../dist-electron/main/storage/targetStorageLocations.js'
  );
  const {
    loadConnectors,
    updateConnector,
    testConnectorConnection,
  } = await import('../dist-electron/main/storage/jsonConnectorRepository.js');
  const {
    isConnectorsFileSchema,
    SUPPORTED_CONNECTOR_IDS,
  } = await import('../dist-electron/main/storage/connectorSchema.js');

  const locations = getTargetStorageLocations(dataDir);

  // -------------------------------------------------------------
  // Test 1: First-run initialization creates connectors/connectors.json with 7 sources
  // -------------------------------------------------------------
  log('Step 1: Testing first-run initialization for 7 sources...');
  if (fs.existsSync(locations.connectorsFile)) {
    fs.unlinkSync(locations.connectorsFile);
  }
  initializeStorageHierarchy(dataDir);

  assert(fs.existsSync(locations.connectorsDir), 'data/connectors directory exists');
  assert(fs.existsSync(locations.connectorsFile), 'data/connectors/connectors.json exists');

  const initialData = loadConnectors(dataDir);
  assert(isConnectorsFileSchema(initialData), 'connectors.json satisfies ConnectorsFileSchema');
  assert(initialData.connectors.length === 7, 'Exactly 7 connectors initialized');

  const initialIds = initialData.connectors.map((c) => c.id).sort();
  const expectedIds = [...SUPPORTED_CONNECTOR_IDS].sort();
  assert(
    JSON.stringify(initialIds) === JSON.stringify(expectedIds),
    `Contains all 7 connectors: ${expectedIds.join(', ')}`
  );

  for (const c of initialData.connectors) {
    assert(c.isEnabled === false, `Connector "${c.id}" defaults to isEnabled=false`);
    assert(c.connectionStatus !== 'connected', `Connector "${c.id}" is NOT falsely marked connected`);
    assert(c.lastCheckedAt === null, `Connector "${c.id}" lastCheckedAt is initially null`);
    assert(c.connectionStatus === 'not_tested', `Connector "${c.id}" connection status is "not_tested"`);

    if (['linkedin', 'wellfound', 'instahyre'].includes(c.id)) {
      assert(
        c.implementationStatus === 'requires_setup',
        `Connector "${c.id}" initially marked "requires_setup" because location is empty`
      );
      assert(c.settings.locationPreference === '', `Connector "${c.id}" location is initially empty`);
    } else {
      assert(
        c.implementationStatus === 'configured',
        `Connector "${c.id}" marked "configured" because default location is present`
      );
    }
  }

  // -------------------------------------------------------------
  // Test 2: Independent location configuration & diagnostic clearing
  // -------------------------------------------------------------
  log('Step 2: Testing independent location config and diagnostic clearing for LinkedIn, Wellfound & Instahyre...');
  // Configure Wellfound independently
  await updateConnector(
    'wellfound',
    {
      isEnabled: true,
      settings: {
        locationPreference: 'Remote / US',
        refreshIntervalHours: 8,
        fetchLimit: 40,
        workplaceType: 'remote',
      },
    },
    dataDir
  );

  let reloaded = loadConnectors(dataDir);
  const wf = reloaded.connectors.find((c) => c.id === 'wellfound');
  const ihBefore = reloaded.connectors.find((c) => c.id === 'instahyre');
  const liBefore = reloaded.connectors.find((c) => c.id === 'linkedin');
  assert(wf.settings.locationPreference === 'Remote / US', 'Wellfound location saved as "Remote / US"');
  assert(wf.implementationStatus === 'configured', 'Wellfound transitions to "configured"');
  assert(!wf.statusMessage.includes('Setup required'), 'Wellfound setup diagnostic cleared');
  assert(ihBefore.settings.locationPreference === '', 'Instahyre settings unchanged by Wellfound update');
  assert(ihBefore.implementationStatus === 'requires_setup', 'Instahyre still requires_setup');
  assert(liBefore.settings.locationPreference === '', 'LinkedIn settings unchanged by Wellfound update');
  assert(liBefore.implementationStatus === 'requires_setup', 'LinkedIn still requires_setup');

  // Configure Instahyre independently
  await updateConnector(
    'instahyre',
    {
      isEnabled: true,
      settings: {
        locationPreference: 'Bengaluru, India',
        refreshIntervalHours: 12,
        fetchLimit: 30,
        workplaceType: 'hybrid',
      },
    },
    dataDir
  );

  reloaded = loadConnectors(dataDir);
  const ih = reloaded.connectors.find((c) => c.id === 'instahyre');
  const wfAfter = reloaded.connectors.find((c) => c.id === 'wellfound');
  const liBefore2 = reloaded.connectors.find((c) => c.id === 'linkedin');
  assert(ih.settings.locationPreference === 'Bengaluru, India', 'Instahyre location saved');
  assert(ih.implementationStatus === 'configured', 'Instahyre transitions to "configured"');
  assert(!ih.statusMessage.includes('Setup required'), 'Instahyre setup diagnostic cleared');
  assert(wfAfter.settings.locationPreference === 'Remote / US', 'Wellfound settings preserved');
  assert(liBefore2.settings.locationPreference === '', 'LinkedIn still requires_setup before configuration');

  // Now configure LinkedIn independently
  await updateConnector(
    'linkedin',
    {
      isEnabled: true,
      settings: {
        locationPreference: 'Worldwide',
        refreshIntervalHours: 6,
        fetchLimit: 50,
        workplaceType: 'remote',
        easyApplyOnly: true,
      },
    },
    dataDir
  );

  reloaded = loadConnectors(dataDir);
  const li = reloaded.connectors.find((c) => c.id === 'linkedin');
  const wfAfterLi = reloaded.connectors.find((c) => c.id === 'wellfound');
  const ihAfterLi = reloaded.connectors.find((c) => c.id === 'instahyre');
  assert(li.settings.locationPreference === 'Worldwide', 'LinkedIn location saved as "Worldwide"');
  assert(li.settings.easyApplyOnly === true, 'LinkedIn easyApplyOnly saved as true');
  assert(li.implementationStatus === 'configured', 'LinkedIn transitions to "configured"');
  assert(!li.statusMessage.includes('Setup required'), 'LinkedIn setup diagnostic cleared');
  assert(wfAfterLi.settings.locationPreference === 'Remote / US', 'Wellfound settings preserved after LinkedIn save');
  assert(ihAfterLi.settings.locationPreference === 'Bengaluru, India', 'Instahyre settings preserved after LinkedIn save');

  // -------------------------------------------------------------
  // Test 3: Settings and cleared diagnostics survive app restart
  // -------------------------------------------------------------
  log('Step 3: Testing settings persistence and restart recovery...');
  initializeStorageHierarchy(dataDir);
  const restarted = loadConnectors(dataDir);
  const wfRestart = restarted.connectors.find((c) => c.id === 'wellfound');
  const ihRestart = restarted.connectors.find((c) => c.id === 'instahyre');
  const liRestart = restarted.connectors.find((c) => c.id === 'linkedin');
  assert(wfRestart.settings.locationPreference === 'Remote / US', 'Wellfound location survives restart');
  assert(wfRestart.implementationStatus === 'configured', 'Wellfound configured status survives restart');
  assert(!wfRestart.statusMessage.includes('Setup required'), 'Wellfound diagnostic clean on restart');
  assert(ihRestart.settings.locationPreference === 'Bengaluru, India', 'Instahyre location survives restart');
  assert(ihRestart.implementationStatus === 'configured', 'Instahyre configured status survives restart');
  assert(!ihRestart.statusMessage.includes('Setup required'), 'Instahyre diagnostic clean on restart');
  assert(liRestart.settings.locationPreference === 'Worldwide', 'LinkedIn location survives restart');
  assert(liRestart.settings.easyApplyOnly === true, 'LinkedIn easyApplyOnly survives restart');
  assert(liRestart.implementationStatus === 'configured', 'LinkedIn configured status survives restart');
  assert(!liRestart.statusMessage.includes('Setup required'), 'LinkedIn diagnostic clean on restart');

  // -------------------------------------------------------------
  // Test 4: Testing connection check on LinkedIn, Wellfound, Instahyre, and HiringCafe
  // -------------------------------------------------------------
  log('Step 4: Testing connection diagnostic check (never falsely connected)...');
  const testedLi = await testConnectorConnection('linkedin', dataDir);
  assert(testedLi.connectionStatus === 'not_configured', 'LinkedIn reports not_configured');
  assert(testedLi.connectionStatus !== 'connected', 'LinkedIn must not report connected');
  assert(typeof testedLi.lastCheckedAt === 'string', 'LinkedIn lastCheckedAt recorded');
  assert(testedLi.statusMessage.includes('Authentication'), 'LinkedIn diagnostic explains auth requirement');

  const testedWf = await testConnectorConnection('wellfound', dataDir);
  assert(testedWf.connectionStatus === 'not_configured', 'Wellfound reports not_configured');
  assert(testedWf.connectionStatus !== 'connected', 'Wellfound must not report connected');
  assert(typeof testedWf.lastCheckedAt === 'string', 'Wellfound lastCheckedAt recorded');
  assert(testedWf.statusMessage.includes('Authentication'), 'Wellfound diagnostic explains auth requirement');

  const testedIh = await testConnectorConnection('instahyre', dataDir);
  assert(testedIh.connectionStatus === 'not_configured', 'Instahyre reports not_configured');
  assert(testedIh.connectionStatus !== 'connected', 'Instahyre must not report connected');
  assert(typeof testedIh.lastCheckedAt === 'string', 'Instahyre lastCheckedAt recorded');
  assert(testedIh.statusMessage.includes('Authentication'), 'Instahyre diagnostic explains auth requirement');

  const testedHiringCafe = await testConnectorConnection('hiringcafe', dataDir);
  assert(testedHiringCafe.connectionStatus === 'check_unavailable', 'HiringCafe reports check_unavailable');
  assert(testedHiringCafe.connectionStatus !== 'connected', 'HiringCafe must not report connected');

  // -------------------------------------------------------------
  // Test 5: Reconciling invalid or corrupted JSON safely
  // -------------------------------------------------------------
  log('Step 5: Testing corrupt / invalid JSON handling...');
  const originalContent = fs.readFileSync(locations.connectorsFile, 'utf8');

  fs.writeFileSync(locations.connectorsFile, '{ corrupted json :::: ');
  const healedFromCorrupt = loadConnectors(dataDir);
  assert(isConnectorsFileSchema(healedFromCorrupt), 'Corrupt JSON safely healed into valid schema');
  assert(healedFromCorrupt.connectors.length === 7, 'All 7 connectors restored after corruption');

  fs.writeFileSync(
    locations.connectorsFile,
    JSON.stringify({ version: 1, connectors: [{ id: 'hiringcafe', isEnabled: true }] })
  );
  const healedFromInvalidSchema = loadConnectors(dataDir);
  assert(isConnectorsFileSchema(healedFromInvalidSchema), 'Schema-invalid data safely reconciled');
  assert(healedFromInvalidSchema.connectors.length === 7, 'All 7 connectors present after schema healing');

  fs.writeFileSync(locations.connectorsFile, originalContent);

  // -------------------------------------------------------------
  // Test 6: Sensitive keys protection
  // -------------------------------------------------------------
  log('Step 6: Testing sensitive keys rejection...');
  let sensitiveRejected = false;
  try {
    await updateConnector('wellfound', { settings: { locationPreference: 'Remote', password: 'secret' } }, dataDir);
  } catch {
    sensitiveRejected = true;
  }
  assert(sensitiveRejected, 'Disallowed sensitive field "password" rejected by updateConnector');

  // -------------------------------------------------------------
  // Test 7: Electron security configuration verification
  // -------------------------------------------------------------
  log('Step 7: Verifying Electron security configurations...');
  const mainTsContent = fs.readFileSync(path.join(__dirname, '../src/main/main.ts'), 'utf8');
  assert(mainTsContent.includes('contextIsolation: true'), 'contextIsolation: true is preserved');
  assert(mainTsContent.includes('nodeIntegration: false'), 'nodeIntegration: false is preserved');
  assert(mainTsContent.includes('sandbox: true'), 'sandbox: true is preserved');
  assert(mainTsContent.includes('webSecurity: true'), 'webSecurity: true is preserved');

  log('ALL 7 CONNECTOR PERSISTENCE & MANAGEMENT TESTS PASSED! 🎉');
  app.quit();
}

app.whenReady().then(runConnectorTests).catch((err) => {
  console.error('Connector test failure:', err);
  process.exit(1);
});
