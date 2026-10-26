import React, { FC, useState } from 'react';
import { UserInfo } from '../../types';

export interface PersonalInfoTabProps {
  readonly data: UserInfo;
  readonly onChange: (updated: UserInfo) => void;
}

export const PersonalInfoTab: FC<PersonalInfoTabProps> = ({ data, onChange }) => {
  const [newLanguage, setNewLanguage] = useState('');

  const updateField = (field: keyof UserInfo, value: string) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleAddLanguage = () => {
    const trimmed = newLanguage.trim();
    if (!trimmed || data.language.includes(trimmed)) return;
    onChange({
      ...data,
      language: [...data.language, trimmed],
    });
    setNewLanguage('');
  };

  const handleRemoveLanguage = (lang: string) => {
    onChange({
      ...data,
      language: data.language.filter((l) => l !== lang),
    });
  };

  return (
    <div className="tab-pane" id="tab-pane-personal">
      <div className="form-section">
        <h4 className="form-section-title">Full Name</h4>
        <div className="form-grid-3">
          <div className="form-group">
            <label htmlFor="first_name">First Name</label>
            <input
              id="first_name"
              type="text"
              value={data.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
              placeholder="e.g. John"
            />
          </div>
          <div className="form-group">
            <label htmlFor="middle_name">Middle Name</label>
            <input
              id="middle_name"
              type="text"
              value={data.middle_name}
              onChange={(e) => updateField('middle_name', e.target.value)}
              placeholder="e.g. Robert"
            />
          </div>
          <div className="form-group">
            <label htmlFor="last_name">Last Name</label>
            <input
              id="last_name"
              type="text"
              value={data.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
              placeholder="e.g. Doe"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Contact Information</h4>
        <div className="form-grid-3">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="e.g. john@example.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="country_code">Country Code</label>
            <input
              id="country_code"
              type="text"
              value={data.country_code}
              onChange={(e) => updateField('country_code', e.target.value)}
              placeholder="e.g. +1 or +91"
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone_number">Phone Number</label>
            <input
              id="phone_number"
              type="text"
              value={data.phone_number}
              onChange={(e) => updateField('phone_number', e.target.value)}
              placeholder="e.g. 555-123-4567"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Location & Address</h4>
        <div className="form-grid-3">
          <div className="form-group">
            <label htmlFor="street_address">Street Address</label>
            <input
              id="street_address"
              type="text"
              value={data.street_address}
              onChange={(e) => updateField('street_address', e.target.value)}
              placeholder="e.g. 123 Main St"
            />
          </div>
          <div className="form-group">
            <label htmlFor="city">City</label>
            <input
              id="city"
              type="text"
              value={data.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="e.g. San Francisco"
            />
          </div>
          <div className="form-group">
            <label htmlFor="state">State / Province</label>
            <input
              id="state"
              type="text"
              value={data.state}
              onChange={(e) => updateField('state', e.target.value)}
              placeholder="e.g. California"
            />
          </div>
          <div className="form-group">
            <label htmlFor="country">Country</label>
            <input
              id="country"
              type="text"
              value={data.country}
              onChange={(e) => updateField('country', e.target.value)}
              placeholder="e.g. United States"
            />
          </div>
          <div className="form-group">
            <label htmlFor="zip_code">Zip / Postal Code</label>
            <input
              id="zip_code"
              type="text"
              value={data.zip_code}
              onChange={(e) => updateField('zip_code', e.target.value)}
              placeholder="e.g. 94105"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Languages</h4>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Add language (e.g. English)"
            value={newLanguage}
            onChange={(e) => setNewLanguage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddLanguage();
              }
            }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAddLanguage}
            id="add-language-btn"
          >
            Add
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {data.language.map((lang) => (
            <span key={lang} className="badge-tag">
              {lang}
              <button
                type="button"
                className="badge-tag__remove"
                onClick={() => handleRemoveLanguage(lang)}
                aria-label={`Remove ${lang}`}
              >
                ×
              </button>
            </span>
          ))}
          {data.language.length === 0 && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              No languages added.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
