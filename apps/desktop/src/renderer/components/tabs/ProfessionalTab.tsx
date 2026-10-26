import React, { FC, useState } from 'react';
import { ProfessionalInfo, ProjectRecord } from '../../types';

export interface ProfessionalTabProps {
  readonly data: ProfessionalInfo;
  readonly onChange: (updated: ProfessionalInfo) => void;
}

export const ProfessionalTab: FC<ProfessionalTabProps> = ({ data, onChange }) => {
  const [newSkill, setNewSkill] = useState('');
  const [newCert, setNewCert] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [editingProjectIdx, setEditingProjectIdx] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectUrl, setProjectUrl] = useState('');

  const updateField = (field: keyof ProfessionalInfo, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed || data.skills.includes(trimmed)) return;
    onChange({ ...data, skills: [...data.skills, trimmed] });
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    onChange({ ...data, skills: data.skills.filter((s) => s !== skill) });
  };

  const handleAddCert = () => {
    const trimmed = newCert.trim();
    if (!trimmed || data.certificates.includes(trimmed)) return;
    onChange({ ...data, certificates: [...data.certificates, trimmed] });
    setNewCert('');
  };

  const handleRemoveCert = (cert: string) => {
    onChange({ ...data, certificates: data.certificates.filter((c) => c !== cert) });
  };

  const openAddProject = () => {
    setProjectName('');
    setProjectDesc('');
    setProjectUrl('');
    setEditingProjectIdx(null);
    setIsAddingProject(true);
  };

  const openEditProject = (idx: number) => {
    const p = data.projects[idx];
    if (!p) return;
    setProjectName(p.name);
    setProjectDesc(p.description);
    setProjectUrl(p.url);
    setEditingProjectIdx(idx);
    setIsAddingProject(true);
  };

  const handleSaveProject = () => {
    if (!projectName.trim()) return;
    const projectItem: ProjectRecord = {
      name: projectName.trim(),
      description: projectDesc.trim(),
      url: projectUrl.trim(),
    };

    if (editingProjectIdx !== null) {
      const updated = [...data.projects];
      updated[editingProjectIdx] = projectItem;
      onChange({ ...data, projects: updated });
    } else {
      onChange({ ...data, projects: [...data.projects, projectItem] });
    }
    setIsAddingProject(false);
    setEditingProjectIdx(null);
  };

  const handleRemoveProject = (idx: number) => {
    onChange({ ...data, projects: data.projects.filter((_, i) => i !== idx) });
  };

  return (
    <div className="tab-pane" id="tab-pane-professional">
      <div className="form-section">
        <h4 className="form-section-title">Professional Heading & Summary</h4>
        <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="professional_heading">Professional Heading</label>
          <input
            id="professional_heading"
            type="text"
            value={data.professional_heading}
            onChange={(e) => updateField('professional_heading', e.target.value)}
            placeholder="e.g. Senior Full Stack Engineer | React & Cloud Architect"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="experience_summary">Overall Experience Summary</label>
          <input
            id="experience_summary"
            type="text"
            value={data.experience}
            onChange={(e) => updateField('experience', e.target.value)}
            placeholder="e.g. 8+ years building enterprise SaaS platforms"
          />
        </div>
        <div className="form-group">
          <label htmlFor="professional_summary">Professional Summary</label>
          <textarea
            id="professional_summary"
            rows={4}
            value={data.professional_summary}
            onChange={(e) => updateField('professional_summary', e.target.value)}
            placeholder="Comprehensive overview of candidate career, strengths, and background..."
          />
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Skills ({data.skills.length})</h4>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Add skill (e.g. React, TypeScript, AWS)"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-secondary" onClick={handleAddSkill}>
            Add Skill
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {data.skills.map((skill) => (
            <span key={skill} className="badge-tag">
              {skill}
              <button
                type="button"
                className="badge-tag__remove"
                onClick={() => handleRemoveSkill(skill)}
                aria-label={`Remove ${skill}`}
              >
                ×
              </button>
            </span>
          ))}
          {data.skills.length === 0 && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              No skills listed.
            </span>
          )}
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Certificates ({data.certificates.length})</h4>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Add certificate (e.g. AWS Certified Solutions Architect)"
            value={newCert}
            onChange={(e) => setNewCert(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCert(); } }}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-secondary" onClick={handleAddCert}>
            Add Certificate
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {data.certificates.map((cert) => (
            <span key={cert} className="badge-tag badge-tag--accent">
              {cert}
              <button
                type="button"
                className="badge-tag__remove"
                onClick={() => handleRemoveCert(cert)}
                aria-label={`Remove ${cert}`}
              >
                ×
              </button>
            </span>
          ))}
          {data.certificates.length === 0 && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              No certificates listed.
            </span>
          )}
        </div>
      </div>

      <div className="form-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h4 className="form-section-title" style={{ margin: 0 }}>Projects ({data.projects.length})</h4>
          {!isAddingProject && (
            <button type="button" className="btn btn-secondary" onClick={openAddProject}>
              + Add Project
            </button>
          )}
        </div>

        {isAddingProject && (
          <div className="editor-card" style={{ marginBottom: 'var(--space-4)' }}>
            <h5 style={{ margin: '0 0 var(--space-3) 0', color: 'var(--color-text-primary)' }}>
              {editingProjectIdx !== null ? 'Edit Project' : 'New Project'}
            </h5>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label>Project Name *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Distributed Analytics Pipeline"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label>Project URL</label>
              <input
                type="url"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="e.g. https://github.com/user/project"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label>Description</label>
              <textarea
                rows={3}
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="Key technologies, architecture, and accomplishments..."
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="button" className="btn btn-primary" onClick={handleSaveProject}>
                Save Project
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setIsAddingProject(false); setEditingProjectIdx(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {data.projects.map((proj, idx) => (
            <div key={idx} className="item-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h5 style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                    {proj.name}
                  </h5>
                  {proj.url && (
                    <a
                      href={proj.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'none' }}
                    >
                      {proj.url}
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button type="button" className="btn-icon" onClick={() => openEditProject(idx)}>
                    Edit
                  </button>
                  <button type="button" className="btn-icon btn-icon--danger" onClick={() => handleRemoveProject(idx)}>
                    Delete
                  </button>
                </div>
              </div>
              {proj.description && (
                <p style={{ margin: 'var(--space-2) 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {proj.description}
                </p>
              )}
            </div>
          ))}
          {data.projects.length === 0 && !isAddingProject && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              No projects listed.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
