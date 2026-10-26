import React, { FC } from 'react';
import { Card, Button } from '@applypilot/ui';
import { MinimalProfile } from '../types';
import { MasterResumeSection } from './MasterResumeSection';
import { ProfileTabsNav } from './tabs/ProfileTabsNav';
import { PersonalInfoTab } from './tabs/PersonalInfoTab';
import { ProfessionalTab } from './tabs/ProfessionalTab';
import { EducationTab } from './tabs/EducationTab';
import { ExperienceTab } from './tabs/ExperienceTab';
import { WorkPreferencesTab } from './tabs/WorkPreferencesTab';
import { SocialMediaTab } from './tabs/SocialMediaTab';
import { useProfileEditor } from './tabs/useProfileEditor';

export interface CandidateProfileCardProps {
  readonly profileData: MinimalProfile | null;
  readonly onRefreshProfile?: () => void;
  readonly onProfileSaved?: (updatedProfile: MinimalProfile) => void;
}

export const CandidateProfileCard: FC<CandidateProfileCardProps> = ({
  profileData,
  onRefreshProfile,
  onProfileSaved,
}) => {
  const {
    activeTab,
    setActiveTab,
    isSaving,
    saveStatus,
    errorMessage,
    profile,
    setProfile,
    updateUserInfo,
    updateProfessional,
    updateEducation,
    updateExperience,
    updateResume,
    updatePreferences,
    updateSocialMedia,
    handleSaveProfile,
  } = useProfileEditor({
    profileData,
    onProfileSaved,
    onRefreshProfile,
  });

  const fullName = [
    profile.user_info.first_name,
    profile.user_info.middle_name,
    profile.user_info.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <div className="profile-screen-layout">
      {/* 1. Master Resume Upload - Placed first above the tabs and profile information */}
      <MasterResumeSection
        resume={profile.resume}
        onChange={updateResume}
        onProfileExtracted={(newProf) => {
          setProfile(newProf);
          if (onProfileSaved) {
            onProfileSaved(newProf);
          }
        }}
      />

      {/* 2. Candidate Profile Card with Header and Tabs */}
      <Card className="profile-container" id="candidate-profile-card">
        <div className="profile-header">
          <div className="profile-header__title-group">
            <div className="profile-header__name-row">
              <h2 className="profile-header__name" id="candidate-full-name">
                {fullName || 'Candidate Profile'}
              </h2>
              {saveStatus && (
                <span
                  id="profile-save-status"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-success)',
                    fontWeight: 500,
                    marginLeft: '8px',
                  }}
                >
                  {saveStatus}
                </span>
              )}
              {errorMessage && (
                <span
                  id="profile-save-error"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-error)',
                    fontWeight: 500,
                    marginLeft: '8px',
                  }}
                >
                  {errorMessage}
                </span>
              )}
            </div>
            {profile.professional.professional_heading && (
              <p className="profile-header__current-title">
                {profile.professional.professional_heading}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onRefreshProfile && (
              <Button variant="secondary" onClick={onRefreshProfile}>
                Reload
              </Button>
            )}
            <Button
              variant="primary"
              id="save-profile-btn"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </div>

        <ProfileTabsNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={{
            education: profile.education.length,
            experience: profile.experience.length,
            skills: profile.professional.skills.length,
            certificates: profile.professional.certificates.length,
            projects: profile.professional.projects.length,
          }}
        />

        <div className="profile-tab-body">
          {activeTab === 'personal' && (
            <PersonalInfoTab
              data={profile.user_info}
              onChange={updateUserInfo}
            />
          )}
          {activeTab === 'professional' && (
            <ProfessionalTab
              data={profile.professional}
              onChange={updateProfessional}
            />
          )}
          {activeTab === 'education' && (
            <EducationTab
              education={profile.education}
              onChange={updateEducation}
            />
          )}
          {activeTab === 'experience' && (
            <ExperienceTab
              experiences={profile.experience}
              onChange={updateExperience}
            />
          )}
          {activeTab === 'preferences' && (
            <WorkPreferencesTab
              preferences={profile.work_preference}
              onChange={updatePreferences}
            />
          )}
          {activeTab === 'social' && (
            <SocialMediaTab
              social={profile.social_media}
              onChange={updateSocialMedia}
            />
          )}
        </div>
      </Card>
    </div>
  );
};
