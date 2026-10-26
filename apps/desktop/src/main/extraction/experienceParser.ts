import { EmploymentRecord, EducationRecord, MonthYearDate } from '../storage/minimalProfileSchema.js';

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const TITLE_KEYWORDS = [
  'engineer', 'developer', 'architect', 'manager', 'lead', 'designer', 'analyst',
  'consultant', 'specialist', 'director', 'intern', 'associate', 'programmer',
  'administrator', 'coordinator', 'technician', 'officer', 'scientist', 'head', 'vp',
];

const COMPANY_INDICATORS = [
  'ltd', 'inc', 'corp', 'llc', 'corporation', 'solutions', 'technologies', 'systems',
  'group', 'labs', 'company', 'gmbh', 'pvt', 'services', 'technomind', 'consulting',
];

export const normalizeDateToken = (raw: string): string | null => {
  const trimmed = raw.trim();
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch && slashMatch[1] && slashMatch[2]) {
    return `${slashMatch[2]}-${slashMatch[1].padStart(2, '0')}`;
  }
  const words = trimmed.split(/[\s,.]+/).filter(Boolean);
  if (words.length === 2 && words[0] && words[1]) {
    const monthKey = words[0].toLowerCase();
    const yearMatch = words[1].match(/^\d{4}$/);
    if (MONTH_MAP[monthKey] && yearMatch) {
      return `${yearMatch[0]}-${MONTH_MAP[monthKey]}`;
    }
  }
  const yearOnly = trimmed.match(/\b(19\d\d|20\d\d)\b/);
  if (yearOnly) return yearOnly[0];
  return null;
};

export const parseMonthYear = (rawDate: string | null): MonthYearDate => {
  if (!rawDate) return { month: '', year: '' };
  const parts = rawDate.split('-');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { month: parts[1], year: parts[0] };
  }
  const yearMatch = rawDate.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    return { month: '', year: yearMatch[0] };
  }
  return { month: '', year: '' };
};

const DATE_RANGE_REGEX = /(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b))\s*(?:–|-|—|to)\s*(?:Present|Current|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b))/i;

interface ParsedDateRange {
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly isCurrent: boolean;
}

export const parseDateRange = (text: string): ParsedDateRange | null => {
  const match = text.match(DATE_RANGE_REGEX);
  if (!match) return null;

  const parts = match[0].split(/\s*(?:–|-|—|to)\s*/i);
  const rawStart = parts[0] || '';
  const rawEnd = parts[1] || '';

  const startDate = normalizeDateToken(rawStart);
  const isCurrent = /present|current/i.test(rawEnd);
  const endDate = isCurrent ? 'Present' : normalizeDateToken(rawEnd);

  return { startDate, endDate, isCurrent };
};

const isJobTitleLike = (text: string): boolean => {
  const lower = text.toLowerCase();
  return TITLE_KEYWORDS.some((kw) => lower.includes(kw));
};

const isCompanyLike = (text: string): boolean => {
  const lower = text.toLowerCase();
  return COMPANY_INDICATORS.some((ind) => lower.includes(ind));
};

const splitTitleCompany = (line: string): { title: string; company: string; location: string } => {
  const cleaned = line.replace(DATE_RANGE_REGEX, '').trim().replace(/[,|–-]$/, '').trim();
  const segments = cleaned.split(/\s*(?:\||–|-|—|at)\s*/).map((s) => s.trim()).filter(Boolean);

  let title = '';
  let company = '';
  let location = '';

  for (const seg of segments) {
    if (/\b[A-Z][a-zA-Z\s]+,\s*([A-Z]{2}|[A-Z][a-zA-Z\s]+)\b/.test(seg)) {
      location = seg;
    } else if (isJobTitleLike(seg) && !title) {
      title = seg;
    } else if ((isCompanyLike(seg) || !company) && seg !== title) {
      company = seg;
    }
  }

  if (!title && segments[0]) title = segments[0];
  if (!company && segments[1]) company = segments[1];

  return {
    title: title || 'Professional Experience',
    company: company || '',
    location,
  };
};

interface RoleAccumulator {
  title: string;
  company: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  achievements: string[];
}

