import React, { FC } from 'react';

const LogoIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="20" height="20">
    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
  </svg>
);

const DocumentIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const BriefcaseIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const SparklesIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

const DatabaseIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const ConnectorsIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export interface SidebarProps {
  readonly activeTab?: string;
  readonly onSelectTab?: (tab: string) => void;
}

export const Sidebar: FC<SidebarProps> = ({ activeTab = 'profile', onSelectTab }) => {
  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <LogoIcon />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">ApplyPilot</span>
          <span className="sidebar-brand-tag">Desktop v0.1.0</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group-label">WORKSPACE</div>
        <button
          type="button"
          className={`nav-item ${activeTab === 'profile' ? 'nav-item--active' : ''}`}
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          id="nav-resume-workspace"
          onClick={() => onSelectTab?.('profile')}
        >
          <DocumentIcon />
          <span className="nav-item-label">Resume Workspace</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'connectors' ? 'nav-item--active' : ''}`}
          aria-current={activeTab === 'connectors' ? 'page' : undefined}
          id="nav-job-connectors"
          onClick={() => onSelectTab?.('connectors')}
        >
          <ConnectorsIcon />
          <span className="nav-item-label">Job Connectors</span>
        </button>

        <div className="nav-group-label" style={{ marginTop: 'var(--space-4)' }}>COMING SOON</div>
        <button type="button" className="nav-item nav-item--disabled" disabled title="Coming in future update">
          <SparklesIcon />
          <span className="nav-item-label">AI Optimization</span>
          <span className="nav-badge">Soon</span>
        </button>

        <button type="button" className="nav-item nav-item--disabled" disabled title="Coming in future update">
          <BriefcaseIcon />
          <span className="nav-item-label">Job Applications</span>
          <span className="nav-badge">Soon</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="storage-status-card">
          <div className="storage-status-header">
            <span className="status-dot status-dot--active" aria-hidden="true" />
            <span className="storage-status-title">Local Storage Active</span>
          </div>
          <div className="storage-status-subtitle">
            <DatabaseIcon />
            <span>Portable JSON • Private on Device</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
