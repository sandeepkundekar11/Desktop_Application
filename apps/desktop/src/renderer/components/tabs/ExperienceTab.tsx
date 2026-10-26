import React, { FC, useState } from 'react';
import { EmploymentRecord } from '../../types';

export interface ExperienceTabProps {
  readonly experiences: readonly EmploymentRecord[];
  readonly onChange: (updated: EmploymentRecord[]) => void;
}

export const ExperienceTab: FC<ExperienceTabProps> = ({ experiences, onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  const openAdd = () => {
    setJobTitle('');
    setCompany('');
    setLocation('');
    setStartDate('');
    setEndDate('');
    setDescription('');
    setEditingIndex(null);
    setIsAdding(true);
  };

  const openEdit = (index: number) => {
    const item = experiences[index];
    if (!item) return;
    setJobTitle(item.job_title);
    setCompany(item.company);
    setLocation(item.location);
    setStartDate(item.start_date);
    setEndDate(item.end_date);
    setDescription(item.description);
    setEditingIndex(index);
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!jobTitle.trim() || !company.trim()) return;

    const record: EmploymentRecord = {
      job_title: jobTitle.trim(),
      company: company.trim(),
      location: location.trim(),
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      description: description.trim(),
    };

    if (editingIndex !== null) {
      const updated = [...experiences];
      updated[editingIndex] = record;
      onChange(updated);
    } else {
      onChange([...experiences, record]);
    }

    setIsAdding(false);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    onChange(experiences.filter((_, i) => i !== index));
  };

  return (
    <div className="tab-pane" id="tab-pane-experience">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h4 className="form-section-title" style={{ margin: 0 }}>
          Work Experiences ({experiences.length})
        </h4>
        {!isAdding && (
          <button type="button" className="btn btn-secondary" onClick={openAdd} id="add-experience-btn">
            + Add Experience
          </button>
        )}
      </div>

      {isAdding && (
        <div className="editor-card" style={{ marginBottom: 'var(--space-4)' }}>
          <h5 style={{ margin: '0 0 var(--space-3) 0', color: 'var(--color-text-primary)' }}>
            {editingIndex !== null ? 'Edit Experience' : 'Add Experience Record'}
          </h5>

          <div className="form-grid-2" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group">
              <label>Job Title *</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
            <div className="form-group">
              <label>Company *</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
          </div>

          <div className="form-grid-3" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Seattle, WA or Remote"
              />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. 2021-03 or Mar 2021"
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="e.g. Present or 2023-11"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label>Role Description & Responsibilities</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key contributions, technologies used, and outcomes achieved..."
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save Experience
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setIsAdding(false); setEditingIndex(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {experiences.map((item, idx) => (
          <div key={idx} className="item-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h5 style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                  {item.job_title}
                </h5>
                <p style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                  {item.company} {item.location ? `• ${item.location}` : ''}
                </p>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                  {item.start_date || 'Start'} – {item.end_date || 'Present'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                <button type="button" className="btn-icon" onClick={() => openEdit(idx)}>
                  Edit
                </button>
                <button type="button" className="btn-icon btn-icon--danger" onClick={() => handleRemove(idx)}>
                  Delete
                </button>
              </div>
            </div>
            {item.description && (
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-line' }}>
                {item.description}
              </p>
            )}
          </div>
        ))}

        {experiences.length === 0 && !isAdding && (
          <div className="master-resume-empty" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <p>No work experience entries added yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
