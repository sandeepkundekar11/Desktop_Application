import React, { FC } from 'react';
import { SocialMedia } from '../../types';

export interface SocialMediaTabProps {
  readonly social: SocialMedia;
  readonly onChange: (updated: SocialMedia) => void;
}

export const SocialMediaTab: FC<SocialMediaTabProps> = ({ social, onChange }) => {
  const updateField = (field: keyof SocialMedia, value: string) => {
    onChange({
      ...social,
      [field]: value,
    });
  };

  return (
    <div className="tab-pane" id="tab-pane-social">
      <div className="form-section">
        <h4 className="form-section-title">Online Profiles & Links</h4>
        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="linkedin_profile">LinkedIn Profile URL</label>
          <input
            id="linkedin_profile"
            type="url"
            value={social.linkedin_profile}
            onChange={(e) => updateField('linkedin_profile', e.target.value)}
            placeholder="e.g. https://linkedin.com/in/username"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="github_link">GitHub Profile URL</label>
          <input
            id="github_link"
            type="url"
            value={social.github_link}
            onChange={(e) => updateField('github_link', e.target.value)}
            placeholder="e.g. https://github.com/username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="portfolio_link">Personal Portfolio / Website</label>
          <input
            id="portfolio_link"
            type="url"
            value={social.portfolio_link}
            onChange={(e) => updateField('portfolio_link', e.target.value)}
            placeholder="e.g. https://johndoe.dev"
          />
        </div>
      </div>
    </div>
  );
};
