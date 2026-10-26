import React, { FC, useState } from 'react';
import { WorkPreference } from '../../types';

export interface WorkPreferencesTabProps {
  readonly preferences: WorkPreference;
  readonly onChange: (updated: WorkPreference) => void;
}

export const WorkPreferencesTab: FC<WorkPreferencesTabProps> = ({ preferences, onChange }) => {
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const updateField = (field: keyof WorkPreference, value: any) => {
    onChange({
      ...preferences,
      [field]: value,
    });
  };

  const handleSalaryChange = (
    field: 'expected_annual_salary_lpa' | 'current_annual_salary',
    rawVal: string
  ) => {
    const trimmed = rawVal.trim();
    if (!trimmed) {
      updateField(field, null);
    } else {
      const num = Number(trimmed);
      updateField(field, Number.isNaN(num) ? null : num);
    }
  };

  const handleAddTitle = () => {
    const trimmed = newTitle.trim();
    if (!trimmed || preferences.preferred_job_titles.includes(trimmed)) return;
    onChange({
      ...preferences,
      preferred_job_titles: [...preferences.preferred_job_titles, trimmed],
    });
    setNewTitle('');
  };

  const handleRemoveTitle = (title: string) => {
    onChange({
      ...preferences,
      preferred_job_titles: preferences.preferred_job_titles.filter((t) => t !== title),
    });
  };

  const handleAddLocation = () => {
    const trimmed = newLocation.trim();
    if (!trimmed || preferences.preferred_locations.includes(trimmed)) return;
    onChange({
      ...preferences,
      preferred_locations: [...preferences.preferred_locations, trimmed],
    });
    setNewLocation('');
  };

  const handleRemoveLocation = (loc: string) => {
    onChange({
      ...preferences,
      preferred_locations: preferences.preferred_locations.filter((l) => l !== loc),
    });
  };

  return (
    <div className="tab-pane" id="tab-pane-preferences">
      <div className="form-section">
        <h4 className="form-section-title">Compensation & Notice</h4>
        <div className="form-grid-3">
          <div className="form-group">
            <label htmlFor="currency">Currency</label>
            <input
              id="currency"
              type="text"
              value={preferences.currency}
              onChange={(e) => updateField('currency', e.target.value)}
              placeholder="e.g. USD or INR"
            />
          </div>
          <div className="form-group">
            <label htmlFor="expected_annual_salary_lpa">Expected Annual Salary (LPA / Annual)</label>
            <input
              id="expected_annual_salary_lpa"
              type="number"
              step="any"
              value={preferences.expected_annual_salary_lpa ?? ''}
              onChange={(e) => handleSalaryChange('expected_annual_salary_lpa', e.target.value)}
              placeholder="e.g. 25"
            />
          </div>
          <div className="form-group">
            <label htmlFor="current_annual_salary">Current Annual Salary</label>
            <input
              id="current_annual_salary"
              type="number"
              step="any"
              value={preferences.current_annual_salary ?? ''}
              onChange={(e) => handleSalaryChange('current_annual_salary', e.target.value)}
              placeholder="e.g. 20"
            />
          </div>
        </div>

        <div className="form-grid-2" style={{ marginTop: 'var(--space-3)' }}>
          <div className="form-group">
            <label htmlFor="notice_period">Notice Period</label>
            <input
              id="notice_period"
              type="text"
              value={preferences.notice_period}
              onChange={(e) => updateField('notice_period', e.target.value)}
              placeholder="e.g. Immediate, 30 days, or 2 months"
            />
          </div>
          <div className="form-group">
            <label htmlFor="nationality">Nationality</label>
            <input
              id="nationality"
              type="text"
              value={preferences.nationality}
              onChange={(e) => updateField('nationality', e.target.value)}
              placeholder="e.g. American, Indian, Canadian"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Preferred Job Titles ({preferences.preferred_job_titles.length})</h4>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Add preferred title (e.g. Full Stack Architect)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTitle(); } }}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-secondary" onClick={handleAddTitle}>
            Add Title
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {preferences.preferred_job_titles.map((title) => (
            <span key={title} className="badge-tag">
              {title}
              <button
                type="button"
                className="badge-tag__remove"
                onClick={() => handleRemoveTitle(title)}
                aria-label={`Remove ${title}`}
              >
                ×
              </button>
            </span>
          ))}
          {preferences.preferred_job_titles.length === 0 && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              No preferred job titles listed.
            </span>
          )}
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Preferred Locations ({preferences.preferred_locations.length})</h4>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Add preferred location (e.g. Remote, San Francisco, New York)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLocation(); } }}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-secondary" onClick={handleAddLocation}>
            Add Location
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {preferences.preferred_locations.map((loc) => (
            <span key={loc} className="badge-tag">
              {loc}
              <button
                type="button"
                className="badge-tag__remove"
                onClick={() => handleRemoveLocation(loc)}
                aria-label={`Remove ${loc}`}
              >
                ×
              </button>
            </span>
          ))}
          {preferences.preferred_locations.length === 0 && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              No preferred locations listed.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
