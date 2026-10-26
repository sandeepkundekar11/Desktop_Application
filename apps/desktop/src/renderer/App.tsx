import React, { FC, useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@applypilot/ui';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CandidateProfileCard } from './components/CandidateProfileCard';
import { ConnectorManagementView } from './components/connectors/ConnectorManagementView';
import { MinimalProfile } from './types';

export const AppContent: FC = () => {
  const [currentTab, setCurrentTab] = useState<'profile' | 'connectors'>('profile');
  const [profile, setProfile] = useState<MinimalProfile | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');

  const loadProfile = useCallback(async () => {
    try {
      if (window.applyPilotAPI?.profile) {
        const p = await window.applyPilotAPI.profile.get();
        setProfile(p);
      }
    } catch (err) {
      setAlertType('error');
      setAlertMessage(`Failed to load profile: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'profile' || tab === 'connectors') {
            setCurrentTab(tab);
          }
        }}
      />

      <div className="app-main">
        <Header
          currentSection={currentTab === 'profile' ? 'Resume Workspace' : 'Job Connectors'}
        />

        <main className="app-workspace">
          {currentTab === 'profile' && (
            <>
              <header className="workspace-hero">
                <div>
                  <h1 className="workspace-title">Candidate Profile & Master Resume</h1>
                  <p className="workspace-desc">
                    Minimal portable profile foundation. Your profile data is stored exclusively in <code>data/profile/profile.json</code> and your master resume in <code>data/resumes/</code>.
                  </p>
                </div>
              </header>

              {alertMessage && (
                <div
                  className={`demo-result demo-result--${alertType}`}
                  id="resume-alert-banner"
                  role="status"
                  style={{ marginBottom: 'var(--space-4)' }}
                >
                  {alertMessage}
                </div>
              )}

              {/* Full-width Profile Screen: Master Resume section first, followed by structured profile tabs */}
              <div style={{ width: '100%', marginBottom: 'var(--space-6)' }}>
                <CandidateProfileCard
                  profileData={profile}
                  onRefreshProfile={loadProfile}
                  onProfileSaved={(updated) => {
                    setProfile(updated);
                    setAlertType('success');
                    setAlertMessage('Profile updated and saved to data/profile/profile.json.');
                  }}
                />
              </div>
            </>
          )}

          {currentTab === 'connectors' && <ConnectorManagementView />}
        </main>
      </div>
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