export const parseWorkExperiences = (text: string | null): EmploymentRecord[] => {
  if (!text) return [];

  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const roles: RoleAccumulator[] = [];

  let currentCompany = '';
  let currentLocation = '';
  let activeRole: RoleAccumulator | null = null;

  for (const line of rawLines) {
    const isBullet = /^[•*\-–—]\s*/.test(line) || /^\d+\.\s+/.test(line);
    if (isBullet && activeRole) {
      const cleanBullet = line.replace(/^[•*\-–—\d.]+\s*/, '').trim();
      if (cleanBullet.length > 0) activeRole.achievements.push(cleanBullet);
      continue;
    }

    const dateRange = parseDateRange(line);

    if (!dateRange && isCompanyLike(line) && !isJobTitleLike(line)) {
      const segs = line.split(/\s*(?:\||–|-|—)\s*/).map((s) => s.trim());
      if (segs[0]) currentCompany = segs[0];
      if (segs[1] && /\b[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+\b/.test(segs[1])) {
        currentLocation = segs[1];
      }
      continue;
    }

    if (activeRole && activeRole.achievements.length === 0 && dateRange && (!isJobTitleLike(line) || isCompanyLike(line))) {
      const { company, location } = splitTitleCompany(line);
      const effComp = company || currentCompany;
      if (effComp && effComp !== activeRole.title) {
        activeRole.company = effComp;
        currentCompany = effComp;
      }
      if (location) activeRole.location = location;
      activeRole.startDate = dateRange.startDate;
      activeRole.endDate = dateRange.endDate;
      continue;
    }

    if (dateRange || isJobTitleLike(line)) {
      const { title, company, location } = splitTitleCompany(line);
      const effComp = company || currentCompany || 'Company';
      if (company) currentCompany = company;
      const effLoc = location || currentLocation;

      activeRole = {
        title,
        company: effComp,
        location: effLoc,
        startDate: dateRange?.startDate ?? null,
        endDate: dateRange?.endDate ?? null,
        achievements: [],
      };
      roles.push(activeRole);
      continue;
    }

    if (activeRole && line.length > 0) {
      activeRole.achievements.push(line);
    }
  }

  return roles.map((r) => ({
    job_title: r.title,
    company: r.company || 'Company',
    location: r.location || '',
    start_date: r.startDate || '',
    end_date: r.endDate || '',
    description: r.achievements.join('. '),
  }));
};

const DEGREE_REGEX = /\b(Bachelor|Master|Doctor|Ph\.?D\.?|B\.?S\.?|B\.?A\.?|B\.?E\.?|B\.?Tech|M\.?S\.?|M\.?A\.?|M\.?Tech|MBA|Associate|Diploma)\b[^\n,]*/i;

export const parseEducationRecords = (text: string | null): EducationRecord[] => {
  if (!text) return [];

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const educations: EducationRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const degreeMatch = line.match(DEGREE_REGEX);
    if (degreeMatch) {
      const degree = degreeMatch[0].trim();
      const nextLine = i + 1 < lines.length ? lines[i + 1] : undefined;
      const prevLine = i > 0 ? lines[i - 1] : undefined;
      const inLineInst = line.replace(degreeMatch[0], '').replace(/[,|–-]/g, '').trim();

      let rawInst = inLineInst;
      if (!rawInst && nextLine && !DEGREE_REGEX.test(nextLine)) rawInst = nextLine;
      else if (!rawInst && prevLine && !DEGREE_REGEX.test(prevLine)) rawInst = prevLine;

      const school = (rawInst || 'Institution').replace(/\b(19\d\d|20\d\d)\b/g, '').replace(/[\s,|–-]+$/, '').trim() || 'Institution';

      // Parse dates: check for date range or single year
      const dateRange = parseDateRange(line) || (nextLine ? parseDateRange(nextLine) : null);
      const singleYearMatch = `${line} ${nextLine || ''}`.match(/\b(19\d\d|20\d\d)\b/);

      const start = parseMonthYear(dateRange?.startDate ?? null);
      const end = parseMonthYear(dateRange?.endDate ?? (singleYearMatch ? singleYearMatch[0] : null));

      // Parse CGPA or marks: e.g. "CGPA: 7.56 / 10" or "GPA: 3.8"
      const marksMatch = `${line} ${nextLine || ''}`.match(/(?:CGPA|GPA|Marks)[:\s]+([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i);
      const marks_cgpa = marksMatch?.[1]?.trim() || '';

      // Parse major / field: e.g. "Electronics & Communication Engineering"
      const majorMatch = degree.match(/(?:in|of)\s+([A-Za-z\s&]+)/i);
      const major = majorMatch?.[1]?.trim() || '';

      educations.push({
        school,
        degree,
        major,
        marks_cgpa,
        start,
        end,
        location: '',
      });
    }
  }

  return educations;
};
