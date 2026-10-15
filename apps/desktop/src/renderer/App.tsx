import React, { FC } from 'react';

const PaperAirplaneIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
  </svg>
);

interface StatusIndicatorProps {
  readonly label: string;
}

const StatusIndicator: FC<StatusIndicatorProps> = ({ label }) => (
  <div className="status-pill" id="dev-status-indicator" role="status">
    <span className="status-dot" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

export const App: FC = () => {
  const appInfo = window.applyPilotAPI?.getAppInfo();
  const statusLabel = appInfo?.environment === 'development'
    ? 'Development Mode'
    : 'Ready';

  return (
    <main className="verification-container" id="verification-screen">
      <div className="verification-card">
        <div className="logo-badge">
          <PaperAirplaneIcon />
        </div>
        <header>
          <h1 className="app-title">ApplyPilot</h1>
          <p className="app-subtitle">Desktop application initialized</p>
        </header>
        <StatusIndicator label={statusLabel} />
      </div>
    </main>
  );
};

export default App;
