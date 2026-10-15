import React, { FC, useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider,
  ThemeToggle,
  Button,
  Input,
  Card,
} from '@applypilot/ui';

interface StorageStatusState {
  readonly isInitialized: boolean;
  readonly schemaVersion: number;
}

export const AppContent: FC = () => {
  const [settingValue, setSettingValue] = useState('ApplyPilot_User_Setting');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultType, setResultType] = useState<'success' | 'error'>('success');
  const [storageStatus, setStorageStatus] = useState<StorageStatusState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      if (window.applyPilotAPI?.storage) {
        const status = await window.applyPilotAPI.storage.getStatus();
        setStorageStatus({
          isInitialized: status.isInitialized,
          schemaVersion: status.schemaVersion,
        });
      }
    } catch (err) {
      setResultType('error');
      setResultMessage(`Failed to load storage status: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSaveSetting = async () => {
    setIsLoading(true);
    setResultMessage(null);
    try {
      if (!window.applyPilotAPI?.storage) {
        throw new Error('Storage API bridge unavailable');
      }
      await window.applyPilotAPI.storage.saveSetting('test_setting', settingValue);
      setResultType('success');
      setResultMessage(`Setting "test_setting" saved successfully with value: "${settingValue}"`);
    } catch (err) {
      setResultType('error');
      setResultMessage(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReadSetting = async () => {
    setIsLoading(true);
    setResultMessage(null);
    try {
      if (!window.applyPilotAPI?.storage) {
        throw new Error('Storage API bridge unavailable');
      }
      const val = await window.applyPilotAPI.storage.getSetting('test_setting');
      setResultType('success');
      setResultMessage(
        val !== null
          ? `Read setting "test_setting": "${val}"`
          : 'Setting "test_setting" is not set yet'
      );
    } catch (err) {
      setResultType('error');
      setResultMessage(`Read failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPersistence = async () => {
    setIsLoading(true);
    setResultMessage(null);
    try {
      if (!window.applyPilotAPI?.storage) {
        throw new Error('Storage API bridge unavailable');
      }
      const res = await window.applyPilotAPI.storage.verify();
      if (res.success) {
        setResultType('success');
        setResultMessage(`${res.message} (Value: "${res.retrievedValue}")`);
      } else {
        setResultType('error');
        setResultMessage(res.message);
      }
    } catch (err) {
      setResultType('error');
      setResultMessage(`Verification failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="demo-layout">
      <header className="demo-header">
        <h1 className="demo-header__title">ApplyPilot</h1>
        <ThemeToggle />
      </header>

      <main>
        <Card
          header={
            <div className="demo-status" id="storage-status-indicator" role="status">
              <span className="demo-status__dot" aria-hidden="true" />
              <span>
                {storageStatus?.isInitialized
                  ? `Local Storage Initialized (SQLite Schema v${storageStatus.schemaVersion})`
                  : 'Initializing local storage...'}
              </span>
            </div>
          }
        >
          <Input
            id="test-setting-input"
            label="Allowlisted Test Setting ('test_setting')"
            placeholder="Enter value to store in SQLite"
            value={settingValue}
            onChange={(e) => setSettingValue(e.target.value)}
            helperText="Stored locally on disk via parameterized SQLite queries"
          />

          <div className="demo-actions">
            <Button
              variant="primary"
              id="btn-save-setting"
              onClick={handleSaveSetting}
              disabled={isLoading}
            >
              Save Test Setting
            </Button>
            <Button
              variant="secondary"
              id="btn-read-setting"
              onClick={handleReadSetting}
              disabled={isLoading}
            >
              Read Saved Setting
            </Button>
            <Button
              variant="secondary"
              id="btn-verify-storage"
              onClick={handleVerifyPersistence}
              disabled={isLoading}
            >
              Verify Persistence
            </Button>
          </div>

          {resultMessage && (
            <div
              className={`demo-result demo-result--${resultType}`}
              id="storage-result-banner"
              role="status"
            >
              {resultMessage}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export const App: FC = () => {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
