import React, { FC } from 'react';

export type ProfileTabId =
  | 'personal'
  | 'professional'
  | 'education'
  | 'experience'
  | 'resume'
  | 'preferences'
  | 'social';

export interface ProfileTabsNavProps {
  readonly activeTab: ProfileTabId;
  readonly onTabChange: (tab: ProfileTabId) => void;
  readonly counts: {
    readonly education: number;
    readonly experience: number;
    readonly skills: number;
    readonly certificates: number;
    readonly projects: number;
  };
}

interface TabConfig {
  readonly id: ProfileTabId;
  readonly label: string;
  readonly count?: number;
}

export const ProfileTabsNav: FC<ProfileTabsNavProps> = ({
  activeTab,
  onTabChange,
  counts,
}) => {
  const tabs: TabConfig[] = [
    { id: 'personal', label: 'Personal Information' },
    {
      id: 'professional',
      label: 'Professional',
      count: counts.skills + counts.certificates + counts.projects,
    },
    { id: 'education', label: 'Education', count: counts.education },
    { id: 'experience', label: 'Experience', count: counts.experience },
    { id: 'preferences', label: 'Work Preferences' },
    { id: 'social', label: 'Social Media' },
  ];

  return (
    <nav className="profile-tabs-nav" aria-label="Profile navigation">
      <div className="profile-tabs-list" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              id={`tab-btn-${tab.id}`}
              className={`profile-tab-btn ${isActive ? 'profile-tab-btn--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="profile-tab-badge">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
