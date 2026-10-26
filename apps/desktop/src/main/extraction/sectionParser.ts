export interface ResumeSections {
  readonly summaryText: string | null;
  readonly skillsText: string | null;
  readonly experienceText: string | null;
  readonly educationText: string | null;
  readonly projectsText: string | null;
  readonly certificationsText: string | null;
}

export type SectionType =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'education'
  | 'projects'
  | 'certifications'
  | 'unknown';

interface SectionHeaderRule {
  readonly type: SectionType;
  readonly pattern: RegExp;
}

const SECTION_RULES: readonly SectionHeaderRule[] = [
  {
    type: 'summary',
    pattern: /^(?:professional\s+summary|summary|profile|about\s+me|executive\s+summary|objective|career\s+objective|professional\s+profile|overview)$/i,
  },
  {
    type: 'skills',
    pattern: /^(?:technical\s+skills|core\s+competencies|skills(?:\s*&\s*technologies)?|technologies|tools|areas\s+of\s+expertise|key\s+skills|technical\s+proficiencies)$/i,
  },
  {
    type: 'experience',
    pattern: /^(?:work\s+experience|professional\s+experience|experience|employment\s+history|career\s+history|work\s+history|relevant\s+experience)$/i,
  },
  {
    type: 'education',
    pattern: /^(?:education|academic\s+background|education\s+&\s+credentials|academic\s+qualifications|qualifications)$/i,
  },
  {
    type: 'projects',
    pattern: /^(?:projects|key\s+projects|personal\s+projects|technical\s+projects|selected\s+projects)$/i,
  },
  {
    type: 'certifications',
    pattern: /^(?:certifications|licenses\s*(?:&|and)\s*certifications|certificates|professional\s+certifications|credentials)$/i,
  },
];

const identifySectionHeader = (line: string): SectionType | null => {
  const clean = line.replace(/[:#*_\-–—]/g, '').trim();
  if (clean.length === 0 || clean.length > 40) {
    return null;
  }
  for (const rule of SECTION_RULES) {
    if (rule.pattern.test(clean)) {
      return rule.type;
    }
  }
  return null;
};

export const splitResumeSections = (text: string): ResumeSections => {
  const lines = text.split('\n');
  const sectionLines: Record<SectionType, string[]> = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    unknown: [],
  };

  let currentSection: SectionType = 'unknown';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSection !== 'unknown') {
        sectionLines[currentSection].push('');
      }
      continue;
    }

    const detectedHeader = identifySectionHeader(trimmed);
    if (detectedHeader) {
      currentSection = detectedHeader;
      continue;
    }

    sectionLines[currentSection].push(line);
  }

  const joinClean = (linesArray: string[]): string | null => {
    const joined = linesArray.join('\n').trim();
    return joined.length > 0 ? joined : null;
  };

  return {
    summaryText: joinClean(sectionLines.summary),
    skillsText: joinClean(sectionLines.skills),
    experienceText: joinClean(sectionLines.experience),
    educationText: joinClean(sectionLines.education),
    projectsText: joinClean(sectionLines.projects),
    certificationsText: joinClean(sectionLines.certifications),
  };
};
