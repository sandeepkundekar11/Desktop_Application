import React, { FC, useState } from 'react';
import { EducationRecord } from '../../types';

export interface EducationTabProps {
  readonly education: readonly EducationRecord[];
  readonly onChange: (updated: EducationRecord[]) => void;
}

export const EducationTab: FC<EducationTabProps> = ({ education, onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [school, setSchool] = useState('');
  const [degree, setDegree] = useState('');
  const [major, setMajor] = useState('');
  const [marksCgpa, setMarksCgpa] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [endYear, setEndYear] = useState('');
  const [location, setLocation] = useState('');

  const openAdd = () => {
    setSchool('');
    setDegree('');
    setMajor('');
    setMarksCgpa('');
    setStartMonth('');
    setStartYear('');
    setEndMonth('');
    setEndYear('');
    setLocation('');
    setEditingIndex(null);
    setIsAdding(true);
  };

  const openEdit = (index: number) => {
    const item = education[index];
    if (!item) return;
    setSchool(item.school);
    setDegree(item.degree);
    setMajor(item.major);
    setMarksCgpa(item.marks_cgpa);
    setStartMonth(item.start.month);
    setStartYear(item.start.year);
    setEndMonth(item.end.month);
    setEndYear(item.end.year);
    setLocation(item.location);
    setEditingIndex(index);
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!school.trim() || !degree.trim()) return;

    const record: EducationRecord = {
      school: school.trim(),
      degree: degree.trim(),
      major: major.trim(),
      marks_cgpa: marksCgpa.trim(),
      start: {
        month: startMonth.trim(),
        year: startYear.trim(),
      },
      end: {
        month: endMonth.trim(),
        year: endYear.trim(),
      },
      location: location.trim(),
    };

    if (editingIndex !== null) {
      const updated = [...education];
      updated[editingIndex] = record;
      onChange(updated);
    } else {
      onChange([...education, record]);
    }

    setIsAdding(false);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    onChange(education.filter((_, i) => i !== index));
  };

  return (
    <div className="tab-pane" id="tab-pane-education">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h4 className="form-section-title" style={{ margin: 0 }}>
          Education Records ({education.length})
        </h4>
        {!isAdding && (
          <button type="button" className="btn btn-secondary" onClick={openAdd} id="add-education-btn">
            + Add Education
          </button>
        )}
      </div>

      {isAdding && (
        <div className="editor-card" style={{ marginBottom: 'var(--space-4)' }}>
          <h5 style={{ margin: '0 0 var(--space-3) 0', color: 'var(--color-text-primary)' }}>
            {editingIndex !== null ? 'Edit Education' : 'Add Education Record'}
          </h5>

          <div className="form-grid-2" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group">
              <label>School / University *</label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="e.g. Stanford University"
              />
            </div>
            <div className="form-group">
              <label>Degree *</label>
              <input
                type="text"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="e.g. Bachelor of Science"
              />
            </div>
          </div>

          <div className="form-grid-3" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group">
              <label>Major / Field of Study</label>
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="e.g. Computer Science"
              />
            </div>
            <div className="form-group">
              <label>Marks / CGPA</label>
              <input
                type="text"
                value={marksCgpa}
                onChange={(e) => setMarksCgpa(e.target.value)}
                placeholder="e.g. 3.9 / 4.0 or 85%"
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Stanford, CA"
              />
            </div>
          </div>

          <div className="form-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label>Start Date (Month & Year)</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  placeholder="Month (e.g. 08 or Aug)"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  style={{ width: '50%' }}
                />
                <input
                  type="text"
                  placeholder="Year (e.g. 2018)"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  style={{ width: '50%' }}
                />
              </div>
            </div>
            <div className="form-group">
              <label>End Date (Month & Year)</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  placeholder="Month (e.g. 05 or May)"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  style={{ width: '50%' }}
                />
                <input
                  type="text"
                  placeholder="Year (e.g. 2022)"
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  style={{ width: '50%' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save Education
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
        {education.map((item, idx) => (
          <div key={idx} className="item-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h5 style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                  {item.degree} {item.major ? `in ${item.major}` : ''}
                </h5>
                <p style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                  {item.school} {item.location ? `• ${item.location}` : ''}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  <span>
                    {item.start.month || item.start.year ? `${item.start.month} ${item.start.year}`.trim() : 'Start'} – {item.end.month || item.end.year ? `${item.end.month} ${item.end.year}`.trim() : 'End'}
                  </span>
                  {item.marks_cgpa && <span>GPA: {item.marks_cgpa}</span>}
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
          </div>
        ))}

        {education.length === 0 && !isAdding && (
          <div className="master-resume-empty" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <p>No education records added yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
