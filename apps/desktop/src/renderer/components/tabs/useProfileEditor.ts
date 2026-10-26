import { useState, useEffect } from 'react';
import { MinimalProfile } from '../../types';
import { ProfileTabId } from './ProfileTabsNav';

export interface UseProfileEditorProps {
  readonly profileData: MinimalProfile | null;
  readonly onProfileSaved?: (updated: MinimalProfile) => void;
  readonly onRefreshProfile?: () => void;
}

export const createEmptyMinimalProfile = (): MinimalProfile => ({
  user_info: {
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    country_code: '',
    phone_number: '',
    country: '',
    state: '',
    city: '',
    street_address: '',
    zip_code: '',
    language: [],
  },
  professional: {
    professional_heading: '',
    professional_summary: '',
    experience: '',
    skills: [],
    certificates: [],
    projects: [],
  },
  education: [],
  experience: [],
  resume: {
    master_resume_url: '',
  },
  work_preference: {
    expected_annual_salary_lpa: null,
    current_annual_salary: null,
    currency: '',
    nationality: '',
    notice_period: '',
    preferred_job_titles: [],
    preferred_locations: [],
  },
  social_media: {
    linkedin_profile: '',
    github_link: '',
    portfolio_link: '',
  },
});

export const useProfileEditor = ({
  profileData,
  onProfileSaved,
  onRefreshProfile,
}: UseProfileEditorProps) => {
  const [activeTab, setActiveTab] = useState<ProfileTabId>('personal');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<MinimalProfile>(createEmptyMinimalProfile());

  useEffect(() => {
    if (profileData) {
      setProfile({
        user_info: {
          ...createEmptyMinimalProfile().user_info,
          ...(profileData.user_info || {}),
          language: Array.isArray(profileData.user_info?.language)
            ? [...profileData.user_info.language]
            : [],
        },
        professional: {
          ...createEmptyMinimalProfile().professional,
          ...(profileData.professional || {}),
          skills: Array.isArray(profileData.professional?.skills)
            ? [...profileData.professional.skills]
            : [],
          certificates: Array.isArray(profileData.professional?.certificates)
            ? [...profileData.professional.certificates]
            : [],
          projects: Array.isArray(profileData.professional?.projects)
            ? [...profileData.professional.projects]
            : [],
        },
        education: Array.isArray(profileData.education) ? [...profileData.education] : [],
        experience: Array.isArray(profileData.experience) ? [...profileData.experience] : [],
        resume: {
          master_resume_url: profileData.resume?.master_resume_url || '',
        },
        work_preference: {
          ...createEmptyMinimalProfile().work_preference,
          ...(profileData.work_preference || {}),
          preferred_job_titles: Array.isArray(profileData.work_preference?.preferred_job_titles)
            ? [...profileData.work_preference.preferred_job_titles]
            : [],
          preferred_locations: Array.isArray(profileData.work_preference?.preferred_locations)
            ? [...profileData.work_preference.preferred_locations]
            : [],
        },
        social_media: {
          ...createEmptyMinimalProfile().social_media,
          ...(profileData.social_media || {}),
        },
      });
    }
  }, [profileData]);

  const updateUserInfo = (user_info: MinimalProfile['user_info']) => {
    setProfile((prev) => ({ ...prev, user_info }));
    setSaveStatus(null);
    setErrorMessage(null);
  };

  const updateProfessional = (professional: MinimalProfile['professional']) => {
    setProfile((prev) => ({ ...prev, professional }));
    setSaveStatus(null);
    setErrorMessage(null);
  };

  const updateEducation = (education: MinimalProfile['education']) => {
    setProfile((prev) => ({ ...prev, education }));
    setSaveStatus(null);
    setErrorMessage(null);
  };

  const updateExperience = (experience: MinimalProfile['experience']) => {
    setProfile((prev) => ({ ...prev, experience }));
    setSaveStatus(null);
    setErrorMessage(null);
  };

  const updateResume = (resume: MinimalProfile['resume']) => {
    setProfile((prev) => ({ ...prev, resume }));
    setSaveStatus(null);
    setErrorMessage(null);
  };

  const updatePreferences = (work_preference: MinimalProfile['work_preference']) => {
    setProfile((prev) => ({ ...prev, work_preference }));
    setSaveStatus(null);
    setErrorMessage(null);
  };

  const updateSocialMedia = (social_media: MinimalProfile['social_media']) => {
    setProfile((prev) => ({ ...prev, social_media }));
    setSaveStatus(null);
    setErrorMessage(null);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    setErrorMessage(null);

    // Validate email format if provided
    if (
      profile.user_info.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.user_info.email.trim())
    ) {
      setErrorMessage('Please provide a valid email address.');
      setIsSaving(false);
      return;
    }

    try {
      if (!window.applyPilotAPI?.profile) {
        throw new Error('Profile API bridge not available');
      }

      await window.applyPilotAPI.profile.save(profile);
      setSaveStatus('Profile saved successfully.');
      if (onProfileSaved) {
        onProfileSaved(profile);
      }
      if (onRefreshProfile) {
        onRefreshProfile();
      }
    } catch (err) {
      setErrorMessage(`Failed to save profile: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return {
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
  };
};
