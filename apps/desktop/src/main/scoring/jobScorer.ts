import { Job } from '../storage/jobSchema.js';
import { MinimalProfile } from '../storage/minimalProfileSchema.js';

export interface ScoreBreakdown {
  readonly skills: number; // Max 35
  readonly title: number; // Max 25
  readonly experience: number; // Max 20
  readonly location: number; // Max 10
  readonly salary: number; // Max 10
}

export interface ScoreExplanation {
  readonly matchedSkills: readonly string[];
  readonly missingSkills: readonly string[];
  readonly titleMatchDetails: string;
  readonly experienceDetails: string;
  readonly locationDetails: string;
  readonly salaryDetails: string;
}

export interface JobScoreResult {
  readonly score: number; // 0 to 100
  readonly isQualified: boolean; // score > 75
  readonly breakdown: ScoreBreakdown;
  readonly explanation: ScoreExplanation;
}

export const MATCH_THRESHOLD = 75;

const normalizeToken = (t: string): string =>
  t.toLowerCase().replace(/[^a-z0-9+#.]/g, '').trim();

const extractWords = (text: string): readonly string[] => {
  return text
    .toLowerCase()
    .split(/[\s,./|()\-+]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);
};

export const scoreSkills = (
  job: Job,
  profile: MinimalProfile
): { readonly score: number; readonly matched: readonly string[]; readonly missing: readonly string[] } => {
  const candidateSkills = (profile.professional.skills || []).map((s) => s.trim()).filter(Boolean);
  const candidateNorm = new Set(candidateSkills.map(normalizeToken));

  const jobRequired = job.qualifications?.requiredSkills || [];
  if (jobRequired.length > 0) {
    const matched: string[] = [];
    const missing: string[] = [];
    for (const r of jobRequired) {
      if (candidateNorm.has(normalizeToken(r))) {
        matched.push(r);
      } else {
        missing.push(r);
      }
    }
    const ratio = matched.length / jobRequired.length;
    const score = Math.round(ratio * 35);
    return { score, matched, missing };
  }

  // If job has no structured required skills list, inspect title and description
  const textBlob = `${job.title} ${job.description || ''} ${JSON.stringify(job.sourceMetadata || {})}`.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const s of candidateSkills) {
    const norm = normalizeToken(s);
    if (norm.length > 1 && textBlob.includes(norm)) {
      matched.push(s);
    } else {
      missing.push(s);
    }
  }

  // Weight scale: 3+ matches = 35 pts, 2 = 28 pts, 1 = 20 pts, 0 = 0 pts
  let score = 0;
  if (matched.length >= 3) {
    score = 35;
  } else if (matched.length === 2) {
    score = 28;
  } else if (matched.length === 1) {
    score = 20;
  } else {
    score = 0;
  }

  return { score, matched, missing };
};

export const scoreTitle = (
  job: Job,
  profile: MinimalProfile
): { readonly score: number; readonly details: string } => {
  const preferred = (profile.work_preference?.preferred_job_titles || []).filter(Boolean);
  const heading = profile.professional?.professional_heading?.trim();
  const titlesToMatch = [...preferred];
  if (heading && !titlesToMatch.includes(heading)) {
    titlesToMatch.push(heading);
  }
  for (const exp of profile.experience || []) {
    if (exp.job_title && !titlesToMatch.includes(exp.job_title)) {
      titlesToMatch.push(exp.job_title);
    }
  }

  if (titlesToMatch.length === 0) {
    return { score: 0, details: 'No candidate titles specified in profile.' };
  }

  const jobTitleNorm = job.title.toLowerCase();
  let maxScore = 0;
  let bestDetail = 'No keyword match with job title.';

  for (const target of titlesToMatch) {
    const targetNorm = target.toLowerCase();
    if (jobTitleNorm === targetNorm) {
      return { score: 25, details: `Exact title match with "${target}".` };
    }

    const targetWords = extractWords(target);
    const jobWords = new Set(extractWords(job.title));
    const shared = targetWords.filter((w) => jobWords.has(w));

    // High value keywords: frontend, react, developer, engineer, fullstack, software
    const hasCoreRole = shared.some((w) => ['frontend', 'react', 'nextjs', 'javascript', 'ui'].includes(w));
    const hasPosition = shared.some((w) => ['developer', 'engineer', 'architect', 'lead'].includes(w));

    let candidateScore = 0;
    if (hasCoreRole && hasPosition) {
      candidateScore = 25;
    } else if (hasCoreRole) {
      candidateScore = 20;
    } else if (shared.length >= 2) {
      candidateScore = 15;
    } else if (shared.length === 1 && !['senior', 'lead', 'staff'].includes(shared[0] || '')) {
      candidateScore = 10;
    }

    if (candidateScore > maxScore) {
      maxScore = candidateScore;
      bestDetail = `Matched keywords [${shared.join(', ')}] from candidate title "${target}".`;
    }
  }

  return { score: maxScore, details: bestDetail };
};

export const scoreExperience = (
  job: Job,
  profile: MinimalProfile
): { readonly score: number; readonly details: string } => {
  const totalRoles = (profile.experience || []).length;
  // Estimate ~1 year per role or 3 years minimum documented
  const candidateYears = Math.max(3, totalRoles);

  if (job.experience && (job.experience.minYears !== null || job.experience.maxYears !== null)) {
    const min = job.experience.minYears ?? 0;
    if (candidateYears >= min) {
      return { score: 20, details: `Candidate (${candidateYears} yrs) meets required minimum (${min} yrs).` };
    }
    if (candidateYears >= min - 1) {
      return { score: 14, details: `Candidate (${candidateYears} yrs) close to required minimum (${min} yrs).` };
    }
    return { score: 5, details: `Candidate (${candidateYears} yrs) below required minimum (${min} yrs).` };
  }

  // Missing structured experience in job: never fabricate or grant full credit
  const titleLower = job.title.toLowerCase();
  if (titleLower.includes('junior') || titleLower.includes('associate') || titleLower.includes('intern')) {
    return { score: 15, details: 'Junior/Associate role: candidate experience is a solid match without full credit.' };
  }
  if (titleLower.includes('staff') || titleLower.includes('principal') || titleLower.includes('lead')) {
    return { score: 12, details: 'Staff/Lead role: candidate has 3+ yrs; moderate senior alignment without full credit.' };
  }
  return { score: 14, details: 'Experience requirement unstated: partial credit awarded without fabricating full credit.' };
};

export const scoreLocation = (
  job: Job,
  profile: MinimalProfile
): { readonly score: number; readonly details: string } => {
  if (job.workplaceType === 'remote') {
    return { score: 10, details: 'Remote position matches remote preference.' };
  }

  const candCountry = profile.user_info.country?.toLowerCase().trim() || 'india';
  const candState = profile.user_info.state?.toLowerCase().trim() || 'karnataka';
  const candCity = profile.user_info.city?.toLowerCase().trim() || 'belgaum';

  if (!job.location) {
    return { score: 0, details: 'Job location is unknown; no credit awarded.' };
  }

  const jobRaw = (job.location.rawLocation || '').toLowerCase();
  const jobCountry = (job.location.country || '').toLowerCase();
  const jobCity = (job.location.city || '').toLowerCase();

  if (jobRaw.includes('remote')) {
    return { score: 10, details: 'Listing mentions remote flexibility.' };
  }

  if (jobCity.includes(candCity) || jobRaw.includes(candCity)) {
    return { score: 10, details: `Job located in candidate city (${profile.user_info.city}).` };
  }
  if (jobRaw.includes('bengaluru') || jobRaw.includes('bangalore') || jobRaw.includes(candState)) {
    return { score: 10, details: 'Job located within candidate primary state / regional tech hub (Bengaluru).' };
  }
  if (jobCountry.includes(candCountry) || jobRaw.includes(candCountry)) {
    return { score: 8, details: `Job located within candidate country (${profile.user_info.country}).` };
  }

  return { score: 0, details: `Job location (${job.location.rawLocation}) outside candidate region.` };
};

export const scoreSalary = (
  job: Job,
  profile: MinimalProfile
): { readonly score: number; readonly details: string } => {
  const expectedLpa = profile.work_preference?.expected_annual_salary_lpa;
  if (expectedLpa === null || expectedLpa === undefined || !job.salary) {
    // Missing info cannot be fabricated or receive full credit
    return { score: 0, details: 'Salary information not specified or unstated; 0 credit awarded.' };
  }

  if (job.salary.min !== null && job.salary.min >= expectedLpa) {
    return { score: 10, details: `Salary minimum (${job.salary.min}) meets or exceeds expected (${expectedLpa} LPA).` };
  }
  if (job.salary.max !== null && job.salary.max >= expectedLpa) {
    return { score: 8, details: `Salary maximum (${job.salary.max}) accommodates expected (${expectedLpa} LPA).` };
  }
  return { score: 3, details: 'Salary range provided is below candidate preference.' };
};

export const calculateJobMatchScore = (job: Job, profile: MinimalProfile): JobScoreResult => {
  const skillsRes = scoreSkills(job, profile);
  const titleRes = scoreTitle(job, profile);
  const expRes = scoreExperience(job, profile);
  const locRes = scoreLocation(job, profile);
  const salRes = scoreSalary(job, profile);

  const breakdown: ScoreBreakdown = {
    skills: skillsRes.score,
    title: titleRes.score,
    experience: expRes.score,
    location: locRes.score,
    salary: salRes.score,
  };

  const totalScore = Math.min(
    100,
    Math.max(0, breakdown.skills + breakdown.title + breakdown.experience + breakdown.location + breakdown.salary)
  );

  const explanation: ScoreExplanation = {
    matchedSkills: skillsRes.matched,
    missingSkills: skillsRes.missing,
    titleMatchDetails: titleRes.details,
    experienceDetails: expRes.details,
    locationDetails: locRes.details,
    salaryDetails: salRes.details,
  };

  return {
    score: totalScore,
    isQualified: totalScore > MATCH_THRESHOLD,
    breakdown,
    explanation,
  };
};
