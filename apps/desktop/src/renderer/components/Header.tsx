import React, { FC } from 'react';
import { ThemeToggle } from '@applypilot/ui';

const ShieldCheckIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export interface HeaderProps {
  readonly currentSection?: string;
}

export const Header: FC<HeaderProps> = ({ currentSection = 'Resume Workspace' }) => {
  return (
    <header className="app-header" aria-label="Workspace Header">
      <div className="header-breadcrumbs">
        <span className="breadcrumb-root">Home</span>
        <span className="breadcrumb-sep" aria-hidden="true">/</span>
        <span className="breadcrumb-current">{currentSection}</span>
      </div>

      <div className="header-actions">
        <div className="privacy-badge" title="No telemetry or remote server communication">
          <ShieldCheckIcon />
          <span>Private & Local</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
};
